import { SeriesBible } from "./schemas";

export type VideoModel =
  | "veo3"
  | "sora"
  | "kling"
  | "runway"
  | "pika"
  | "generic";

export type AspectRatio = "9:16" | "16:9" | "1:1";
export type PromptStyle = "sinematik" | "kartun" | "voxel" | "dokumenter";

export interface PromptShotInput {
  index: number;
  startSec: number;
  endSec: number;
  shotType: string;
  speaker: string;
  text: string;
  emotion: string;
  transition: string;
  setId?: string;
  note?: string;
}

export interface VideoPromptInput {
  seriesName: string;
  episodeTitle: string;
  bible: SeriesBible;
  style: PromptStyle;
  aspectRatio: AspectRatio;
  model: VideoModel;
  fps: number;
  shots: PromptShotInput[];
  includeNegative: boolean;
  includeAudio: boolean;
  language: "id" | "en";
}

export interface PromptSection {
  label: string;
  body: string;
}

export interface ShotPrompt {
  index: number;
  durationSec: number;
  shotType: string;
  heading: string;
  prompt: string;
  negativePrompt: string;
  camera: string;
  audio: string;
}

export interface VideoPromptResult {
  model: VideoModel;
  modelLabel: string;
  aspectRatio: AspectRatio;
  style: PromptStyle;
  globalPrompt: string;
  negativePrompt: string;
  continuityBlock: string;
  shots: ShotPrompt[];
  settings: PromptSection[];
  fullText: string;
}

const MODEL_LABEL: Record<VideoModel, string> = {
  veo3: "Google Veo 3",
  sora: "OpenAI Sora",
  kling: "Kling AI",
  runway: "Runway Gen-4",
  pika: "Pika 2.0",
  generic: "Model generik",
};

const MODEL_HINT: Record<VideoModel, string> = {
  veo3: "Sertakan dialog dalam tanda kutip dan deskripsi audio eksplisit (Veo 3 mendukung audio).",
  sora: "Gunakan narasi deskriptif panjang, satu paragraf koheren, tanpa daftar teknis.",
  kling: "Tekankan gerakan kamera dan konsistensi subjek, tambahkan motion strength sedang.",
  runway: "Spesifik soal lensa dan gerak kamera; hindari lebih dari 2 subjek utama.",
  pika: "Frasa pendek, satu aksi utama per klip, sebutkan gaya visual di awal.",
  generic: "Format bebas: subjek, aksi, latar, kamera, cahaya, gaya, durasi.",
};

const STYLE_HINT: Record<PromptStyle, string> = {
  sinematik:
    "cinematic 3D animation, shallow depth of field, volumetric lighting, subtle film grain, color-graded teal and amber",
  kartun:
    "stylized 3D cartoon, soft rounded shapes, saturated palette, clean outlines, playful squash and stretch",
  voxel:
    "blocky voxel 3D world, cubic geometry, crisp ambient occlusion, toy-like materials, saturated colors",
  dokumenter:
    "photoreal documentary look, natural handheld camera, available light, realistic textures, 35mm lens",
};

const EMOTION_EN: Record<string, string> = {
  netral: "neutral expression",
  senang: "happy, bright smile",
  kaget: "shocked, wide eyes",
  sedih: "sad, downcast eyes",
  marah: "angry, furrowed brows",
  mikir: "thoughtful, thinking pose",
};

const SHOT_EN: Record<string, string> = {
  wide: "wide establishing shot",
  medium: "medium shot",
  "close-up": "close-up shot",
  "over-shoulder": "over-the-shoulder shot",
  "low-angle": "low angle shot",
  "high-angle": "high angle shot",
  "dolly-in": "slow dolly-in",
  pan: "smooth lateral pan",
};

const SHOT_ID: Record<string, string> = {
  wide: "wide shot pembuka",
  medium: "medium shot",
  "close-up": "close-up",
  "over-shoulder": "over-the-shoulder",
  "low-angle": "low angle",
  "high-angle": "high angle",
  "dolly-in": "dolly-in perlahan",
  pan: "pan menyamping halus",
};

export function describeCharacter(
  bible: SeriesBible,
  name: string,
  language: "id" | "en"
): string {
  const character = bible.characters.find((c) => c.name === name);
  if (!character) return name;
  if (language === "en") {
    return `${character.name} (${character.role}, ${character.traits.join(", ")}, primary color ${character.colorPrimary})`;
  }
  return `${character.name} (${character.role}, ${character.traits.join(", ")}, warna utama ${character.colorPrimary})`;
}

export function describeSet(
  bible: SeriesBible,
  setId: string | undefined,
  language: "id" | "en"
): string {
  const set = bible.sets.find((s) => s.id === setId) ?? bible.sets[0];
  if (!set) return language === "en" ? "unspecified location" : "lokasi belum ditentukan";
  if (language === "en") {
    return `${set.name} — ${set.template} template, ${set.lighting} lighting, mood ${set.mood}, palette ${set.palette.join("/")}`;
  }
  return `${set.name} — template ${set.template}, pencahayaan ${set.lighting}, suasana ${set.mood}, palet ${set.palette.join("/")}`;
}

function buildShotPrompt(params: {
  input: VideoPromptInput;
  shot: PromptShotInput;
  speakerDesc: string;
  setDesc: string;
}): ShotPrompt {
  const { input, shot, speakerDesc, setDesc } = params;
  const en = input.language === "en";
  const duration = Math.max(0.5, Number((shot.endSec - shot.startSec).toFixed(2)));
  const shotPhrase = en ? SHOT_EN[shot.shotType] ?? shot.shotType : SHOT_ID[shot.shotType] ?? shot.shotType;
  const emotion = en ? EMOTION_EN[shot.emotion] ?? shot.emotion : shot.emotion;
  const style = STYLE_HINT[input.style];

  const parts: string[] = [];
  if (en) {
    parts.push(`${shotPhrase}, ${duration}s, ${input.aspectRatio}, ${input.fps}fps.`);
    parts.push(`Subject: ${speakerDesc}. Expression: ${emotion}.`);
    parts.push(`Setting: ${setDesc}.`);
    parts.push(`Action: ${shot.text}.`);
    if (input.includeAudio) {
      parts.push(
        `Audio: ${shot.speaker} says "${shot.text}" in Indonesian, clear close-mic voice, subtle room tone.`
      );
    }
    parts.push(`Style: ${style}.`);
    parts.push(`Camera: ${shot.note ? `${shot.note}; ` : ""}steady, ${shotPhrase}.`);
    if (shot.transition === "fade") parts.push("End with a soft fade.");
  } else {
    parts.push(`${shotPhrase}, durasi ${duration} detik, rasio ${input.aspectRatio}, ${input.fps} fps.`);
    parts.push(`Subjek: ${speakerDesc}. Ekspresi: ${emotion}.`);
    parts.push(`Latar: ${setDesc}.`);
    parts.push(`Aksi: ${shot.text}.`);
    if (input.includeAudio) {
      parts.push(`Audio: ${shot.speaker} mengucapkan "${shot.text}" dalam Bahasa Indonesia, suara jernih, room tone halus.`);
    }
    parts.push(`Gaya: ${style}.`);
    parts.push(`Kamera: ${shot.note ? `${shot.note}; ` : ""}stabil, ${shotPhrase}.`);
    if (shot.transition === "fade") parts.push("Akhiri dengan fade lembut.");
  }

  const negative = input.includeNegative
    ? en
      ? "blurry, distorted faces, extra limbs, watermark, text overlay, logo, low resolution, flickering, jittery motion, oversaturated skin, morphing geometry, duplicate characters"
      : "buram, wajah rusak, anggota badan berlebih, watermark, tulisan menempel, logo, resolusi rendah, berkedip, gerakan goyang, warna kulit berlebihan, geometri berubah bentuk, karakter ganda"
    : "";

  return {
    index: shot.index,
    durationSec: duration,
    shotType: shot.shotType,
    heading: `${en ? "Shot" : "Bidikan"} ${shot.index} · ${shotPhrase} · ${duration}s`,
    prompt: parts.join(" "),
    negativePrompt: negative,
    camera: shot.note || shotPhrase,
    audio: input.includeAudio ? `${shot.speaker}: "${shot.text}"` : "",
  };
}

export function buildVideoPrompts(input: VideoPromptInput): VideoPromptResult {
  const en = input.language === "en";
  const setDefault = input.shots[0]?.setId;

  const speakers = Array.from(new Set(input.shots.map((s) => s.speaker)));
  const castLine = speakers
    .map((name) => describeCharacter(input.bible, name, input.language))
    .join(en ? "; " : "; ");
  const setDesc = describeSet(input.bible, setDefault, input.language);
  const style = STYLE_HINT[input.style];

  const globalPrompt = en
    ? [
        `${input.seriesName} — episode "${input.episodeTitle}".`,
        `Vertical ${input.aspectRatio} short-form animation, ${input.fps}fps, ${input.shots.length} shots, total ${input.shots.reduce((sum, s) => sum + (s.endSec - s.startSec), 0).toFixed(1)}s.`,
        `Premise: ${input.bible.premise}`,
        `Cast: ${castLine}.`,
        `Main location: ${setDesc}.`,
        `Visual style: ${style}.`,
        `Continuity: ${input.bible.continuity.summary}`,
        MODEL_HINT[input.model],
      ].join(" ")
    : [
        `${input.seriesName} — episode "${input.episodeTitle}".`,
        `Animasi vertikal ${input.aspectRatio} untuk short-form, ${input.fps} fps, ${input.shots.length} bidikan, total ${input.shots.reduce((sum, s) => sum + (s.endSec - s.startSec), 0).toFixed(1)} detik.`,
        `Premis: ${input.bible.premise}`,
        `Pemain: ${castLine}.`,
        `Lokasi utama: ${setDesc}.`,
        `Gaya visual: ${style}.`,
        `Kontinuitas: ${input.bible.continuity.summary}`,
        MODEL_HINT[input.model],
      ].join(" ");

  const negativePrompt = input.includeNegative
    ? en
      ? "blurry, distorted faces, extra limbs, watermark, burned-in subtitles, logo, low resolution, flicker, morphing geometry, duplicate characters, text artifacts"
      : "buram, wajah rusak, anggota badan berlebih, watermark, subtitle menempel, logo, resolusi rendah, kedip, geometri berubah, karakter ganda, artefak teks"
    : "";

  const continuityBlock = en
    ? [
        `Active cliffhanger: ${input.bible.continuity.activeCliffhanger || "-"}`,
        `Open threads: ${input.bible.continuity.threads.join(" | ") || "-"}`,
        `Never do: ${input.bible.neverDo.join(" | ") || "-"}`,
      ].join("\n")
    : [
        `Cliffhanger aktif: ${input.bible.continuity.activeCliffhanger || "-"}`,
        `Benang terbuka: ${input.bible.continuity.threads.join(" | ") || "-"}`,
        `Pantangan: ${input.bible.neverDo.join(" | ") || "-"}`,
      ].join("\n");

  const shots = input.shots.map((shot) =>
    buildShotPrompt({
      input,
      shot,
      speakerDesc: describeCharacter(input.bible, shot.speaker, input.language),
      setDesc: describeSet(input.bible, shot.setId ?? setDefault, input.language),
    })
  );

  const settings: PromptSection[] = [
    { label: en ? "Model" : "Model", body: MODEL_LABEL[input.model] },
    { label: en ? "Aspect ratio" : "Rasio aspek", body: input.aspectRatio },
    { label: en ? "Frame rate" : "Frame rate", body: `${input.fps} fps` },
    {
      label: en ? "Shot count" : "Jumlah bidikan",
      body: String(shots.length),
    },
    {
      label: en ? "Total duration" : "Total durasi",
      body: `${input.shots.reduce((sum, s) => sum + (s.endSec - s.startSec), 0).toFixed(1)}s`,
    },
    { label: en ? "Style" : "Gaya", body: input.style },
  ];

  const fullText = [
    `${en ? "GLOBAL PROMPT" : "PROMPT GLOBAL"}\n${globalPrompt}`,
    negativePrompt ? `${en ? "NEGATIVE PROMPT" : "NEGATIVE PROMPT"}\n${negativePrompt}` : "",
    `${en ? "CONTINUITY" : "KONTINUITAS"}\n${continuityBlock}`,
    ...shots.map((shot) => `${shot.heading}\n${shot.prompt}${shot.negativePrompt ? `\nNegative: ${shot.negativePrompt}` : ""}`),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    model: input.model,
    modelLabel: MODEL_LABEL[input.model],
    aspectRatio: input.aspectRatio,
    style: input.style,
    globalPrompt,
    negativePrompt,
    continuityBlock,
    shots,
    settings,
    fullText,
  };
}

export interface ScriptPromptInput {
  seriesName: string;
  tone: string;
  audience: string;
  premise: string;
  activeCliffhanger?: string | null;
  characters: Array<{ name: string; role: string; traits: string[] }>;
  locations: string[];
  neverDo: string[];
  targetDurationSec: number;
  episodeIdea?: string;
}

export interface ScriptPromptResult {
  systemPrompt: string;
  userPrompt: string;
  jsonContract: string;
  fullText: string;
}

export function buildScriptPrompts(input: ScriptPromptInput): ScriptPromptResult {
  const linesBudget = Math.max(6, Math.round(input.targetDurationSec / 4));

  const systemPrompt = [
    `Kamu penulis naskah YouTube Shorts animasi 3D berbahasa Indonesia untuk serial "${input.seriesName}".`,
    `Audiens: ${input.audience}. Tone: ${input.tone}.`,
    "Aturan wajib:",
    "1. Hook harus selesai dalam 3 detik pertama, tanpa sapaan generik seperti 'halo guys'.",
    "2. Setiap baris dialog maksimal 10 kata agar bisa ditampung satu bidikan.",
    "3. Struktur wajib: hook → setup → konflik → twist → payoff, lalu cliffhanger baru.",
    "4. Jangan meniru naskah kreator lain; tulis orisinal dan transformatif.",
    `5. Panjang total sekitar ${input.targetDurationSec} detik (${linesBudget} baris dialog).`,
    input.neverDo.length ? `6. Pantangan seri: ${input.neverDo.join("; ")}.` : "",
    "Balas HANYA JSON valid tanpa penjelasan tambahan.",
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = [
    `Premis serial: ${input.premise}`,
    `Karakter: ${input.characters.map((c) => `${c.name} (${c.role}; ${c.traits.join(", ")})`).join(" | ")}`,
    `Lokasi tersedia: ${input.locations.join(", ") || "-"}`,
    input.activeCliffhanger ? `WAJIB menjawab cliffhanger sebelumnya: ${input.activeCliffhanger}` : "",
    input.episodeIdea ? `Ide episode dari kreator: ${input.episodeIdea}` : "",
    `Tulis ${linesBudget} baris dialog dan lengkapi field episode.`,
  ]
    .filter(Boolean)
    .join("\n");

  const jsonContract = `{
  "title": "judul episode singkat",
  "hook": "kalimat hook 1 baris",
  "conflict": "konflik utama",
  "twist": "twist tak terduga",
  "payoff": "resolusi singkat",
  "cliffhanger": "pengait episode berikutnya",
  "lines": [
    {
      "beat": "hook | setup | konflik | twist | payoff",
      "speaker": "nama karakter",
      "text": "dialog maksimal 10 kata",
      "emotion": "netral | senang | kaget | sedih | marah | mikir"
    }
  ]
}`;

  return {
    systemPrompt,
    userPrompt,
    jsonContract,
    fullText: `SYSTEM PROMPT\n${systemPrompt}\n\nUSER PROMPT\n${userPrompt}\n\nJSON CONTRACT\n${jsonContract}`,
  };
}

export const VIDEO_MODEL_LABELS = MODEL_LABEL;
