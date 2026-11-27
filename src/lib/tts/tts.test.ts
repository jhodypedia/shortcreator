import { describe, expect, it } from "vitest";
import { normalizeIndonesianSpeech, splitNaturalChunks } from "./normalize";
import { selectCharacterVoice } from "./selection";
import { azureSsml, elevenLabsSettings, openAiInstructions, googleInput } from "./delivery";
import { assessAudioQuality } from "./quality";

const delivery = (emotion: string) => ({ emotion, intensity: 0.8, pacing: "brisk" as const, pauses: [], emphasisWords: ["serius"], nonverbal: ["laugh"] as Array<"laugh"> });
describe("TTS preparation and adapters", () => {
  it("normalizes Indonesian digits while preserving informal words", () => expect(normalizeIndonesianSpeech("Aku punya 2 item, gak banget sih!")).toBe("Aku punya dua item, gak banget sih!"));
  it("splits long text at natural sentence boundaries", () => expect(splitNaturalChunks("Satu kalimat. Kalimat berikutnya.", 20)).toEqual(["Satu kalimat.", "Kalimat berikutnya."]));
  it("chooses voice from catalog matching language and gender", () => expect(selectCharacterVoice([{ id: "a", name: "A", language: "en-US", gender: "female" }, { id: "b", name: "B", language: "id-ID", gender: "male" }], { language: "id-ID", gender: "male" })?.id).toBe("b"));
  it("maps delivery to supported provider controls", () => {
    expect(openAiInstructions(delivery("senang"))).toContain("happy");
    expect(openAiInstructions(delivery("sedih"))).toContain("sad");
    expect(elevenLabsSettings(delivery("marah")).style).toBeGreaterThan(0);
    const happy = azureSsml({ text: "Halo", voiceId: "voice", language: "id-ID", delivery: delivery("senang") });
    const sad = azureSsml({ text: "Halo", voiceId: "voice", language: "id-ID", delivery: delivery("sedih") });
    expect(happy).toContain('style="cheerful"');
    expect(sad).toContain('style="sad"');
    expect(googleInput({ text: "Halo", language: "id-ID", delivery: delivery("sedih") }, false).input).toEqual({ text: "Halo" });
  });
  it("rejects clipping, excessive silence, and abnormal duration", () => {
    expect(assessAudioQuality({ durationSec: 0.2, silenceRatio: 0.7, peak: 1 }, 3).passed).toBe(false);
    expect(assessAudioQuality({ durationSec: 3, silenceRatio: 0.1, peak: 0.8 }, 3).passed).toBe(true);
  });
});
