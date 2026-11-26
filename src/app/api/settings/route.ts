import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAppSettings, saveAppSettings } from "@/lib/settings";
import { AiRoleSchema } from "@/lib/ai/types";
import { db } from "@/lib/db";
import { getAvailableVoices } from "@/lib/tts-voices";

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
      provider: z.enum(["edge-tts", "openai", "elevenlabs", "local"]).optional(),
      model: z.string().optional(),
      apiKey: z.string().optional(),
      clearApiKey: z.boolean().optional(),
      defaultVoiceId: z.string().optional(),
      defaultSpeed: z.number().min(0.5).max(2).optional(),
      defaultPitch: z.number().min(-20).max(20).optional(),
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
    })
    .optional(),
});

export async function GET() {
  const { publicSettings } = await getAppSettings();
  let voices: Array<{ id: string; label: string }> = [];
  try { voices = await getAvailableVoices(publicSettings.tts.provider); } catch { /* settings still readable when provider catalog is offline */ }
  return NextResponse.json({ settings: publicSettings, voices });
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
