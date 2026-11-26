import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, logActivity } from "@/lib/db";
import { applyEpisodeDone } from "@/lib/continuity";
import { ReviewCheckItemSchema } from "@/lib/schemas";

const ReviewPostSchema = z.object({
  checks: z.array(ReviewCheckItemSchema).length(7, "Semua 7 item checklist wajib diisi"),
  reRenderRequested: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const episode = await db.episode.findUnique({
      where: { id },
      include: { series: true },
    });
    if (!episode) {
      return NextResponse.json({ error: "Episode tidak ditemukan" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = ReviewPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data review tidak valid" },
        { status: 400 }
      );
    }

    const checks = parsed.data.checks;
    const allPassed = checks.every((c) => c.passed);
    const prevReview = (episode.review as { renderAttempts?: number } | null) ?? {};
    const prevAttempts = prevReview.renderAttempts ?? 0;

    if (!allPassed) {
      const failedWithoutNote = checks.find((c) => !c.passed && !c.note.trim());
      if (failedWithoutNote) {
        return NextResponse.json(
          {
            error: `Catatan revisi wajib diisi untuk poin yang belum lolos: "${failedWithoutNote.label}"`,
          },
          { status: 400 }
        );
      }
    }

    const statusReview = allPassed ? "lolos" : "perlu_revisi";
    const nextAttempts =
      !allPassed && parsed.data.reRenderRequested ? prevAttempts + 1 : prevAttempts;

    const reviewPayload = {
      checks,
      status: statusReview,
      reviewedAt: new Date().toISOString(),
      renderAttempts: nextAttempts,
    };

    if (allPassed) {
      const updated = await db.episode.update({
        where: { id },
        data: {
          review: reviewPayload,
          status: "done",
        },
      });

      await db.queueItem.updateMany({
        where: { episodeId: id, status: { in: ["review", "rendering"] } },
        data: { status: "done", progress: 100 },
      });

      // Update Series Bible continuity secara otomatis saat episode Done
      const continuityUpdate = await applyEpisodeDone(episode.seriesId, {
        number: episode.number,
        title: episode.title,
        twist: episode.twist,
        cliffhanger: episode.cliffhanger,
        cliffhangerFrom: episode.cliffhangerFrom,
        script: episode.script as {
          lines?: Array<{ speaker: string; emotion: string; text: string }>;
        },
      });

      await logActivity({
        seriesId: episode.seriesId,
        episodeId: episode.id,
        level: "success",
        message: `Review lolos — ${episode.series.name} Eps ${episode.number} selesai (Done)`,
        detail: `Bible diperbarui ke v${continuityUpdate.bibleVersion}.`,
      });

      return NextResponse.json({
        episode: updated,
        review: reviewPayload,
        bibleVersion: continuityUpdate.bibleVersion,
      });
    }

    // Jika perlu revisi
    const updated = await db.episode.update({
      where: { id },
      data: {
        review: reviewPayload,
        status: "review",
      },
    });

    // Jika gagal review 2x -> STOP antrean otomatis
    if (nextAttempts >= 2) {
      const stopReason = `Antrean dihentikan — Ep ${episode.number} gagal review 2×. Perbaiki dulu sebelum lanjut.`;
      await db.queueControl.upsert({
        where: { id: "default" },
        update: { isPaused: true, stopReason },
        create: { id: "default", isPaused: true, stopReason },
      });
      await logActivity({
        seriesId: episode.seriesId,
        episodeId: episode.id,
        level: "error",
        message: stopReason,
      });
      return NextResponse.json({
        episode: updated,
        review: reviewPayload,
        queueStopped: true,
        stopReason,
      });
    }

    // Jika user klik Render Ulang (percobaan ke-1)
    if (parsed.data.reRenderRequested) {
      const maxPos = await db.queueItem.aggregate({ _max: { position: true } });
      await db.queueItem.create({
        data: {
          episodeId: id,
          position: (maxPos._max.position ?? 0) + 1,
          status: "queued",
          progress: 0,
          attempts: 0,
        },
      });
    }

    await logActivity({
      seriesId: episode.seriesId,
      episodeId: episode.id,
      level: "warning",
      message: `Review perlu revisi: ${episode.series.name} Eps ${episode.number}`,
      detail: checks
        .filter((c) => !c.passed)
        .map((c) => c.note)
        .join("; "),
    });

    return NextResponse.json({ episode: updated, review: reviewPayload });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menyimpan review" },
      { status: 500 }
    );
  }
}
