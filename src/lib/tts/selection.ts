import type { TtsVoice } from "./types";

export function selectCharacterVoice(voices: TtsVoice[], preferences: { age?: number; gender?: string; language?: string; traits?: string[]; excludedIds?: string[] }): TtsVoice | undefined {
  const excluded = new Set(preferences.excludedIds ?? []);
  return voices.filter((voice) => !excluded.has(voice.id)).map((voice) => {
    let score = 0;
    if (preferences.language && voice.language?.toLowerCase().includes(preferences.language.toLowerCase())) score += 8;
    else if (preferences.language && voice.language?.toLowerCase().startsWith(preferences.language.slice(0, 2).toLowerCase())) score += 8;
    if (preferences.gender && voice.gender?.toLowerCase() === preferences.gender.toLowerCase()) score += 4;
    const age = preferences.age;
    if (age !== undefined && voice.age) { const target = age < 18 ? "young" : age > 55 ? "old" : "middle"; if (voice.age.toLowerCase().includes(target)) score += 2; }
    for (const trait of preferences.traits ?? []) if (`${voice.description ?? ""} ${voice.name}`.toLowerCase().includes(trait.toLowerCase())) score += 1;
    return { voice, score };
  }).sort((a, b) => b.score - a.score || a.voice.id.localeCompare(b.voice.id))[0]?.voice;
}
