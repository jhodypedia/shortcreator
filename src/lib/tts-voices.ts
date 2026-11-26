import type { TtsProviderType } from "./settings";

export async function getAvailableVoices(provider: TtsProviderType): Promise<Array<{ id: string; label: string }>> {
  if (provider === "edge-tts") {
    const response = await fetch("https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=", { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Gagal memuat katalog voice Edge-TTS (${response.status}).`);
    const voices = await response.json() as Array<{ Name: string; ShortName: string; LocalName?: string }>;
    return voices.map((voice) => ({ id: voice.ShortName, label: voice.LocalName || voice.Name }));
  }
  return [];
}
