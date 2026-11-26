import fs from "node:fs/promises";
import fssync from "node:fs";
import http from "node:http";
import path from "node:path";
import { db, logActivity } from "./db";
import { getAppSettings } from "./settings";
import {
  EpisodeScriptSchema,
  SeriesBibleSchema,
  ShotListSchema,
  VoiceTimingSchema,
} from "./schemas";
import { buildDefaultShotsFromLines } from "./bible";
import { buildVoiceTimingObject } from "./timing";

let cachedServeUrl: string | null = null;

function sanitizeSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "series"
  );
}

async function startStorageHttpServer(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const storageRoot = path.join(process.cwd(), "storage");
  const server = http.createServer((req, res) => {
    const reqUrl = (req.url || "/").split("?")[0];
    const cleanRel = reqUrl.replace(/^\/api\/storage\//, "").replace(/^\/+/, "");
    const target = path.resolve(storageRoot, cleanRel);

    if (!target.startsWith(storageRoot) || !fssync.existsSync(target)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(target).toLowerCase();
    const mime =
      ext === ".mp3"
        ? "audio/mpeg"
        : ext === ".wav"
          ? "audio/wav"
          : ext === ".ogg"
            ? "audio/ogg"
            : ext === ".mp4"
              ? "video/mp4"
              : "application/octet-stream";

    const stat = fssync.statSync(target);
    res.writeHead(200, {
      "Content-Type": mime,
      "Content-Length": stat.size,
      "Access-Control-Allow-Origin": "*",
    });
    fssync.createReadStream(target).pipe(res);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

export async function renderEpisodeToMp4(params: {
  episodeId: string;
  onProgress?: (info: {
    progress: number;
    currentFrame: number;
    etaSec: number | null;
  }) => Promise<void> | void;
}): Promise<{ renderPath: string; diskPath: string; totalFrames: number }> {
  const episode = await db.episode.findUnique({
    where: { id: params.episodeId },
    include: { series: true },
  });

  if (!episode) {
    throw new Error("Episode tidak ditemukan di database");
  }

  const bible = SeriesBibleSchema.parse(episode.series.bible);
  const script = EpisodeScriptSchema.parse(episode.script);

  const audioFiles = Array.isArray(episode.audioFiles)
    ? (episode.audioFiles as Array<{
        lineId: string;
        path: string;
        durationSec: number;
      }>)
    : [];

  let voiceTiming = episode.voiceTiming
    ? VoiceTimingSchema.safeParse(episode.voiceTiming).data ?? null
    : null;

  if (!voiceTiming) {
    const audioMap: Record<string, number> = {};
    for (const af of audioFiles) {
      audioMap[af.lineId] = af.durationSec;
    }
    const built = buildVoiceTimingObject({
      lines: script.lines,
      audioDurations: audioMap,
      fps: 30,
    });
    voiceTiming = built.voiceTiming;
  }

  const parsedShots = ShotListSchema.safeParse(episode.shots);
  const shots =
    parsedShots.success && parsedShots.data.shots.length > 0
      ? parsedShots.data
      : {
          shots: buildDefaultShotsFromLines(
            script.lines,
            voiceTiming.lineTimings
          ),
        };

  const totalFrames = Math.max(
    30,
    episode.totalFrames ??
      voiceTiming.captions[voiceTiming.captions.length - 1]?.endFrame ??
      Math.round(
        script.lines.reduce((acc, l) => acc + l.durationSec, 0) * 30
      )
  );

  const { publicSettings } = await getAppSettings();
  const seriesSlug = sanitizeSlug(episode.series.name);
  const epNumPad = String(episode.number).padStart(3, "0");
  const outputRoot = path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    publicSettings.render.outputDir
  );
  const outDir = path.resolve(outputRoot, seriesSlug);
  await fs.mkdir(outDir, { recursive: true });
  const diskPath = path.join(outDir, `ep-${epNumPad}.mp4`);
  const relApiPath = `/api/storage/renders/${seriesSlug}/ep-${epNumPad}.mp4`;

  const storageServer = await startStorageHttpServer();
  const startedAt = Date.now();

  try {
    const { bundle } = await import("@remotion/bundler");
    const { renderMedia, selectComposition, ensureBrowser } = await import(
      "@remotion/renderer"
    );

    await ensureBrowser();

    if (!cachedServeUrl) {
      const entryPoint = path.resolve(process.cwd(), "src/remotion/index.ts");
      cachedServeUrl = await bundle({
        entryPoint,
        webpackOverride: (config) => config,
      });
    }

    const inputProps = {
      episode: {
        id: episode.id,
        number: episode.number,
        title: episode.title,
        hook: episode.hook,
        script,
        voiceTiming,
        shots,
        audioFiles,
        totalFrames,
      },
      bible,
      visualStyle: episode.series.visualStyle as "voxel-3d" | "cartoon-3d",
      showSafeArea: false,
      showCaptions: true,
      muteAudio: false,
      includeSfx: true,
      audioOnly: false,
      audioBaseUrl: storageServer.baseUrl,
    };

    const composition = await selectComposition({
      serveUrl: cachedServeUrl,
      id: "Short",
      inputProps,
    });

    let lastReportedPct = -1;

    await renderMedia({
      composition: {
        ...composition,
        durationInFrames: totalFrames,
        fps: publicSettings.render.fps || 30,
        width: publicSettings.render.width || 1080,
        height: publicSettings.render.height || 1920,
      },
      serveUrl: cachedServeUrl,
      codec: "h264",
      outputLocation: diskPath,
      inputProps,
      chromiumOptions: {
        gl: "swangle",
        flags: {
          "enable-webgl": true,
          "use-angle": "swiftshader",
          "enable-unsafe-swiftshader": true,
          "disable-gpu": true,
          "disable-dev-shm-usage": true,
        },
      },
      disableSharedMemoryCapture: true,
      concurrency: 1,
      onProgress: async ({ progress, renderedFrames }) => {
        const pct = Math.min(100, Math.round(progress * 100));
        if (pct !== lastReportedPct && params.onProgress) {
          lastReportedPct = pct;
          const elapsedSec = (Date.now() - startedAt) / 1000;
          const etaSec =
            progress > 0.05
              ? Math.max(0, Math.round((elapsedSec / progress) * (1 - progress)))
              : null;
          await params.onProgress({
            progress: pct,
            currentFrame: renderedFrames,
            etaSec,
          });
        }
      },
    });

    await db.episode.update({
      where: { id: episode.id },
      data: {
        renderPath: relApiPath,
        totalFrames,
        durationSec: Number((totalFrames / (publicSettings.render.fps || 30)).toFixed(2)),
        status: "review",
      },
    });

    await logActivity({
      seriesId: episode.seriesId,
      episodeId: episode.id,
      level: "success",
      message: `Render selesai: ${episode.series.name} Eps ${episode.number}`,
      detail: `File MP4 tersimpan di ${relApiPath}`,
    });

    return { renderPath: relApiPath, diskPath, totalFrames };
  } finally {
    await storageServer.close();
  }
}
