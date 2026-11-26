import { db } from "../db";
import { getAppSettings } from "../settings";
import { ROLE_DEFINITIONS } from "./roles";
import type { AiRole } from "./types";

export type AiProgressEvent = { stage: string; percent: number; text: string };
type RunOptions = { onProgress?: (event: AiProgressEvent) => void };

function normalizeModelJson(role: AiRole, value: unknown): unknown {
  if (role !== "bibleWriter" || typeof value !== "object" || value === null) return value;
  const bible = value as Record<string, unknown>;
  const visualStyle = typeof bible.visualStyle === "object" && bible.visualStyle !== null ? bible.visualStyle as Record<string, unknown> : {};
  const stringArray = (item: unknown): string[] => Array.isArray(item) ? item.map(String) : typeof item === "string" ? item.split(/[,;\n]/).map((part) => part.trim()).filter(Boolean) : [];
  const world = typeof bible.world === "object" && bible.world !== null ? bible.world as Record<string, unknown> : {};
  const continuity = typeof bible.continuity === "object" && bible.continuity !== null ? bible.continuity as Record<string, unknown> : {};
  return {
    ...bible,
    world: { rules: stringArray(world.rules), impossible: stringArray(world.impossible), taboo: stringArray(world.taboo) },
    visualStyle: { ...visualStyle, palette: stringArray(visualStyle.palette) },
    continuity: { ...continuity, threads: stringArray(continuity.threads), characterStates: continuity.characterStates && typeof continuity.characterStates === "object" ? continuity.characterStates : {} },
    neverDo: stringArray(bible.neverDo),
    changelog: Array.isArray(bible.changelog) ? bible.changelog : [],
  };
}

function parseRouterPayload(raw: string): { text: string; inputTokens: number; outputTokens: number } {
  const payloads: Array<Record<string, unknown>> = [];
  try {
    payloads.push(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    const firstJsonStart = raw.indexOf("{");
    const doneMarker = raw.indexOf("data: [DONE]");
    if (firstJsonStart >= 0 && doneMarker > firstJsonStart) {
      const candidate = raw.slice(firstJsonStart, doneMarker).trim();
      try { payloads.push(JSON.parse(candidate) as Record<string, unknown>); } catch { /* continue with line-delimited SSE parsing */ }
    }
    for (const line of raw.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const chunk = line.slice(5).trim();
      if (!chunk || chunk === "[DONE]") continue;
      try { payloads.push(JSON.parse(chunk) as Record<string, unknown>); } catch { /* ignore non-JSON SSE lines */ }
    }
  }
  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  for (const payload of payloads) {
    const choices = Array.isArray(payload.choices) ? payload.choices as Array<Record<string, unknown>> : [];
    for (const choice of choices) {
      const message = (choice.message ?? choice.delta) as Record<string, unknown> | undefined;
      const content = message?.content;
      if (typeof content === "string") text += content;
      else if (Array.isArray(content)) text += content.map((part) => typeof part === "object" && part && "text" in part ? String((part as { text: unknown }).text) : "").join("");
    }
    const usage = payload.usage as Record<string, unknown> | undefined;
    inputTokens = Number(usage?.prompt_tokens ?? usage?.input_tokens ?? inputTokens);
    outputTokens = Number(usage?.completion_tokens ?? usage?.output_tokens ?? outputTokens);
  }
  return { text, inputTokens, outputTokens };
}

async function requestModel(model: string, temperature: number, system: string, prompt: string) {
  const { publicSettings, secrets } = await getAppSettings();
  const { provider, baseUrl } = publicSettings.ai;
  if (provider === "local") throw new Error("Penyedia AI lokal tidak menyediakan endpoint generatif.");
  if (provider === "anthropic") {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/messages`, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": secrets.aiApiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model, max_tokens: 4096, temperature, system, messages: [{ role: "user", content: prompt }] }), signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`AI HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
    const raw = await res.text();
    const parsed = parseRouterPayload(raw);
    if (parsed.text) return parsed;
    try {
      const data = JSON.parse(raw);
      const content = data.content?.map((part: { text?: string }) => part.text ?? "").join("") ?? "";
      return { text: content, inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 };
    } catch { throw new Error("Respons AI bukan JSON/SSE yang dapat dibaca."); }
  }
  const clean = baseUrl.replace(/\/$/, "");
  const endpoint = clean.endsWith("/v1") ? `${clean}/chat/completions` : `${clean}/v1/chat/completions`;
  const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", ...(secrets.aiApiKey ? { Authorization: `Bearer ${secrets.aiApiKey}` } : {}) }, body: JSON.stringify({ model, temperature, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }), signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`AI HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const raw = await res.text();
  const parsed = parseRouterPayload(raw);
  if (!parsed.text) throw new Error(`Respons AI kosong atau format tidak dikenal: ${raw.slice(0, 240)}`);
  return parsed;
}

export async function runAiRole<R extends AiRole>(role: R, input: unknown, options: RunOptions = {}) {
  const def = ROLE_DEFINITIONS[role];
  const validInput = def.input.safeParse(input);
  if (!validInput.success) throw new Error(`Invalid ${role} input: ${validInput.error.message}`);
  const { publicSettings } = await getAppSettings();
  const cfg = publicSettings.ai.roles[role];
  const start = performance.now();
  const run = await db.aiRun.create({ data: { role, model: cfg.model, input: JSON.parse(JSON.stringify(validInput.data)), status: "running" } });
  let lastError = "No valid output"; let inputTokens = 0; let outputTokens = 0;
  try {
    for (const model of [...new Set([cfg.model, cfg.fallbackModel])]) {
      let validationError = "";
      for (let retry = 0; retry <= 2; retry++) {
        options.onProgress?.({ stage: role, percent: 10 + retry * 25, text: retry ? `Memperbaiki validasi (${retry}/2)…` : `Menghubungi ${model}…` });
        try {
          const response = await requestModel(model, cfg.temperature, def.system, JSON.stringify({ input: validInput.data, previousValidationError: validationError || undefined, format: "JSON only" }));
          inputTokens += response.inputTokens; outputTokens += response.outputTokens;
          let raw: unknown;
          try { raw = JSON.parse(response.text); } catch { throw new Error("Output AI bukan JSON valid."); }
          const parsed = def.output.safeParse(normalizeModelJson(role, raw));
          if (!parsed.success) { validationError = parsed.error.message; throw new Error(`Validasi Zod gagal: ${validationError}`); }
          await db.aiRun.update({ where: { id: run.id }, data: { model, status: "success", inputTokens, outputTokens, durationMs: Math.round(performance.now() - start), output: JSON.parse(JSON.stringify(parsed.data)) } });
          options.onProgress?.({ stage: role, percent: 100, text: "Selesai" });
          return { data: parsed.data, runId: run.id, model, usage: { inputTokens, outputTokens } };
        } catch (e) { lastError = e instanceof Error ? e.message : String(e); }
      }
    }
    throw new Error(lastError);
  } catch (e) {
    await db.aiRun.update({ where: { id: run.id }, data: { status: "failed", error: lastError, inputTokens, outputTokens, durationMs: Math.round(performance.now() - start) } });
    throw e;
  }
}

export async function runAiRoleJson<R extends AiRole>(role: R, input: unknown, options: RunOptions = {}) {
  const result = await runAiRole(role, input, options);
  return { ...result, data: JSON.parse(JSON.stringify(result.data)) as Record<string, unknown> };
}
