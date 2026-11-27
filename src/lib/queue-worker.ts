import { db, logActivity } from "./db";
import { renderEpisodeToMp4 } from "./renderer";
import { EpisodeReviewSchema, SeriesBibleSchema, EpisodeScriptSchema } from "./schemas";
import { getAppSettings } from "./settings";
import { generateWithGflow } from "./gflow";
import fs from "node:fs/promises";
import path from "node:path";

const POLL_INTERVAL_MS = 5000;
let isProcessing = false;
let workerTimer: ReturnType<typeof setInterval> | null = null;

export async function processNextQueueItem(): Promise<{
  processed: boolean;
  reason?: string;
}> {
  if (isProcessing) {
    return { processed: false, reason: "Sedang memproses render lain" };
  }

  isProcessing = true;
  try {
    const control = await db.queueControl.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default", isPaused: false },
    });

    if (control.isPaused) {
      return {
        processed: false,
        reason: control.stopReason || "Antrean sedang dijeda",
      };
    }

    // Pastikan tidak ada item lain yang stuck in rendering saat worker restart
    const nextItem = await db.queueItem.findFirst({
      where: { status: "queued" },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: {
        episode: {
          include: { series: true },
        },
      },
    });

    if (!nextItem) {
      return { processed: false, reason: "Tidak ada antrean queued" };
    }

    // Cek aturan STOP otomatis bila episode gagal review 2x
    const parsedReview = EpisodeReviewSchema.safeParse(nextItem.episode.review);
    if (
      parsedReview.success &&
      parsedReview.data.status === "perlu_revisi" &&
      parsedReview.data.renderAttempts >= 2
    ) {
      const msg = `Antrean dihentikan — Ep ${nextItem.episode.number} gagal review 2×. Perbaiki dulu sebelum lanjut.`;
      await db.queueControl.update({
        where: { id: "default" },
        data: { isPaused: true, stopReason: msg },
      });
      await logActivity({
        seriesId: nextItem.episode.seriesId,
        episodeId: nextItem.episodeId,
        level: "error",
        message: msg,
      });
      return { processed: false, reason: msg };
    }

    const { publicSettings } = await getAppSettings();
    const maxRetries = publicSettings.render.maxRetries;

    await db.queueItem.update({
      where: { id: nextItem.id },
      data: {
        status: "rendering",
        progress: 1,
        attempts: nextItem.attempts + 1,
        lastError: null,
      },
    });

    await db.episode.update({
      where: { id: nextItem.episodeId },
      data: { status: "rendering" },
    });

    try {
      const { publicSettings } = await getAppSettings();
      const renderResult = publicSettings.render.provider === "gflow-cli"
        ? await renderWithGflow(nextItem.episodeId, nextItem.episode, publicSettings.render.gflowModel, publicSettings.render.gflowMaxCredits, async ({ progress, etaSec }) => {
          await db.queueItem.update({ where: { id: nextItem.id }, data: { progress, currentFrame: 0, etaSec } });
        })
        : await renderEpisodeToMp4({
        episodeId: nextItem.episodeId,
        onProgress: async ({ progress, currentFrame, etaSec }) => {
          await db.queueItem.update({
            where: { id: nextItem.id },
            data: { progress, currentFrame, etaSec },
          });
        },
        });

      if (publicSettings.render.provider === "gflow-cli") {
        await db.episode.update({ where: { id: nextItem.episodeId }, data: { renderPath: renderResult.renderPath } });
      }

      await db.queueItem.update({
        where: { id: nextItem.id },
        data: {
          status: "review",
          progress: 100,
          etaSec: 0,
        },
      });

      return { processed: true };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Gagal melakukan render Remotion";
      const attemptsNow = nextItem.attempts + 1;

      if (attemptsNow < maxRetries) {
        // Retry otomatis
        await db.queueItem.update({
          where: { id: nextItem.id },
          data: {
            status: "queued",
            progress: 0,
            lastError: `Percobaan ${attemptsNow} gagal: ${errorMsg}. Dijadwalkan ulang.`,
          },
        });
        await db.episode.update({
          where: { id: nextItem.episodeId },
          data: { status: "ready" },
        });
      } else {
        await db.queueItem.update({
          where: { id: nextItem.id },
          data: {
            status: "failed",
            lastError: errorMsg,
          },
        });
        await db.episode.update({
          where: { id: nextItem.episodeId },
          data: { status: "failed" },
        });
        await logActivity({
          seriesId: nextItem.episode.seriesId,
          episodeId: nextItem.episodeId,
          level: "error",
          message: `Render gagal: ${nextItem.episode.series.name} Eps ${nextItem.episode.number}`,
          detail: errorMsg,
        });
      }

      return { processed: false, reason: errorMsg };
    }
  } finally {
    isProcessing = false;
  }
}

async function renderWithGflow(episodeId: string, episode: { id: string; number: number; title: string; hook: string; twist: string; cliffhanger: string; script: unknown; series: { id: string; name: string; bible: unknown } }, model: string, maxCredits: number, onProgress: (progress: { progress: number; etaSec: number | null }) => Promise<void>) {
  const bible = SeriesBibleSchema.parse(episode.series.bible);
  const script = EpisodeScriptSchema.parse(episode.script);
  const topCharacters = [...new Set(script.lines.map((line) => line.speaker).filter(Boolean))].slice(0, 4);
  const characterNotes = topCharacters.map((name) => {
    const character = bible.characters.find((item) => item.name === name);
    return character ? `${character.name}: ${character.role}; ${character.traits.join(", ")}; warna utama ${character.colorPrimary}` : name;
  });
  const beats = script.lines.slice(0, 12).map((line, index) => `${index + 1}) ${line.speaker}: ${line.text} (${line.emotion})`).join("\n");
  const prompt = [
    "Create a polished vertical 9:16 animated Indonesian YouTube Shorts clip, with coherent visual continuity, expressive character acting, cinematic camera, clean composition and no on-screen text or subtitles.",
    "Keep the camera, lighting and backgrounds coherent with this visual direction: " + (bible.visualStyle.captionFont ? `${bible.visualStyle.palette.join(", ")}; accent ${bible.visualStyle.accentColor}` : bible.visualStyle.palette.join(", ")),
    `Series: ${episode.series.name}. Episode ${episode.number}: ${episode.title}.`,
    `Hook: ${episode.hook}. Twist: ${episode.twist}. Cliffhanger: ${episode.cliffhanger}.`,
    characterNotes.length ? `Character designs and identity consistency:\n${characterNotes.join("\n")}` : "Use a consistent original cast of stylized 3D voxel characters.",
    `Story beats and dialogue context:\n${beats}`,
    `The final shot should pay off the twist and land on this cliffhanger: ${episode.cliffhanger}.`,
  ].join("\n\n");
  const { outputDir } = (await getAppSettings()).publicSettings.render;
  if (!outputDir) throw new Error("Atur folder output pada Pengaturan sebelum memakai gflow-cli.");
  const destinationDir = path.join(path.isAbsolute(outputDir) ? outputDir : path.resolve(process.cwd(), outputDir), "gflow", episode.series.id);
  const safeTitle = episode.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `episode-${episode.number}`;
  const outputPath = path.join(destinationDir, `${String(episode.number).padStart(3, "0")}-${safeTitle}-${episodeId.slice(-6)}.mp4`);
  await fs.mkdir(destinationDir, { recursive: true });
  const startedAt = Date.now();
  const result = await generateWithGflow({ prompt, outputPath, model, maxCredits, aspect: "9:16", timeoutMs: 15 * 60_000, onProgress: async (progress, detail) => {
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    await onProgress({ progress, etaSec: progress > 3 ? Math.max(0, Math.round(elapsed / (progress / 100) - elapsed)) : null });
    if (detail) await logActivity({ seriesId: episode.series.id, episodeId, level: "info", message: `Google Flow ${progress}%`, detail });
  } });
  const storageRoot = path.resolve(process.cwd(), "storage");
  const finalDir = path.join(storageRoot, "renders", "gflow", episode.series.id);
  const finalFile = path.join(finalDir, path.basename(result.outputPath));
  await fs.mkdir(finalDir, { recursive: true });
  if (path.resolve(result.outputPath) !== path.resolve(finalFile)) await fs.copyFile(result.outputPath, finalFile);
  const renderPath = `/api/storage/${path.relative(storageRoot, finalFile).split(path.sep).join("/")}`;
  const stats = await fs.stat(finalFile);
  await logActivity({ seriesId: episode.series.id, episodeId, level: "success", message: `Google Flow selesai membuat ${episode.series.name} Eps ${episode.number}`, detail: `Model ${result.model}; file ${(stats.size / 1024 / 1024).toFixed(1)} MB; waktu ${Math.round(result.elapsedMs / 1000)} dtk` });
  return { renderPath, diskPath: finalFile, totalFrames: 0 };
}

export function startQueueWorkerLoop() {
  if (workerTimer) return;
  console.log("[QueueWorker] Dimulai (polling setiap 5 detik, 1 render per waktu)...");
  void processNextQueueItem();
  workerTimer = setInterval(() => {
    void processNextQueueItem();
  }, POLL_INTERVAL_MS);
}
