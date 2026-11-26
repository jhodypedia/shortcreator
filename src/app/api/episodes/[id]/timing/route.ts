import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  EpisodeScriptSchema,
  PauseMarkerSchema,
  ShotListSchema,
  VoiceTimingSchema,
} from "@/lib/schemas";
import { buildVoiceTimingObject } from "@/lib/timing";
import { buildDefaultShotsFromLines } from "@/lib/bible";

const TimingReqSchema = z.object({
  fps: z.number().int().default(30),
  pauses: z.array(PauseMarkerSchema).optional(),
  sfxMarkers: VoiceTimingSchema.shape.sfxMarkers.optional(),
  bgm: VoiceTimingSchema.shape.bgm.optional(),
  captionStyle: VoiceTimingSchema.shape.captionStyle.optional(),
  captionsOverride: VoiceTimingSchema.shape.captions.optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const episode = await db.episode.findUnique({ where: { id } });
    if (!episode) {
      return NextResponse.json({ error: "Episode tidak ditemukan" }, { status: 404 });
    }
    if (episode.status === "done") {
      return NextResponse.json(
        { error: "Episode berstatus Done dan dikunci." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = TimingReqSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Parameter timing tidak valid" },
        { status: 400 }
      );
    }

    const script = EpisodeScriptSchema.parse(episode.script);
    const audioFiles = Array.isArray(episode.audioFiles)
      ? (episode.audioFiles as Array<{
          lineId: string;
          path: string;
          durationSec: number;
        }>)
      : [];

    const audioDurations: Record<string, number> = {};
    for (const af of audioFiles) {
      audioDurations[af.lineId] = af.durationSec;
    }

    const existingVt = VoiceTimingSchema.safeParse(episode.voiceTiming).data;

    const { voiceTiming, totalFrames, durationSec } = buildVoiceTimingObject({
      lines: script.lines,
      audioDurations,
      fps: parsed.data.fps,
      pauses: parsed.data.pauses,
      existing: {
        sfxMarkers: parsed.data.sfxMarkers ?? existingVt?.sfxMarkers ?? [],
        bgm: parsed.data.bgm ?? existingVt?.bgm,
        captionStyle: parsed.data.captionStyle ?? existingVt?.captionStyle,
      },
    });

    if (parsed.data.captionsOverride && parsed.data.captionsOverride.length > 0) {
      voiceTiming.captions = parsed.data.captionsOverride;
    }

    const currentShots = ShotListSchema.safeParse(episode.shots);
    const nextShots =
      currentShots.success && currentShots.data.shots.length === script.lines.length
        ? {
            shots: currentShots.data.shots.map((s, idx) => {
              const lt = voiceTiming.lineTimings[idx];
              return lt
                ? { ...s, startFrame: lt.startFrame, endFrame: lt.endFrame }
                : s;
            }),
          }
        : {
            shots: buildDefaultShotsFromLines(script.lines, voiceTiming.lineTimings),
          };

    const nextStatus =
      episode.status === "draft" || episode.status === "script"
        ? "ready"
        : episode.status === "timing"
          ? "ready"
          : episode.status;

    const updated = await db.episode.update({
      where: { id },
      data: {
        voiceTiming,
        shots: nextShots,
        totalFrames,
        durationSec,
        status: nextStatus,
      },
    });

    return NextResponse.json({ episode: updated, voiceTiming, totalFrames, durationSec });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menghitung timing" },
      { status: 500 }
    );
  }
}
