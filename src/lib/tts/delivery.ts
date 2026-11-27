import type { Delivery } from "./types";

const emotionTerms: Record<string, string> = { senang: "happy", gembira: "happy", sedih: "sad", marah: "angry", kaget: "surprised", takut: "fearful", curiga: "suspicious", netral: "calm", excited: "excited" };
const pace: Record<Delivery["pacing"], number> = { slow: 0.86, measured: 0.94, natural: 1, brisk: 1.08, fast: 1.16 };
export const emotionForProvider = (emotion: string) => emotionTerms[emotion.toLowerCase()] ?? "calm";

export function openAiInstructions(delivery: Delivery, characterStyle = "") {
  const emotion = emotionForProvider(delivery.emotion);
  return [`Speak in Indonesian with a ${emotion} emotion at ${Math.round(delivery.intensity * 100)}% intensity.`, `Pacing: ${delivery.pacing}.`, characterStyle, delivery.emphasisWords.length ? `Gently emphasize: ${delivery.emphasisWords.join(", ")}.` : "", delivery.nonverbal.length ? `Naturally include these vocal cues where appropriate: ${delivery.nonverbal.join(", ")}.` : ""].filter(Boolean).join(" ");
}

export function elevenLabsSettings(delivery: Delivery, speed = 1, jitter = 0) {
  const intensity = Math.max(0, Math.min(1, delivery.intensity));
  return { stability: Math.max(0.15, Math.min(0.9, 0.72 - intensity * 0.45 + jitter)), similarity_boost: 0.78, style: Math.min(1, intensity * 0.72), use_speaker_boost: true, speed: Math.max(0.7, Math.min(1.2, speed * pace[delivery.pacing])) };
}

const xml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const azureStyle: Record<string, string> = { happy: "cheerful", sad: "sad", angry: "angry", fearful: "fearful", calm: "calm", excited: "excited", surprised: "excited" };
export function azureSsml(input: { text: string; voiceId: string; language: string; delivery: Delivery; speed?: number; pitch?: number }) {
  const style = azureStyle[emotionForProvider(input.delivery.emotion)];
  const rate = Math.max(0.5, Math.min(2, (input.speed ?? 1) * pace[input.delivery.pacing]));
  const text = xml(input.text).replace(/\.\.\.|…/g, '<break time="450ms"/>').replace(/,\s*/g, '<break time="180ms"/>');
  const body = input.delivery.emphasisWords.reduce((acc, word) => acc.replace(new RegExp(`\\b(${word.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")})\\b`, "giu"), '<emphasis level="moderate">$1</emphasis>'), text);
  const voiceText = style ? `<mstts:express-as style="${style}" styledegree="${Math.max(0.1, Math.min(2, input.delivery.intensity * 2))}"><prosody rate="${rate}" pitch="${input.pitch ?? 0}Hz">${body}</prosody></mstts:express-as>` : `<prosody rate="${rate}" pitch="${input.pitch ?? 0}Hz">${body}</prosody>`;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${xml(input.language)}"><voice name="${xml(input.voiceId)}">${voiceText}</voice></speak>`;
}

export function googleInput(input: { text: string; language: string; delivery: Delivery }, supportsSsml: boolean) {
  if (!supportsSsml) return { input: { text: input.text } };
  const rate = pace[input.delivery.pacing];
  const emphasis = input.delivery.emphasisWords;
  let text = xml(input.text);
  for (const word of emphasis) text = text.replace(new RegExp(`\\b(${word.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")})\\b`, "giu"), "<emphasis level=\"strong\">$1</emphasis>");
  return { input: { ssml: `<speak><prosody rate="${rate}">${text}</prosody></speak>` } };
}

export function addEdgeExpressiveness(text: string, delivery: Delivery) {
  const prefix = delivery.nonverbal.includes("laugh") ? "Ha ha! " : delivery.nonverbal.includes("sigh") ? "Haa... " : delivery.nonverbal.includes("gasp") ? "Hah! " : "";
  const punctuated = delivery.emphasisWords.reduce((value, word) => value.replace(new RegExp(`\\b(${word.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")})\\b`, "giu"), "... $1!"), text);
  return `${prefix}${punctuated}`;
}
