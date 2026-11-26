import crypto from "node:crypto";
import os from "node:os";
import { db } from "./db";
import { AiRoleSchema, ROLE_DEFAULTS, type AiRole, type AiRoleSettings } from "./ai/types";
import { GENERATION_DEFAULTS } from "./generation-config";

export type AiProviderType = "9router" | "openai" | "anthropic" | "local";
export type TtsProviderType = "edge-tts" | "openai" | "elevenlabs" | "local";

export interface AppSettingsData {
  ai: {
    provider: AiProviderType;
    baseUrl: string;
    model: string;
    ttsModel?: string;
    hasApiKey: boolean;
    maskedApiKey: string;
    roles: Record<AiRole, AiRoleSettings>;
    maxCostPerEpisodeUsd: number;
  };
  tts: {
    provider: TtsProviderType;
    model: string;
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
  generation: { [K in keyof typeof GENERATION_DEFAULTS]: number };
  prompts: Array<{ role: AiRole; prompt: string; version: number }>;
}

export const GENERATION_CONFIG_DEFAULTS = GENERATION_DEFAULTS;

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
  const promptRows = await db.promptPreset.findMany({ where: { kind: "system" }, orderBy: { updatedAt: "desc" } });

  const aiProvider = (map.get("ai.provider") ||
    process.env.AI_PROVIDER ||
    "9router") as AiProviderType;

  const defaultBaseUrl = process.env.AI_BASE_URL || "";

  const aiBaseUrl =
    map.get("ai.baseUrl") || process.env.AI_BASE_URL || defaultBaseUrl;
  const aiModel = map.get("ai.model") || process.env.AI_MODEL || "";

  const aiRawKey = map.get("ai.apiKey")
    ? decryptSecret(map.get("ai.apiKey")!)
    : process.env.AI_API_KEY || "";

  const roles = Object.fromEntries(AiRoleSchema.options.map((role) => {
    const defaults = ROLE_DEFAULTS[role];
    const parse = (field: keyof AiRoleSettings, fallback: string | number) => {
      const value = map.get(`ai.roles.${role}.${field}`);
      return value === undefined ? fallback : field === "temperature" || field === "maxTokens" || field === "timeoutMs" ? Number(value) : value;
    };
    return [role, {
      model: String(parse("model", aiModel)),
      fallbackModel: String(parse("fallbackModel", aiModel)),
      temperature: Number(parse("temperature", defaults.temperature)),
      maxTokens: Number(parse("maxTokens", defaults.maxTokens)),
      timeoutMs: Number(parse("timeoutMs", defaults.timeoutMs)),
    }];
  })) as Record<AiRole, AiRoleSettings>;

  const ttsProvider = (map.get("tts.provider") ||
    process.env.TTS_PROVIDER ||
    "edge-tts") as TtsProviderType;
  const ttsRawKey = map.get("tts.apiKey")
    ? decryptSecret(map.get("tts.apiKey")!)
    : process.env.TTS_API_KEY || "";

  const defaultVoiceId =
    map.get("tts.defaultVoiceId") || process.env.TTS_DEFAULT_VOICE || "";
  const defaultSpeed = Number(map.get("tts.defaultSpeed") || "1.0") || 1.0;
  const defaultPitch = Number(map.get("tts.defaultPitch") || "0") || 0;

  const outputDir =
    map.get("render.outputDir") || process.env.RENDER_OUTPUT_DIR || "";
  const fps = Number(map.get("render.fps") || process.env.RENDER_FPS || "0");
  const width = Number(map.get("render.width") || process.env.RENDER_WIDTH || "0");
  const height = Number(map.get("render.height") || process.env.RENDER_HEIGHT || "0");
  const maxRetries = Number(map.get("render.maxRetries") || process.env.RENDER_MAX_RETRIES || GENERATION_DEFAULTS.renderMaxRetries);
  const ffmpegPath = map.get("render.ffmpegPath") || process.env.FFMPEG_PATH || "ffmpeg";

  return {
    publicSettings: {
      ai: {
        provider: aiProvider,
        baseUrl: aiBaseUrl,
        model: aiModel,
        hasApiKey: Boolean(aiRawKey),
        maskedApiKey: maskSecret(aiRawKey),
        roles,
        maxCostPerEpisodeUsd: Number(map.get("ai.maxCostPerEpisodeUsd") || "0.5"),
      },
      tts: {
        provider: ttsProvider,
        model: map.get("tts.model") || process.env.TTS_MODEL || "",
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
      generation: { ...GENERATION_DEFAULTS, scriptLinesMin: Number(map.get("generation.scriptLinesMin") ?? GENERATION_DEFAULTS.scriptLinesMin), scriptLinesMax: Number(map.get("generation.scriptLinesMax") ?? GENERATION_DEFAULTS.scriptLinesMax), wordsPerLineMax: Number(map.get("generation.wordsPerLineMax") ?? GENERATION_DEFAULTS.wordsPerLineMax), episodeDurationMinSeconds: Number(map.get("generation.episodeDurationMinSeconds") ?? GENERATION_DEFAULTS.episodeDurationMinSeconds), episodeDurationMaxSeconds: Number(map.get("generation.episodeDurationMaxSeconds") ?? GENERATION_DEFAULTS.episodeDurationMaxSeconds), bulkEpisodesMax: Number(map.get("generation.bulkEpisodesMax") ?? GENERATION_DEFAULTS.bulkEpisodesMax), aiRetryCount: Number(map.get("generation.aiRetryCount") ?? GENERATION_DEFAULTS.aiRetryCount), aiTimeoutMs: Number(map.get("generation.aiTimeoutMs") ?? GENERATION_DEFAULTS.aiTimeoutMs), renderMaxRetries: Number(map.get("generation.renderMaxRetries") ?? GENERATION_DEFAULTS.renderMaxRetries), criticThreshold: Number(map.get("generation.criticThreshold") ?? GENERATION_DEFAULTS.criticThreshold) },
      prompts: promptRows.flatMap((row) => { const payload = row.payload as { prompt?: unknown; version?: unknown; active?: unknown } | string; const prompt = typeof payload === "string" ? payload : String(payload?.prompt ?? ""); return prompt && (typeof payload === "string" || payload.active !== false) ? [{ role: AiRoleSchema.parse(row.target), prompt, version: typeof payload === "string" ? 1 : Number(payload.version ?? 1) }] : []; }),
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
    roles?: Partial<Record<AiRole, Partial<AiRoleSettings>>>;
    maxCostPerEpisodeUsd?: number;
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
    if (input.ai.roles) {
      for (const [roleName, value] of Object.entries(input.ai.roles)) {
        const role = AiRoleSchema.parse(roleName);
        if (value.model !== undefined) ops.push({ key: `ai.roles.${role}.model`, value: value.model.trim() });
        if (value.fallbackModel !== undefined) ops.push({ key: `ai.roles.${role}.fallbackModel`, value: value.fallbackModel.trim() });
        for (const field of ["temperature", "maxTokens", "timeoutMs"] as const) if (value[field] !== undefined) ops.push({ key: `ai.roles.${role}.${field}`, value: String(value[field]) });
      }
    }
    if (input.ai.maxCostPerEpisodeUsd !== undefined) ops.push({ key: "ai.maxCostPerEpisodeUsd", value: String(input.ai.maxCostPerEpisodeUsd) });
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
