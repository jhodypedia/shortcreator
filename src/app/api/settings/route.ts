import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAppSettings, saveAppSettings } from "@/lib/settings";
import { AiRoleSchema } from "@/lib/ai/types";
import { db } from "@/lib/db";
import { getAvailableVoices } from "@/lib/tts/catalog";
import { gflowStatus } from "@/lib/gflow";

const SettingsPatchSchema = z.object({
  ai: z
    .object({
      provider: z.enum(["9router", "openai", "anthropic", "local"]).optional(),
      baseUrl: z.string().optional(),
      model: z.string().optional(),
      apiKey: z.string().optional(),
      clearApiKey: z.boolean().optional(),
      roles: z.record(AiRoleSchema, z.object({ model: z.string().optional(), fallbackModel: z.string().optional(), temperature: z.number().min(0).max(2).optional(), maxTokens: z.number().int().positive().optional(), timeoutMs: z.number().int().positive().optional() })).optional(),
      maxCostPerEpisodeUsd: z.number().min(0).max(100).optional(),
      prompts: z.array(z.object({ role: AiRoleSchema, prompt: z.string().min(1), version: z.number().int().positive().optional() })).optional(),
    })
    .optional(),
  generation: z.record(z.string(), z.number()).optional(),
  tts: z
    .object({
      provider: z.enum(["edge-tts", "openai", "elevenlabs", "google", "azure", "local"]).optional(),
      model: z.string().optional(),
      apiKey: z.string().optional(),
      clearApiKey: z.boolean().optional(),
      defaultVoiceId: z.string().optional(),
      defaultSpeed: z.number().min(0.5).max(2).optional(),
      defaultPitch: z.number().min(-20).max(20).optional(),
      endpoint: z.string().optional(),
      audio: z.object({ trimSilence: z.boolean().optional(), loudnessLufs: z.number().min(-24).max(-12).optional(), compressor: z.boolean().optional(), sampleRate: z.union([z.literal(44100), z.literal(48000)]).optional(), crossfadeMs: z.number().int().min(0).max(150).optional(), maxRetries: z.number().int().min(0).max(2).optional() }).optional(),
    })
    .optional(),
  render: z
    .object({
      outputDir: z.string().optional(),
      fps: z.number().int().min(15).max(60).optional(),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      maxRetries: z.number().int().min(0).max(5).optional(),
      ffmpegPath: z.string().optional(),
      provider: z.enum(["remotion", "gflow-cli"]).optional(),
      gflowModel: z.enum(["veo-lite", "veo-lite-lp", "omni-1.2", "omni-1.2-flash", "omni-flash", "veo-fast", "veo-quality"]).optional(),
      gflowMaxCredits: z.number().int().min(1).max(10000).optional(),
    })
    .optional(),
});

export async function GET() {
  const { publicSettings } = await getAppSettings();
  let voices: Array<{ id: string; label: string; name?: string; gender?: string; age?: string; language?: string; accent?: string; description?: string; previewUrl?: string }> = [];
  try { voices = (await getAvailableVoices(publicSettings.tts.provider, { endpoint: publicSettings.tts.endpoint })).map((item) => ({ ...item, label: `${item.name}${item.language ? ` · ${item.language}` : ""}` })); } catch { /* settings still readable when provider catalog is offline */ }
  let gflow: Awaited<ReturnType<typeof gflowStatus>>;
  try { gflow = await gflowStatus(); } catch (error) { gflow = { installed: false, authenticated: false, detail: error instanceof Error ? error.message : "gflow status check failed" }; }
  return NextResponse.json({ settings: { ...publicSettings, render: { ...publicSettings.render, gflowReady: gflow.installed && gflow.authenticated } }, voices, gflow });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as { provider?: string; apiKey?: string; endpoint?: string; voiceId?: string; text?: string; emotion?: string; refresh?: boolean };
    const provider = z.enum(["edge-tts", "openai", "elevenlabs", "google", "azure"]).safeParse(body.provider);
    if (!provider.success) return NextResponse.json({ error: "Provider TTS tidak valid" }, { status: 400 });
    const settings = (await getAppSettings()).publicSettings;
    const apiKey = body.apiKey?.trim() || (provider.data === settings.tts.provider ? (await getAppSettings()).secrets.ttsApiKey : "");
    const voices = await getAvailableVoices(provider.data, { refresh: body.refresh ?? false, apiKey, endpoint: body.endpoint || settings.tts.endpoint });
    if (body.text && body.voiceId) {
      const { createTtsProvider } = await import("@/lib/tts/providers");
      const adapter = createTtsProvider(provider.data);
      const oldKey = process.env.TTS_API_KEY; const oldEndpoint = process.env.TTS_ENDPOINT; const oldAzureEndpoint = process.env.AZURE_SPEECH_ENDPOINT;
      const oldGoogleKey = process.env.GOOGLE_TTS_API_KEY;
      if (apiKey) process.env.TTS_API_KEY = apiKey;
      if (provider.data === "google") process.env.GOOGLE_TTS_API_KEY = apiKey;
      if (body.endpoint) process.env.TTS_ENDPOINT = body.endpoint;
      try {
      const result = await adapter.synthesize({ text: body.text, voiceId: body.voiceId, language: "id-ID", apiKey, endpoint: body.endpoint || settings.tts.endpoint, model: settings.tts.model, delivery: { emotion: body.emotion || "senang", intensity: 0.7, pacing: "natural", pauses: [], emphasisWords: [], nonverbal: [] } });
      const file = `storage/audio/preview-${Date.now()}.mp3`;
      const fs = await import("node:fs/promises"); const path = await import("node:path"); await fs.mkdir("storage/audio", { recursive: true }); await fs.writeFile(path.join(process.cwd(), file), result.audio);
      return NextResponse.json({ previewUrl: `/api/storage/audio/${file.replace(/^storage\//, "")}`, provider: provider.data, voiceCount: voices.length });
      } finally { process.env.TTS_API_KEY = oldKey; process.env.TTS_ENDPOINT = oldEndpoint; process.env.AZURE_SPEECH_ENDPOINT = oldAzureEndpoint; process.env.GOOGLE_TTS_API_KEY = oldGoogleKey; }
    }
    return NextResponse.json({ provider: provider.data, voices });
  } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Gagal menguji TTS" }, { status: 400 }); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SettingsPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Pengaturan tidak valid" },
        { status: 400 }
      );
    }

    const prompts = parsed.data.ai?.prompts;
    const aiSettings = parsed.data.ai ? Object.fromEntries(Object.entries(parsed.data.ai).filter(([key]) => key !== "prompts")) : undefined;
    const generation = parsed.data.generation;
    const settingsInput = { ...parsed.data, ai: aiSettings };
    delete (settingsInput as { generation?: unknown }).generation;
    await saveAppSettings(settingsInput);
    if (generation) for (const [key, value] of Object.entries(generation)) {
      if (!(key in (await getAppSettings()).publicSettings.generation)) continue;
      await db.appSetting.upsert({ where: { key: `generation.${key}` }, update: { value: String(value) }, create: { key: `generation.${key}`, value: String(value) } });
    }
    if (prompts) for (const item of prompts) {
      const previous = await db.promptPreset.findFirst({ where: { kind: "system", target: item.role }, orderBy: { updatedAt: "desc" } });
      const nextVersion = (previous ? Number((previous.payload as { version?: unknown })?.version ?? 1) : 0) + 1;
      await db.promptPreset.create({ data: { name: `System ${item.role} v${nextVersion}`, kind: "system", target: item.role, payload: { prompt: item.prompt, version: nextVersion, active: true } } });
      if (previous) await db.promptPreset.update({ where: { id: previous.id }, data: { payload: { ...((previous.payload as object) ?? {}), active: false } } });
    }
    return NextResponse.json({ settings: (await getAppSettings()).publicSettings });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menyimpan pengaturan" },
      { status: 500 }
    );
  }
}
