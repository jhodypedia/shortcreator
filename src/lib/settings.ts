import crypto from "node:crypto";
import os from "node:os";
import { db } from "./db";

export type AiProviderType = "9router" | "openai" | "anthropic" | "local";
export type TtsProviderType = "edge-tts" | "openai" | "elevenlabs" | "local";

export interface AppSettingsData {
  ai: {
    provider: AiProviderType;
    baseUrl: string;
    model: string;
    hasApiKey: boolean;
    maskedApiKey: string;
  };
  tts: {
    provider: TtsProviderType;
    hasApiKey: boolean;
    maskedApiKey: string;
    defaultVoiceId: string;
    defaultSpeed: number;
    defaultPitch: number;
  };
  render: {
    outputDir: string;
    fps: number;
    width: number;
    height: number;
    maxRetries: number;
    ffmpegPath: string;
  };
}

export interface ResolvedSecrets {
  aiApiKey: string;
  ttsApiKey: string;
}

function getCipherKey(): Buffer {
  const seed =
    process.env.SETTINGS_SECRET ||
    `short-gen-local-${os.hostname()}-${process.cwd()}`;
  return crypto.createHash("sha256").update(seed).digest();
}

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(stored: string): string {
  if (!stored) return "";
  if (!stored.startsWith("enc:")) return stored;
  try {
    const [, ivHex, tagHex, dataHex] = stored.split(":");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getCipherKey(),
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}

export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export async function getAppSettings(): Promise<{
  publicSettings: AppSettingsData;
  secrets: ResolvedSecrets;
}> {
  const rows = await db.appSetting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const aiProvider = (map.get("ai.provider") ||
    process.env.AI_PROVIDER ||
    "9router") as AiProviderType;

  const defaultBaseUrl =
    aiProvider === "9router"
      ? process.env.AI_BASE_URL || "http://localhost:20128/v1"
      : aiProvider === "anthropic"
        ? "https://api.anthropic.com"
        : "https://api.openai.com/v1";

  const aiBaseUrl =
    map.get("ai.baseUrl") || process.env.AI_BASE_URL || defaultBaseUrl;
  const aiModel =
    map.get("ai.model") ||
    process.env.AI_MODEL ||
    (aiProvider === "9router"
      ? "ag/gemini-2.5-flash"
      : aiProvider === "anthropic"
        ? "claude-3-5-sonnet-latest"
        : "gpt-4o-mini");

  const aiRawKey = map.get("ai.apiKey")
    ? decryptSecret(map.get("ai.apiKey")!)
    : process.env.AI_API_KEY || "";

  const ttsProvider = (map.get("tts.provider") ||
    process.env.TTS_PROVIDER ||
    "edge-tts") as TtsProviderType;
  const ttsRawKey = map.get("tts.apiKey")
    ? decryptSecret(map.get("tts.apiKey")!)
    : process.env.TTS_API_KEY || "";

  const defaultVoiceId =
    map.get("tts.defaultVoiceId") ||
    process.env.TTS_DEFAULT_VOICE ||
    "id-ID-ArdiNeural";
  const defaultSpeed = Number(map.get("tts.defaultSpeed") || "1.0") || 1.0;
  const defaultPitch = Number(map.get("tts.defaultPitch") || "0") || 0;

  const outputDir =
    map.get("render.outputDir") ||
    process.env.RENDER_OUTPUT_DIR ||
    "storage/renders";
  const fps = Number(map.get("render.fps") || process.env.RENDER_FPS || "30") || 30;
  const width = Number(map.get("render.width") || "1080") || 1080;
  const height = Number(map.get("render.height") || "1920") || 1920;
  const maxRetries = Number(map.get("render.maxRetries") || "2") || 2;
  const ffmpegPath =
    map.get("render.ffmpegPath") || process.env.FFMPEG_PATH || "/usr/bin/ffmpeg";

  return {
    publicSettings: {
      ai: {
        provider: aiProvider,
        baseUrl: aiBaseUrl,
        model: aiModel,
        hasApiKey: Boolean(aiRawKey),
        maskedApiKey: maskSecret(aiRawKey),
      },
      tts: {
        provider: ttsProvider,
        hasApiKey: Boolean(ttsRawKey),
        maskedApiKey: maskSecret(ttsRawKey),
        defaultVoiceId,
        defaultSpeed,
        defaultPitch,
      },
      render: {
        outputDir,
        fps,
        width,
        height,
        maxRetries,
        ffmpegPath,
      },
    },
    secrets: {
      aiApiKey: aiRawKey,
      ttsApiKey: ttsRawKey,
    },
  };
}

export async function saveAppSettings(input: {
  ai?: {
    provider?: AiProviderType;
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    clearApiKey?: boolean;
  };
  tts?: {
    provider?: TtsProviderType;
    apiKey?: string;
    clearApiKey?: boolean;
    defaultVoiceId?: string;
    defaultSpeed?: number;
    defaultPitch?: number;
  };
  render?: {
    outputDir?: string;
    fps?: number;
    width?: number;
    height?: number;
    maxRetries?: number;
    ffmpegPath?: string;
  };
}) {
  const ops: Array<{ key: string; value: string }> = [];

  if (input.ai) {
    if (input.ai.provider) {
      ops.push({ key: "ai.provider", value: input.ai.provider });
    }
    if (input.ai.baseUrl !== undefined) {
      ops.push({ key: "ai.baseUrl", value: input.ai.baseUrl.trim() });
    }
    if (input.ai.model !== undefined) {
      ops.push({ key: "ai.model", value: input.ai.model.trim() });
    }
    if (input.ai.clearApiKey) {
      await db.appSetting.deleteMany({ where: { key: "ai.apiKey" } });
    } else if (input.ai.apiKey && input.ai.apiKey.trim()) {
      ops.push({
        key: "ai.apiKey",
        value: encryptSecret(input.ai.apiKey.trim()),
      });
    }
  }

  if (input.tts) {
    if (input.tts.provider) {
      ops.push({ key: "tts.provider", value: input.tts.provider });
    }
    if (input.tts.defaultVoiceId !== undefined) {
      ops.push({
        key: "tts.defaultVoiceId",
        value: input.tts.defaultVoiceId.trim(),
      });
    }
    if (input.tts.defaultSpeed !== undefined) {
      ops.push({
        key: "tts.defaultSpeed",
        value: String(input.tts.defaultSpeed),
      });
    }
    if (input.tts.defaultPitch !== undefined) {
      ops.push({
        key: "tts.defaultPitch",
        value: String(input.tts.defaultPitch),
      });
    }
    if (input.tts.clearApiKey) {
      await db.appSetting.deleteMany({ where: { key: "tts.apiKey" } });
    } else if (input.tts.apiKey && input.tts.apiKey.trim()) {
      ops.push({
        key: "tts.apiKey",
        value: encryptSecret(input.tts.apiKey.trim()),
      });
    }
  }

  if (input.render) {
    if (input.render.outputDir !== undefined) {
      ops.push({
        key: "render.outputDir",
        value: input.render.outputDir.trim(),
      });
    }
    if (input.render.fps !== undefined) {
      ops.push({ key: "render.fps", value: String(input.render.fps) });
    }
    if (input.render.width !== undefined) {
      ops.push({ key: "render.width", value: String(input.render.width) });
    }
    if (input.render.height !== undefined) {
      ops.push({ key: "render.height", value: String(input.render.height) });
    }
    if (input.render.maxRetries !== undefined) {
      ops.push({
        key: "render.maxRetries",
        value: String(input.render.maxRetries),
      });
    }
    if (input.render.ffmpegPath !== undefined) {
      ops.push({
        key: "render.ffmpegPath",
        value: input.render.ffmpegPath.trim(),
      });
    }
  }

  for (const item of ops) {
    await db.appSetting.upsert({
      where: { key: item.key },
      update: { value: item.value },
      create: item,
    });
  }

  return (await getAppSettings()).publicSettings;
}
