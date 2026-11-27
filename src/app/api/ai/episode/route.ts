import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { SeriesBibleSchema } from "@/lib/schemas";
import { generateEpisodePackage, validateDirectedEpisode } from "@/lib/ai/workflow";
import { runAiRoleJson } from "@/lib/ai/runner";
import { buildDefaultShotsFromLines } from "@/lib/bible";
import { EpisodeScriptSchema } from "@/lib/schemas";
import { generateLineAudio } from "@/lib/tts";
import { buildVoiceTimingObject } from "@/lib/timing";

const RequestSchema = z.object({ seriesId: z.string().min(1), idea: z.string().min(1), stopAfter: z.enum(["bible", "script", "director", "critic", "complete"]).default("complete"), persist: z.boolean().default(false), autopilotCount: z.number().int().min(1).max(20).default(1) });
export async function POST(request: NextRequest) {
  let body: unknown; try { body = await request.json(); } catch { return Response.json({ error: "JSON tidak valid" }, { status: 400 }); }
  const parsed = RequestSchema.safeParse(body); if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const series = await db.series.findUnique({ where: { id: parsed.data.seriesId } }); if (!series) return Response.json({ error: "Serial tidak ditemukan" }, { status: 404 });
  const bible = SeriesBibleSchema.parse(series.bible);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({ async start(controller) {
    const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    try {
      send("progress", { stage: "bible", percent: 5, text: "Series Bible siap" });
      if (parsed.data.stopAfter === "bible") { const generated = await runAiRoleJson("bibleWriter", { idea: parsed.data.idea }, { onProgress: (progress) => send("progress", progress) }); send("result", { bible: generated.data }); controller.close(); return; }
      const script = await runAiRoleJson("scriptwriter", { idea: parsed.data.idea, bible }, { onProgress: (progress) => send("progress", progress) });
      send("stage", { stage: "script", percent: 35, output: script.data });
      if (parsed.data.stopAfter === "script") { send("result", { script: script.data }); controller.close(); return; }
      const directed = await runAiRoleJson("director", { script: script.data, characters: bible.characters, sets: bible.sets }, { onProgress: (progress) => send("progress", progress) });
      send("stage", { stage: "director", percent: 60, output: directed.data });
      if (parsed.data.stopAfter === "director") { send("result", { script: script.data, episode: directed.data }); controller.close(); return; }
      let result = await generateEpisodePackage({ idea: parsed.data.idea, bible, characters: bible.characters, sets: bible.sets, onProgress: (progress) => send("progress", progress) });
      const validation = validateDirectedEpisode(result.episode, bible.characters, bible.sets);
      if (!validation.valid) throw new Error(`Validasi deterministik gagal: ${validation.issues.join("; ")}`);
      send("stage", { stage: "critic", percent: 80, output: result.critique });
      const savedEpisodes: Array<{id:string;number:number}> = [];
      if (parsed.data.persist && parsed.data.stopAfter === "complete") {
        const existing = await db.episode.findMany({ where: { seriesId: series.id }, select: { number: true }, orderBy: { number: "desc" }, take: 1 });
        let number = (existing[0]?.number ?? 0) + 1;
        for (let count = 0; count < parsed.data.autopilotCount; count++) {
          const lines = (result.episode.beats as Array<Record<string, unknown>>).map((beat, index) => ({ id: `line-${index + 1}`, beat: String(beat.beat ?? (index === 0 ? "hook" : index === (result.episode.beats as unknown[]).length - 1 ? "payoff" : "konflik")), speaker: String(beat.speaker), text: String(beat.text), emotion: String(beat.emotion), durationSec: Math.max(0.4, Math.min(20, String(beat.text).trim().split(/\s+/).length * 0.38)), setId: String(beat.setId), action: String(beat.action), ...(typeof beat.moveTo === "string" ? { moveTo: beat.moveTo } : {}), ...(typeof beat.lookAt === "string" ? { lookAt: beat.lookAt } : {}), ...(typeof beat.prop === "string" ? { prop: beat.prop } : {}), ...(typeof beat.sfx === "string" ? { sfx: beat.sfx } : {}) }));
          const script = EpisodeScriptSchema.parse({ lines, setId: bible.sets[0]?.id });
          const episodeTitle = count === 0 ? parsed.data.idea.slice(0, 100) : `Lanjutan ${number}`;
          const created = await db.episode.create({ data: { seriesId: series.id, number, title: episodeTitle, status: "script", hook: lines[0].text, twist: String(result.critique.hasTwist ? lines[Math.floor(lines.length / 2)].text : ""), cliffhanger: String((result.episode.beats as Array<Record<string,unknown>>).at(-1)?.text ?? ""), script, shots: { shots: buildDefaultShotsFromLines(script.lines, []) }, durationSec: lines.reduce((total, line) => total + line.durationSec, 0) } });
          savedEpisodes.push({ id: created.id, number });
          send("progress", { stage: "voice", percent: 85, text: `Membuat voice episode ${number}…` });
          const audioFiles = [];
          for (const line of script.lines) {
            const character = bible.characters.find((item) => item.name === line.speaker);
             const audio = await generateLineAudio({ episodeId: created.id, lineId: line.id, text: line.text, spokenText: line.spokenText, voiceId: character?.voiceProfile?.voiceId ?? character?.voiceId, provider: character?.voiceProfile?.provider, language: "id-ID", delivery: line.delivery, style: character?.voiceProfile?.style, speed: character?.voiceProfile?.speed ?? character?.voiceSpeed, pitch: character?.voiceProfile?.pitch ?? character?.voicePitch, previousText: script.lines[script.lines.findIndex((item) => item.id === line.id) - 1]?.text, nextText: script.lines[script.lines.findIndex((item) => item.id === line.id) + 1]?.text });
            audioFiles.push({ lineId: line.id, path: audio.path, durationSec: audio.durationSec, providerUsed: audio.providerUsed });
          }
          const voiceTiming = buildVoiceTimingObject({ lines: script.lines, audioDurations: Object.fromEntries(audioFiles.map((file) => [file.lineId, file.durationSec])) });
          await db.episode.update({ where: { id: created.id }, data: { audioFiles, voiceTiming: voiceTiming.voiceTiming, totalFrames: voiceTiming.totalFrames, durationSec: voiceTiming.durationSec, status: "ready" } });
          const maxPosition = await db.queueItem.aggregate({ _max: { position: true } });
          await db.queueItem.create({ data: { episodeId: created.id, position: (maxPosition._max.position ?? 0) + 1, status: "queued" } });
          if (count + 1 < parsed.data.autopilotCount) {
            const continuity = { summary: `Episode ${number}: ${lines.map((line) => line.text).slice(-3).join(" ")}`, activeCliffhanger: created.cliffhanger, previousEpisode: number };
            result = await generateEpisodePackage({ idea: `Lanjutkan cerita dengan continuity ${JSON.stringify(continuity)}. Ide berikut: ${parsed.data.idea}`, bible: { ...bible, continuity }, characters: bible.characters, sets: bible.sets, onProgress: (progress) => send("progress", progress) });
            number++;
          }
        }
      }
      send("result", { ...result, savedEpisodes });
    } catch (error) { send("error", { error: error instanceof Error ? error.message : String(error) }); }
    finally { controller.close(); }
  } });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
