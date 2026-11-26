import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAppSettings, saveAppSettings } from "@/lib/settings";

const SettingsPatchSchema = z.object({
  ai: z
    .object({
      provider: z.enum(["9router", "openai", "anthropic", "local"]).optional(),
      baseUrl: z.string().optional(),
      model: z.string().optional(),
      apiKey: z.string().optional(),
      clearApiKey: z.boolean().optional(),
    })
    .optional(),
  tts: z
    .object({
      provider: z.enum(["edge-tts", "openai", "elevenlabs", "local"]).optional(),
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
      width: z.number().int().min(360).max(2160).optional(),
      height: z.number().int().min(640).max(3840).optional(),
      maxRetries: z.number().int().min(0).max(5).optional(),
      ffmpegPath: z.string().optional(),
    })
    .optional(),
});

export async function GET() {
  const { publicSettings } = await getAppSettings();
  return NextResponse.json({ settings: publicSettings });
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

    const updated = await saveAppSettings(parsed.data);
    return NextResponse.json({ settings: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menyimpan pengaturan" },
      { status: 500 }
    );
  }
}
