import { runAiRoleJson, type AiProgressEvent } from "./runner";
import { ROLE_DEFINITIONS } from "./roles";
import { ActionTypeSchema } from "../technical-registry";
import { GENERATION_DEFAULTS } from "../generation-config";
import { getAppSettings } from "../settings";
import { normalizeIndonesianSpeech } from "../tts/normalize";

export async function generateEpisodePackage(params: { idea: string; bible: unknown; characters: unknown[]; sets: Array<{ id: string }>; onProgress?: (progress: AiProgressEvent) => void; criticThreshold?: number }) {
  const generation = (await getAppSettings()).publicSettings.generation;
  const threshold = params.criticThreshold ?? generation.criticThreshold ?? GENERATION_DEFAULTS.criticThreshold;
  let script = (await runAiRoleJson("scriptwriter", { idea: params.idea, bible: params.bible }, { onProgress: params.onProgress })).data;
  const scriptBeats = Array.isArray(script.beats) ? script.beats as Array<Record<string, unknown>> : [];
  for (const beat of scriptBeats) {
    const prepared = await runAiRoleJson("ttsPrep", { text: String(beat.text ?? ""), language: "id-ID" }, { onProgress: params.onProgress });
    beat.spokenText = normalizeIndonesianSpeech(String(prepared.data.spokenText ?? beat.text ?? ""));
  }
  let episode = (await runAiRoleJson("director", { script, characters: params.characters, sets: params.sets }, { onProgress: params.onProgress })).data;
  if (Array.isArray(episode.beats)) episode.beats = (episode.beats as Array<Record<string, unknown>>).map((beat, index) => ({ ...beat, spokenText: scriptBeats[index]?.spokenText ?? beat.text }));
  for (let round = 0; round <= generation.aiRetryCount; round++) {
    const critique = (await runAiRoleJson("critic", { episode, bible: params.bible }, { onProgress: params.onProgress })).data;
    if (Number(critique.score) >= threshold) return { script, episode, critique, repairRounds: round };
    if (round === generation.aiRetryCount) throw new Error(`Skor critic tetap ${critique.score} setelah ${generation.aiRetryCount} perbaikan.`);
    script = (await runAiRoleJson("scriptwriter", { idea: `${params.idea}\nPerbaiki berdasarkan: ${JSON.stringify(critique.improvements)}`, bible: params.bible }, { onProgress: params.onProgress })).data;
    episode = (await runAiRoleJson("director", { script, characters: params.characters, sets: params.sets }, { onProgress: params.onProgress })).data;
  }
  throw new Error("Paket episode gagal dibuat.");
}

export function validateDirectedEpisode(episode: Record<string, unknown>, characters: Array<{ name: string }>, sets: Array<{ id: string; stagePoints?: Record<string, unknown> }>) {
  const names = new Set(characters.map((item) => item.name)); const ids = new Set(sets.map((item) => item.id));
  const actions = new Set<string>(ActionTypeSchema.options);
  const issues: string[] = []; const beats = Array.isArray(episode.beats) ? episode.beats as Array<Record<string, unknown>> : [];
  beats.forEach((beat, index) => { if (!names.has(String(beat.speaker))) issues.push(`Beat ${index + 1}: speaker tidak ada.`); if (!ids.has(String(beat.setId))) issues.push(`Beat ${index + 1}: setId tidak ada.`); if (!actions.has(String(beat.action))) issues.push(`Beat ${index + 1}: aksi tidak didukung.`); const set=sets.find((item)=>item.id===beat.setId); if(beat.moveTo&&!(String(beat.moveTo) in (set?.stagePoints??{})))issues.push(`Beat ${index+1}: titik panggung tidak valid.`); });
  return { valid: issues.length === 0, issues };
}
export async function translateCommand(command: string, state: unknown) { const result=await runAiRoleJson("editor",{command,state}); const parsed=ROLE_DEFINITIONS.editor.output.parse(result.data) as {operations:Array<{op:"set"|"update"|"delete";target:string;path:string;value?:unknown}>};return parsed.operations; }
export function applyJsonPatches<T>(state:T,operations:Array<{op:"set"|"update"|"delete";path:string;value?:unknown}>):T { const clone=structuredClone(state) as Record<string,unknown>;for(const operation of operations){const parts=operation.path.split(".").filter(Boolean);if(!parts.length||parts.some((part)=>["__proto__","constructor","prototype"].includes(part)))throw new Error("Path patch tidak aman.");let target:Record<string,unknown>=clone;for(const part of parts.slice(0,-1)){if(!target[part]||typeof target[part]!=="object")target[part]={};target=target[part] as Record<string,unknown>}const key=parts.at(-1)!;if(operation.op==="delete")delete target[key];else target[key]=operation.value;}return clone as T; }
