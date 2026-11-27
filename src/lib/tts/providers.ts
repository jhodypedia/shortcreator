import type { TtsProvider, TtsVoice, SynthesizeInput, SynthesisResult } from "./types";
import { addEdgeExpressiveness, azureSsml, elevenLabsSettings, googleInput, openAiInstructions } from "./delivery";

const json = async (url: string, init: RequestInit) => {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${(await response.text()).slice(0, 240)}`);
  return response;
};
const voice = (id: string, name: string, rest: Partial<TtsVoice> = {}): TtsVoice => ({ id, name, ...rest });

export class OpenAiTtsProvider implements TtsProvider {
  readonly id = "openai" as const;
  async listVoices() {
    const names = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse", "marin", "cedar"];
    return names.map((id) => voice(id, id, { language: "multilingual", description: "OpenAI Speech API built-in voice" }));
  }
  async synthesize(input: SynthesizeInput): Promise<SynthesisResult> {
    const response = await json("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: input.model || "gpt-4o-mini-tts", voice: input.voiceId, input: input.text, instructions: openAiInstructions(input.delivery, input.style), speed: Math.max(0.25, Math.min(4, (input.speed ?? 1) * ({slow:.86,measured:.94,natural:1,brisk:1.08,fast:1.16}[input.delivery.pacing]))) }) });
    return { audio: Buffer.from(await response.arrayBuffer()) };
  }
}

export class ElevenLabsTtsProvider implements TtsProvider {
  readonly id = "elevenlabs" as const;
  private get key() { return process.env.TTS_API_KEY ?? ""; }
  async listVoices() {
    const all: TtsVoice[] = []; let page: string | undefined;
    do {
      const url = new URL("https://api.elevenlabs.io/v2/voices"); url.searchParams.set("page_size", "100"); if (page) url.searchParams.set("next_page_token", page);
      const res = await json(url.toString(), { headers: { "xi-api-key": this.key } });
      const data = await res.json() as { voices?: Array<Record<string, unknown>>; has_more?: boolean; next_page_token?: string };
      for (const item of data.voices ?? []) { const labels = item.labels as Record<string, string> | undefined; const languages = item.verified_languages as Array<Record<string, string>> | undefined; all.push(voice(String(item.voice_id), String(item.name), { gender: labels?.gender, age: labels?.age, language: languages?.map((v) => v.language).join(",") || labels?.language, accent: labels?.accent, description: String(item.description ?? ""), previewUrl: String(item.preview_url ?? "") })); }
      page = data.has_more ? data.next_page_token : undefined;
    } while (page && all.length < 500);
    return all;
  }
  async synthesize(input: SynthesizeInput) {
    const res = await json(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(input.voiceId)}?output_format=mp3_44100_128`, { method: "POST", headers: { "xi-api-key": input.apiKey ?? "", "Content-Type": "application/json" }, body: JSON.stringify({ text: input.text, model_id: input.model || "eleven_multilingual_v2", language_code: input.language.split("-")[0], voice_settings: elevenLabsSettings(input.delivery, input.speed, ((input.seed ?? Date.now()) % 101 - 50) / 1000), seed: input.seed, previous_text: input.previousText, next_text: input.nextText, apply_text_normalization: "auto" }) });
    return { audio: Buffer.from(await res.arrayBuffer()) };
  }
}

export class GoogleTtsProvider implements TtsProvider {
  readonly id = "google" as const;
  private get key() { return process.env.GOOGLE_TTS_API_KEY ?? process.env.TTS_API_KEY ?? ""; }
  async listVoices() {
    const data = await (await json(`https://texttospeech.googleapis.com/v1/voices?key=${encodeURIComponent(this.key)}`, {})).json() as { voices?: Array<Record<string, unknown>> };
    return (data.voices ?? []).map((item) => { const langs = item.languageCodes as string[] | undefined; const name = String(item.name); return voice(name, name, { gender: String(item.ssmlGender ?? "").toLowerCase(), language: langs?.join(","), description: `${String(item.name).includes("Chirp3-HD") ? "Chirp 3 HD" : String(item.name).includes("Studio") ? "Studio" : "Google Cloud TTS"}; ${String(item.naturalSampleRateHertz ?? "")}Hz`, metadata: { supportsSsml: !name.includes("Chirp3-HD"), name } }); });
  }
  async synthesize(input: SynthesizeInput) {
    const chirp = input.voiceId.includes("Chirp3-HD");
    const body = googleInput(input, false);
    const ssmlBody = googleInput(input, true);
    const request = (payload: ReturnType<typeof googleInput>) => json(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(input.apiKey ?? "")}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, voice: { languageCode: input.language, name: input.voiceId }, audioConfig: { audioEncoding: "MP3", ...(chirp ? {} : { speakingRate: ({slow:.86,measured:.94,natural:1,brisk:1.08,fast:1.16}[input.delivery.pacing]) }) } }) });
    let res: Response;
    try { res = await request(chirp ? body : ssmlBody); } catch (error) { if (chirp || !/SSML|speakingRate|unsupported/i.test(String(error))) throw error; res = await request(body); }
    const data = await res.json() as { audioContent: string };
    return { audio: Buffer.from(data.audioContent, "base64") };
  }
}

export class AzureTtsProvider implements TtsProvider {
  readonly id = "azure" as const;
  private get endpoint() { return process.env.AZURE_SPEECH_ENDPOINT || process.env.TTS_ENDPOINT || ""; }
  private get key() { return process.env.TTS_API_KEY ?? ""; }
  async listVoices() {
    if (!this.endpoint) throw new Error("Atur AZURE_SPEECH_ENDPOINT sebagai URL resource atau region Azure Speech.");
    const res = await json(`${this.endpoint.replace(/\/$/, "")}/tts/cognitiveservices/voices/list`, { headers: { "Ocp-Apim-Subscription-Key": process.env.TTS_API_KEY ?? "" } });
    const data = await res.json() as Array<Record<string, unknown>>;
    return data.map((item) => voice(String(item.ShortName), String(item.LocalName ?? item.DisplayName ?? item.ShortName), { gender: String(item.Gender ?? "").toLowerCase(), language: String(item.Locale ?? ""), description: String(item.VoiceType ?? "") + ((item.StyleList as string[] | undefined)?.length ? ` styles: ${(item.StyleList as string[]).join(",")}` : ""), metadata: { styles: item.StyleList ?? [], age: item.Age ?? "" } }));
  }
  async synthesize(input: SynthesizeInput) {
    const endpoint = input.endpoint ?? this.endpoint;
    if (!endpoint) throw new Error("Atur Azure Speech endpoint pada Pengaturan TTS.");
    const res = await json(`${endpoint.replace(/\/$/, "")}/cognitiveservices/v1`, { method: "POST", headers: { "Ocp-Apim-Subscription-Key": input.apiKey ?? "", "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-48khz-96kbitrate-mono-mp3", "User-Agent": "ShortGenerator" }, body: azureSsml({ text: input.text, voiceId: input.voiceId, language: input.language, delivery: input.delivery, speed: input.speed, pitch: input.pitch }) });
    return { audio: Buffer.from(await res.arrayBuffer()) };
  }
}

export class EdgeTtsProvider implements TtsProvider {
  readonly id = "edge-tts" as const;
  async listVoices() {
    const res = await json("https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=", {});
    const data = await res.json() as Array<Record<string, unknown>>;
    return data.map((item) => voice(String(item.ShortName), String(item.LocalName ?? item.Name), { gender: String(item.Gender ?? "").toLowerCase(), language: String(item.Locale ?? ""), accent: String(item.LocaleName ?? ""), description: String(item.VoiceTag ?? "") }));
  }
  async synthesize(input: SynthesizeInput) {
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts"); const tts = new MsEdgeTTS();
    await tts.setMetadata(input.voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const rate = Math.round(((input.speed ?? 1) - 1) * 100 + ({slow:-12,measured:-5,natural:0,brisk:7,fast:14}[input.delivery.pacing]));
    const { audioStream } = tts.toStream(addEdgeExpressiveness(input.text, input.delivery), { rate: `${rate >= 0 ? "+" : ""}${rate}%`, pitch: `${(input.pitch ?? 0) >= 0 ? "+" : ""}${Math.round(input.pitch ?? 0)}Hz` });
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => { audioStream.on("data", (chunk: Buffer) => chunks.push(chunk)); audioStream.on("end", resolve); audioStream.on("error", reject); });
    if (!chunks.length) throw new Error("Edge-TTS mengembalikan audio kosong");
    return { audio: Buffer.concat(chunks) };
  }
}

export const createTtsProvider = (id: TtsProvider["id"]): TtsProvider => ({ "openai": new OpenAiTtsProvider(), "elevenlabs": new ElevenLabsTtsProvider(), "google": new GoogleTtsProvider(), "azure": new AzureTtsProvider(), "edge-tts": new EdgeTtsProvider() })[id];
