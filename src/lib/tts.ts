import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getAppSettings } from "./settings";
import { createTtsProvider } from "./tts/providers";
import { getAvailableVoices } from "./tts/catalog";
import { normalizeIndonesianSpeech, splitNaturalChunks } from "./tts/normalize";
import type { Delivery } from "./tts/types";
import { assessAudioQuality } from "./tts/quality";
import { logActivity } from "./db";

const execFileAsync = promisify(execFile);
export type TtsResult = { path: string; diskPath: string; durationSec: number; providerUsed: string; notice?: string; spokenText: string; wordTimings?: Array<{ word: string; startSec: number; endSec: number }>; timingEstimated: boolean; cacheKey: string };
export async function measureAudioDurationSec(filePath: string): Promise<number> {
  try { const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath]); const value = Number.parseFloat(stdout.trim()); if (value > 0) return Number(value.toFixed(2)); } catch { /* use stat fallback */ }
  try { const stat = await fs.stat(filePath); return Math.max(0.5, Number((stat.size / 16000).toFixed(2))); } catch { return 1; }
}

const defaultDelivery: Delivery = { emotion: "netral", intensity: 0.5, pacing: "natural", pauses: [], emphasisWords: [], nonverbal: [] };
async function audioStats(filePath: string) {
  try {
    const { stdout } = await execFileAsync("ffmpeg", ["-v", "error", "-i", filePath, "-af", "silencedetect=noise=-48dB:d=0.08,astats=metadata=1:reset=0", "-f", "null", "-"], { maxBuffer: 1024 * 1024 });
    const duration = await measureAudioDurationSec(filePath); const silence = [...stdout.matchAll(/silence_duration: ([\d.]+)/g)].reduce((sum, item) => sum + Number(item[1]), 0); const peakMatch = stdout.match(/Peak level dB: (-?[\d.]+)/); const db = peakMatch ? Number(peakMatch[1]) : -3;
    return { durationSec: duration, silenceRatio: Math.min(1, silence / duration), peak: 10 ** (db / 20) };
  } catch { return { durationSec: await measureAudioDurationSec(filePath), silenceRatio: 0, peak: 0 }; }
}

export async function generateLineAudio(params: {
  episodeId: string; lineId: string; text: string; spokenText?: string; voiceId?: string; provider?: "edge-tts" | "openai" | "elevenlabs" | "google" | "azure"; language?: string; speed?: number; pitch?: number; style?: string; delivery?: Delivery; previousText?: string; nextText?: string; characterId?: string;
}): Promise<TtsResult> {
  const { publicSettings, secrets } = await getAppSettings();
  const providerId = params.provider ?? publicSettings.tts.provider;
  if (providerId === "local") throw new Error("Provider lokal tidak bisa mensintesis teks; pilih provider audio.");
  const voiceId = params.voiceId || publicSettings.tts.defaultVoiceId;
  if (!voiceId) throw new Error("Pilih suara untuk karakter sebelum membuat audio.");
  const delivery = params.delivery ?? defaultDelivery;
  const spokenText = params.spokenText ?? (params.language?.startsWith("id") !== false ? normalizeIndonesianSpeech(params.text) : params.text);
  const cacheText = params.spokenText ? `${params.text}\u0000${spokenText}` : spokenText;
  const hash = crypto.createHash("sha256").update(JSON.stringify({ text: cacheText, voiceId, delivery, providerId, speed: params.speed, pitch: params.pitch, style: params.style, previousText: params.previousText, nextText: params.nextText })).digest("hex");
  const dir = path.join(process.cwd(), "storage", "audio", params.episodeId); await fs.mkdir(dir, { recursive: true });
  const fileName = `${params.lineId}-${hash.slice(0, 12)}.mp3`; const diskPath = path.join(dir, fileName); const publicPath = `/api/storage/audio/${params.episodeId}/${fileName}`;
  if (await fs.stat(diskPath).then(() => true).catch(() => false)) return { path: publicPath, diskPath, durationSec: await measureAudioDurationSec(diskPath), providerUsed: providerId, spokenText, timingEstimated: true, cacheKey: hash };
  const apiKey = secrets.ttsApiKey;
  const providerKeys = new Map<string, string>([[providerId, apiKey]]);
  const fallbackOrder: Array<Exclude<typeof providerId, "local">> = providerId === "edge-tts" ? ["edge-tts"] : [providerId, "edge-tts"];
  const errors: string[] = []; let providerUsed = providerId; let quality: ReturnType<typeof assessAudioQuality> = { passed: false, issues: [] };
  const expected = Math.max(0.7, spokenText.split(/\s+/).length * 0.38);
  for (const candidate of fallbackOrder) {
    const adapter = createTtsProvider(candidate);
    let candidateVoiceId = voiceId;
    if (candidate !== providerId) {
      try {
        const fallbackSettings = await getAppSettings();
        providerKeys.set(candidate, fallbackSettings.secrets.ttsApiKey);
        const fallbackVoices = await getAvailableVoices(candidate);
        const chosen = fallbackVoices.find((item) => item.language?.toLowerCase().includes("id-id")) ?? fallbackVoices[0];
        if (!chosen) { errors.push(`${candidate}: katalog suara fallback kosong`); continue; }
        candidateVoiceId = chosen.id;
      } catch (error) { errors.push(`${candidate}: katalog suara gagal: ${error instanceof Error ? error.message : String(error)}`); continue; }
    }
    for (let attempt = 0; attempt <= publicSettings.tts.audio.maxRetries; attempt++) {
      try {
        const jitter = attempt ? (crypto.randomInt(0, 1001) / 1000 * 2 - 1) * 0.015 : 0;
        const candidateApiKey = providerKeys.get(candidate) ?? apiKey;
        const result = await adapter.synthesize({ text: spokenText, voiceId: candidateVoiceId, language: params.language ?? "id-ID", delivery: delivery ?? defaultDelivery, seed: crypto.randomInt(0, 0xffffffff), previousText: params.previousText, nextText: params.nextText, style: params.style, speed: (params.speed ?? publicSettings.tts.defaultSpeed) * (1 + jitter), pitch: (params.pitch ?? publicSettings.tts.defaultPitch) + jitter * 10, apiKey: candidateApiKey, model: publicSettings.tts.model, endpoint: publicSettings.tts.endpoint });
        const tmp = `${diskPath}.raw`; await fs.writeFile(tmp, result.audio);
        const filters = [publicSettings.tts.audio.trimSilence ? "silenceremove=start_periods=1:start_duration=0.08:start_threshold=-48dB:stop_periods=1:stop_duration=0.12:stop_threshold=-48dB" : "", publicSettings.tts.audio.compressor ? "acompressor=threshold=-18dB:ratio=2:attack=10:release=80" : "", `loudnorm=I=${publicSettings.tts.audio.loudnessLufs}:TP=-1.5:LRA=11`, "alimiter=limit=0.95"].filter(Boolean).join(",");
        await execFileAsync(publicSettings.render.ffmpegPath || "ffmpeg", ["-y", "-i", tmp, "-af", filters, "-ar", String(publicSettings.tts.audio.sampleRate), "-ac", "1", diskPath]);
        await fs.rm(tmp, { force: true });
        quality = assessAudioQuality(await audioStats(diskPath), expected);
        if (!quality.passed) { errors.push(`${candidate} attempt ${attempt + 1}: ${quality.issues.join(", ")}`); await fs.rm(diskPath, { force: true }); continue; }
        providerUsed = candidate; break;
      } catch (error) { errors.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    if (quality.passed) break;
  }
  if (!quality.passed) throw new Error(`Kualitas audio gagal setelah retry maksimal: ${errors.join("; ")}`);
  const durationSec = await measureAudioDurationSec(diskPath);
  const notice = providerUsed !== providerId ? `Provider ${providerId} gagal; audio dibuat dengan fallback ${providerUsed}. Lihat log TTS.` : errors.length ? `Audio lolos quality gate setelah retry: ${errors.join("; ")}` : undefined;
  if (notice) await logActivity({ episodeId: params.episodeId, level: "warning", message: `TTS ${providerId} → ${providerUsed}`, detail: `${notice} ${JSON.stringify({ lineId: params.lineId, requestedProvider: providerId, providerUsed, errors })}` });
  return { path: publicPath, diskPath, durationSec, providerUsed, notice, spokenText, timingEstimated: true, cacheKey: hash };
}

export { splitNaturalChunks };
