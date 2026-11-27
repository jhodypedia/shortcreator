import type { TtsProviderType } from "../settings";

export type Delivery = {
  emotion: string;
  intensity: number;
  pacing: "slow" | "measured" | "natural" | "brisk" | "fast";
  pauses: Array<{ after: string; durationMs: number }>;
  emphasisWords: string[];
  nonverbal: Array<"laugh" | "sigh" | "gasp" | "breath" | "whisper">;
};

export type TtsVoice = {
  id: string;
  name: string;
  gender?: string;
  age?: string;
  language?: string;
  accent?: string;
  description?: string;
  previewUrl?: string;
  metadata?: Record<string, unknown>;
};

export type SynthesizeInput = {
  text: string;
  voiceId: string;
  language: string;
  delivery: Delivery;
  seed?: number;
  previousText?: string;
  nextText?: string;
  style?: string;
  speed?: number;
  pitch?: number;
  apiKey?: string;
  model?: string;
  endpoint?: string;
};

export type SynthesisResult = { audio: Buffer; wordTimings?: Array<{ word: string; startSec: number; endSec: number }> };
export interface TtsProvider {
  readonly id: Exclude<TtsProviderType, "local">;
  listVoices(): Promise<TtsVoice[]>;
  synthesize(input: SynthesizeInput): Promise<SynthesisResult>;
}
