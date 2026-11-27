import { runAiRole } from "./ai/runner";
import { SeriesBible, ScriptLine, ScriptLineSchema, BulkOutlineItemSchema, BulkOutlineItem } from "./schemas";
import { estimateLineDuration } from "./timing";
import { ContinuitySnapshot } from "./continuity";
import { getAppSettings } from "./settings";
import { GENERATION_DEFAULTS } from "./generation-config";

export interface HookIdea { hook: string; conflict: string; twist: string; payoff: string; cliffhanger: string }
const asArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : (() => { throw new Error("Respons AI harus berupa array JSON."); })();
function storyContext(bible: SeriesBible) {
  return JSON.stringify({ premise: bible.premise, world: bible.world, characters: bible.characters, sets: bible.sets.map((set) => ({ id: set.id, name: set.name, stagePoints: set.stagePoints })), neverDo: bible.neverDo, continuity: bible.continuity });
}

export async function generateHookIdeas(params: { seriesName: string; tone: string; bible: SeriesBible; continuity?: ContinuitySnapshot | null }): Promise<{ ideas: HookIdea[]; source: "ai" }> {
  const input = { idea: JSON.stringify({ series: params.seriesName, tone: params.tone, context: storyContext(params.bible), continuity: params.continuity }) };
  const { data } = await runAiRole("ideaGenerator", input);
  return { ideas: asArray<HookIdea>(data), source: "ai" };
}

export async function generateScriptLines(params: { seriesName: string; tone: string; bible: SeriesBible; title: string; hook: string; conflict: string; twist: string; payoff?: string; cliffhanger: string; cliffhangerFrom?: string | null }): Promise<{ lines: ScriptLine[]; source: "ai" }> {
  const settings = await getAppSettings();
  const lineLimit = Number(settings.publicSettings.generation.scriptLinesMax ?? GENERATION_DEFAULTS.scriptLinesMax);
  const wordLimit = Number(settings.publicSettings.generation.wordsPerLineMax ?? GENERATION_DEFAULTS.wordsPerLineMax);
  const requestedSetId = params.bible.sets[0]?.id;
  const selectedSet = params.bible.sets.find((set) => set.id === requestedSetId);
  if (!selectedSet) throw new Error("Bible belum memiliki set aktif dengan stagePoints.");
  const context = storyContext(params.bible);
  const prompt = JSON.stringify({ series: params.seriesName, tone: params.tone, title: params.title, story: { hook: params.hook, conflict: params.conflict, twist: params.twist, payoff: params.payoff, cliffhanger: params.cliffhanger, cliffhangerFrom: params.cliffhangerFrom }, bible: context, activeSet: selectedSet, allowedSpeakers: params.bible.characters.map((character) => character.name), allowedStagePoints: Object.keys(selectedSet.stagePoints ?? {}), constraints: { requestedBeatCount: lineLimit, maxWordsPerBeat: wordLimit, minDurationSeconds: settings.publicSettings.generation.episodeDurationMinSeconds, maxDurationSeconds: settings.publicSettings.generation.episodeDurationMaxSeconds } });
  const { data } = await runAiRole("scriptwriter", { idea: prompt, bible: params.bible });
  const beats = data && typeof data === "object" && "beats" in data ? asArray<Record<string, unknown>>((data as { beats: unknown }).beats) : asArray<Record<string, unknown>>(data);
  const lines = await Promise.all(beats.map(async (beat, index) => {
    const spoken = await runAiRole("ttsPrep", { text: String(beat.text ?? ""), language: "id-ID" });
    const spokenText = typeof spoken.data === "object" && spoken.data && "spokenText" in spoken.data ? String((spoken.data as { spokenText: unknown }).spokenText) : String(beat.text ?? "");
    return ScriptLineSchema.parse({ ...beat, spokenText, id: String(beat.id ?? `line-${index + 1}`), durationSec: Number(beat.durationSec ?? estimateLineDuration(String(beat.text))), setId: String(beat.setId ?? selectedSet.id) });
  }));
  const speakers = new Set(params.bible.characters.map((character) => character.name));
  const stagePoints = new Set(Object.keys(selectedSet.stagePoints ?? {}));
  for (const line of lines) {
    if (!speakers.has(line.speaker)) throw new Error(`AI memilih speaker di luar Bible: ${line.speaker}`);
    if (line.moveTo && !stagePoints.has(line.moveTo)) throw new Error(`AI memilih moveTo di luar stagePoints set: ${line.moveTo}`);
    if (line.lookAt && !speakers.has(line.lookAt)) throw new Error(`AI memilih lookAt di luar karakter Bible: ${line.lookAt}`);
    if (line.text.trim().split(/\s+/).length > wordLimit) throw new Error(`Beat melampaui batas ${wordLimit} kata.`);
  }
  return { lines, source: "ai" };
}

export async function generateBulkOutlines(params: { seriesName: string; tone: string; bible: SeriesBible; fromEps: number; toEps: number; continuity?: ContinuitySnapshot | null }): Promise<{ outlines: BulkOutlineItem[]; source: "ai" }> {
  const settings = await getAppSettings();
  const maxEpisodes = Number(settings.publicSettings.generation.bulkEpisodesMax ?? GENERATION_DEFAULTS.bulkEpisodesMax);
  const count = params.toEps - params.fromEps + 1;
  if (count < 1 || count > maxEpisodes) throw new Error(`Rentang harus antara 1 dan ${maxEpisodes} episode.`);
  const prompt = JSON.stringify({ series: params.seriesName, tone: params.tone, bible: storyContext(params.bible), continuity: params.continuity, fromEpisode: params.fromEps, toEpisode: params.toEps, count });
  const { data } = await runAiRole("outlineGenerator", { idea: prompt, bible: params.bible });
  const outlines = asArray<unknown>(data).map((item, index) => BulkOutlineItemSchema.parse({ ...(item as object), number: params.fromEps + index, continuityChecked: false }));
  if (outlines.length !== count) throw new Error(`AI menghasilkan ${outlines.length} outline, seharusnya ${count}.`);
  return { outlines, source: "ai" };
}

export { generateEpisodePackage } from "./ai/workflow";
