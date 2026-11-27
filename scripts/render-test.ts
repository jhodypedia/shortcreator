import { performance } from "node:perf_hooks";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { bundle } from "@remotion/bundler";
import { ShortCompositionProps } from "../src/remotion/ShortComposition";

async function main() {
const prisma = new PrismaClient();
const episodeId = process.env.EPISODE_ID;
if (!episodeId) throw new Error("Set EPISODE_ID to the seeded episode id");

const episode = await prisma.episode.findUnique({ where: { id: episodeId }, include: { series: true } });
if (!episode) throw new Error(`Missing episode ${episodeId}`);
const frames = 45 * 30;
const props = {
  episode: {
    id: episode.id, number: episode.number, title: episode.title, hook: episode.hook,
    script: episode.script, voiceTiming: episode.voiceTiming, shots: episode.shots,
    audioFiles: episode.audioFiles ?? [], totalFrames: frames,
  },
  bible: episode.series.bible,
  visualStyle: episode.series.visualStyle,
  showCaptions: true, showSafeArea: false, muteAudio: true, includeSfx: false, audioOnly: false,
} as unknown as ShortCompositionProps;

const dir = path.resolve("storage/renders/test");
await fs.mkdir(dir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/remotion/index.ts"), webpackOverride: (config) => config });
const composition = await selectComposition({ serveUrl, id: "Short", inputProps: props as unknown as Record<string, unknown> });
const started = performance.now();
await renderMedia({
  composition: { ...composition, durationInFrames: frames, fps: 30, width: 180, height: 320 },
  serveUrl, codec: "h264", outputLocation: path.join(dir, "45-second-test.mp4"), inputProps: props as unknown as Record<string, unknown>,
  chromiumOptions: { gl: "swangle", headless: true, disableWebSecurity: true }, concurrency: 1,
});
const elapsed = (performance.now() - started) / 1000;
console.log(JSON.stringify({ frames, durationSec: 45, renderSeconds: Number(elapsed.toFixed(2)), output: path.join(dir, "45-second-test.mp4") }));
await prisma.$disconnect();
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
