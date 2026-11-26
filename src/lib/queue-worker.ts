import { db, logActivity } from "./db";
import { renderEpisodeToMp4 } from "./renderer";
import { EpisodeReviewSchema } from "./schemas";
import { getAppSettings } from "./settings";

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
      await renderEpisodeToMp4({
        episodeId: nextItem.episodeId,
        onProgress: async ({ progress, currentFrame, etaSec }) => {
          await db.queueItem.update({
            where: { id: nextItem.id },
            data: { progress, currentFrame, etaSec },
          });
        },
      });

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

export function startQueueWorkerLoop() {
  if (workerTimer) return;
  console.log("[QueueWorker] Dimulai (polling setiap 5 detik, 1 render per waktu)...");
  void processNextQueueItem();
  workerTimer = setInterval(() => {
    void processNextQueueItem();
  }, POLL_INTERVAL_MS);
}
