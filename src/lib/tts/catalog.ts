import { db } from "../db";
import { getAppSettings } from "../settings";
import { createTtsProvider } from "./providers";
import type { TtsProviderType } from "../settings";
import type { TtsVoice } from "./types";

export async function getAvailableVoices(providerId: TtsProviderType, options: { refresh?: boolean; apiKey?: string; endpoint?: string } = {}): Promise<TtsVoice[]> {
  if (providerId === "local") return [];
  const provider = createTtsProvider(providerId);
  const rows = await db.ttsVoiceCatalog.findMany({ where: { provider: providerId }, orderBy: { name: "asc" } });
  const fresh = rows.length > 0 && Date.now() - Math.max(...rows.map((row) => row.updatedAt.getTime())) < 24 * 60 * 60 * 1000;
  if (fresh && !options.refresh) return rows.map((row) => ({ id: row.id.slice(providerId.length + 1), name: row.name, gender: row.gender ?? undefined, age: row.age ?? undefined, language: row.language ?? undefined, accent: row.accent ?? undefined, description: row.description ?? undefined, previewUrl: row.previewUrl ?? undefined, metadata: row.metadata as Record<string, unknown> | undefined }));
  const { secrets, publicSettings } = await getAppSettings();
  const envApiKey = process.env.TTS_API_KEY;
  const envEndpoint = process.env.TTS_ENDPOINT;
  const envAzureEndpoint = process.env.AZURE_SPEECH_ENDPOINT;
  const envGoogleKey = process.env.GOOGLE_TTS_API_KEY;
  process.env.TTS_API_KEY = secrets.ttsApiKey;
  process.env.GOOGLE_TTS_API_KEY = providerId === "google" ? options.apiKey ?? secrets.ttsApiKey : envGoogleKey;
  if (providerId === "google") process.env.GOOGLE_TTS_API_KEY = options.apiKey ?? secrets.ttsApiKey;
  if (options.apiKey) process.env.TTS_API_KEY = options.apiKey;
  if (options.endpoint) process.env.TTS_ENDPOINT = options.endpoint;
  else if (providerId === "azure" && publicSettings.tts.endpoint) process.env.TTS_ENDPOINT = publicSettings.tts.endpoint;
  try { const voices = await provider.listVoices();
  await db.ttsVoiceCatalog.deleteMany({ where: { provider: providerId } });
  if (voices.length) await db.ttsVoiceCatalog.createMany({ data: voices.map((item) => ({ id: `${providerId}:${item.id}`, provider: providerId, name: item.name, gender: item.gender, age: item.age, language: item.language, accent: item.accent, description: item.description, previewUrl: item.previewUrl, metadata: item.metadata as object | undefined })) });
  return voices;
  } finally { process.env.TTS_API_KEY = envApiKey; process.env.TTS_ENDPOINT = envEndpoint; process.env.AZURE_SPEECH_ENDPOINT = envAzureEndpoint; process.env.GOOGLE_TTS_API_KEY = envGoogleKey; }
}
