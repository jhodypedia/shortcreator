import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAppSettings } from "@/lib/settings";

const TestAiSchema = z.object({
  provider: z.enum(["9router", "openai", "anthropic", "local"]).optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
  apiKey: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = TestAiSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Input test koneksi tidak valid" }, { status: 400 });
    }

    const { publicSettings, secrets } = await getAppSettings();
    const provider = parsed.data.provider ?? publicSettings.ai.provider;
    const baseUrl = (parsed.data.baseUrl ?? publicSettings.ai.baseUrl).replace(/\/$/, "");
    const model = parsed.data.model ?? publicSettings.ai.model;
    const apiKey = parsed.data.apiKey?.trim() || secrets.aiApiKey;

    if (provider === "local") {
      return NextResponse.json({
        ok: true,
        message: "Mode template lokal aktif (tanpa API eksternal).",
      });
    }

    if (!baseUrl) {
      return NextResponse.json(
        { ok: false, error: "Base URL API router / provider wajib diisi." },
        { status: 400 }
      );
    }

    if (provider === "anthropic") {
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 16,
          messages: [{ role: "user", content: "Balas OK" }],
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        const txt = await res.text();
        return NextResponse.json(
          { ok: false, error: `Koneksi Anthropic gagal (${res.status}): ${txt.slice(0, 160)}` },
          { status: 400 }
        );
      }
      return NextResponse.json({
        ok: true,
        message: `Terhubung ke Anthropic (${model}).`,
      });
    }

    // 9router & OpenAI-compatible: cek /models dulu, lalu fallback /chat/completions
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const modelsUrl = baseUrl.endsWith("/v1")
      ? `${baseUrl}/models`
      : `${baseUrl}/v1/models`;

    const modelRes = await fetch(modelsUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);

    if (modelRes && modelRes.ok) {
      const data = await modelRes.json().catch(() => null);
      const count = Array.isArray(data?.data) ? data.data.length : 0;
      const modelsList = Array.isArray(data?.data)
        ? data.data.slice(0, 12).map((m: { id: string }) => m.id)
        : [];
      return NextResponse.json({
        ok: true,
        message: `Terhubung ke ${provider === "9router" ? "9router API Router" : "OpenAI-compatible"} (${count} model tersedia).`,
        models: modelsList,
      });
    }

    const chatUrl = baseUrl.endsWith("/v1")
      ? `${baseUrl}/chat/completions`
      : `${baseUrl}/v1/chat/completions`;
    const chatRes = await fetch(chatUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        max_tokens: 12,
        messages: [{ role: "user", content: "Balas OK" }],
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!chatRes.ok) {
      const txt = await chatRes.text();
      return NextResponse.json(
        {
          ok: false,
          error: `Gagal terhubung ke ${baseUrl} (${chatRes.status}): ${txt.slice(0, 180)}`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Koneksi ${provider} berhasil dengan model ${model}.`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? `Koneksi gagal: ${err.message}`
            : "Tidak dapat menjangkau endpoint API router",
      },
      { status: 500 }
    );
  }
}
