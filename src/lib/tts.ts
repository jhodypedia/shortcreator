import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getAppSettings } from "./settings";
import { estimateLineDuration } from "./timing";

const execFileAsync = promisify(execFile);

export interface TtsResult {
  path: string; // path relatif ke storage, e.g. /api/storage/audio/...
  diskPath: string;
  durationSec: number;
  providerUsed: "edge-tts" | "openai" | "elevenlabs" | "local-fallback";
  notice?: string;
}

export async function measureAudioDurationSec(filePath: string): Promise<number> {
  // 1. Coba ukur langsung dari WAV header jika file .wav
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".wav") {
      const buf = await fs.readFile(filePath);
      if (buf.length >= 44 && buf.toString("ascii", 0, 4) === "RIFF") {
        const byteRate = buf.readUInt32LE(28);
        const dataOffset = buf.indexOf(Buffer.from("data"));
        if (dataOffset !== -1 && byteRate > 0) {
          const dataSize = buf.readUInt32LE(dataOffset + 4);
          const sec = dataSize / byteRate;
          if (sec > 0.05) return Number(sec.toFixed(2));
        }
      }
    }
  } catch {
    // lanjut ke ffprobe
  }

  // 2. Ukur memakai ffprobe dari sistem
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    const parsed = parseFloat(stdout.trim());
    if (!Number.isNaN(parsed) && parsed > 0.05) {
      return Number(parsed.toFixed(2));
    }
  } catch {
    // lanjut fallback ukuran file
  }

  // 3. Fallback estimasi minimal berdasarkan ukuran file MP3 ~16KB/s
  try {
    const stat = await fs.stat(filePath);
    return Number(Math.max(0.6, stat.size / 16000).toFixed(2));
  } catch {
    return 1.2;
  }
}

function buildSynthesizedSpeechWav(text: string, durationSec: number, pitchOffset = 0): Buffer {
  const sampleRate = 22050;
  const numSamples = Math.max(Math.round(sampleRate * durationSec), sampleRate / 2);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // PCM
  buffer.writeUInt16LE(1, 20); // Linear PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = Math.max(1, words.length);
  const baseFreq = 190 + pitchOffset * 6;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const progress = i / numSamples;
    const wordIdx = Math.min(wordCount - 1, Math.floor(progress * wordCount));
    const wordLocal = (progress * wordCount) % 1;
    // Envelope per kata agar ritme terdengar seperti suku kata
    const env =
      wordLocal < 0.1 || wordLocal > 0.85
        ? 0.05
        : Math.sin(((wordLocal - 0.1) / 0.75) * Math.PI) * 0.22;
    const freq = baseFreq + ((words[wordIdx]?.length ?? 4) % 5) * 18;
    const sample =
      (Math.sin(2 * Math.PI * freq * t) * 0.7 +
        Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.3) *
      env;
    const int16 = Math.max(-32767, Math.min(32767, Math.round(sample * 32767)));
    buffer.writeInt16LE(int16, 44 + i * 2);
  }

  return buffer;
}

export async function generateLineAudio(params: {
  episodeId: string;
  lineId: string;
  text: string;
  voiceId?: string;
  speed?: number;
  pitch?: number;
}): Promise<TtsResult> {
  const { publicSettings, secrets } = await getAppSettings();
  const provider = publicSettings.tts.provider;
  const voiceId = params.voiceId || publicSettings.tts.defaultVoiceId || "id-ID-ArdiNeural";
  const speed = params.speed ?? publicSettings.tts.defaultSpeed ?? 1.0;
  const pitch = params.pitch ?? publicSettings.tts.defaultPitch ?? 0;

  const dir = path.join(process.cwd(), "storage", "audio", params.episodeId);
  await fs.mkdir(dir, { recursive: true });

  // 1. OpenAI TTS
  if (provider === "openai" && secrets.ttsApiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secrets.ttsApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini-tts",
          voice: voiceId.startsWith("id-") ? "alloy" : voiceId,
          input: params.text,
          speed,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const fileName = `${params.lineId}.mp3`;
        const diskPath = path.join(dir, fileName);
        await fs.writeFile(diskPath, Buffer.from(await res.arrayBuffer()));
        const durationSec = await measureAudioDurationSec(diskPath);
        return {
          path: `/api/storage/audio/${params.episodeId}/${fileName}`,
          diskPath,
          durationSec,
          providerUsed: "openai",
        };
      }
    } catch {
      // jatuh ke fallback
    }
  }

  // 2. ElevenLabs TTS
  if (provider === "elevenlabs" && secrets.ttsApiKey) {
    try {
      const targetVoice = voiceId.startsWith("id-") ? "EXAVITQu4vr4xnSDxMaL" : voiceId;
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(targetVoice)}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": secrets.ttsApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: params.text,
            model_id: "eleven_multilingual_v2",
          }),
          signal: AbortSignal.timeout(20000),
        }
      );
      if (res.ok) {
        const fileName = `${params.lineId}.mp3`;
        const diskPath = path.join(dir, fileName);
        await fs.writeFile(diskPath, Buffer.from(await res.arrayBuffer()));
        const durationSec = await measureAudioDurationSec(diskPath);
        return {
          path: `/api/storage/audio/${params.episodeId}/${fileName}`,
          diskPath,
          durationSec,
          providerUsed: "elevenlabs",
        };
      }
    } catch {
      // jatuh ke fallback
    }
  }

  // 3. Edge-TTS (gratis tanpa key, bila online)
  if (provider === "edge-tts") {
    try {
      const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
      const tts = new MsEdgeTTS();
      await tts.setMetadata(voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(params.text, {
        rate: speed >= 1 ? `+${Math.round((speed - 1) * 100)}%` : `${Math.round((speed - 1) * 100)}%`,
        pitch: `${pitch >= 0 ? "+" : ""}${Math.round(pitch)}Hz`,
      });
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Edge-TTS timeout")), 15000);
        audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
        audioStream.on("end", () => {
          clearTimeout(timer);
          resolve();
        });
        audioStream.on("error", (err: Error) => {
          clearTimeout(timer);
          reject(err);
        });
      });
      if (chunks.length > 0) {
        const fileName = `${params.lineId}.mp3`;
        const diskPath = path.join(dir, fileName);
        await fs.writeFile(diskPath, Buffer.concat(chunks));
        const durationSec = await measureAudioDurationSec(diskPath);
        return {
          path: `/api/storage/audio/${params.episodeId}/${fileName}`,
          diskPath,
          durationSec,
          providerUsed: "edge-tts",
        };
      }
    } catch {
      // fallback offline
    }
  }

  if (provider === "local") {
    throw new Error("Provider TTS lokal hanya untuk audio panduan sintetis. Pilih Edge-TTS atau ElevenLabs/OpenAI, atau unggah rekaman manusia untuk suara natural.");
  }

  // Voice-guide fallback for failed remote TTS; never label this as natural speech.
  const fileName = `${params.lineId}.wav`;
  const diskPath = path.join(dir, fileName);
  const estDuration = estimateLineDuration(params.text, 0.4 / Math.max(0.6, speed));
  const wavBuffer = buildSynthesizedSpeechWav(params.text, estDuration, pitch);
  await fs.writeFile(diskPath, wavBuffer);
  const durationSec = await measureAudioDurationSec(diskPath);

  return {
    path: `/api/storage/audio/${params.episodeId}/${fileName}`,
    diskPath,
    durationSec,
    providerUsed: "local-fallback",
    notice:
      "TTS provider tidak tersedia — audio ini hanya suara panduan sintetis, bukan suara natural. Coba ulangi saat online atau unggah rekaman manusia.",
  };
}
