import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, logActivity } from "@/lib/db";
import {
  EpisodeScriptSchema,
  ShotListSchema,
  VoiceTimingSchema,
} from "@/lib/schemas";
import { getContinuity, validateSequelEpisode } from "@/lib/continuity";

const PatchEpisodeSchema = z.object({
  action: z.enum(["update", "unlock"]).default("update"),
  unlockReason: z.string().optional(),
  title: z.string().min(1).optional(),
  status: z
    .enum(["draft", "script", "timing", "ready", "rendering", "review", "done", "failed"])
    .optional(),
  hook: z.string().optional(),
  twist: z.string().optional(),
  cliffhanger: z.string().optional(),
  cliffhangerFrom: z.string().nullable().optional(),
  script: EpisodeScriptSchema.optional(),
  voiceTiming: VoiceTimingSchema.optional(),
  shots: ShotListSchema.optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const episode = await db.episode.findUnique({
    where: { id },
    include: {
      series: true,
      queueItems: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!episode) {
    return NextResponse.json({ error: "Episode tidak ditemukan" }, { status: 404 });
  }
  return NextResponse.json({ episode });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const existing = await db.episode.findUnique({
      where: { id },
      include: { series: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Episode tidak ditemukan" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = PatchEpisodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data update episode tidak valid" },
        { status: 400 }
      );
    }

    // Buka kunci episode Done untuk revisi
    if (parsed.data.action === "unlock") {
      if (!parsed.data.unlockReason || parsed.data.unlockReason.trim().length < 3) {
        return NextResponse.json(
          { error: "Alasan membuka kunci revisi wajib diisi (minimal 3 karakter)." },
          { status: 400 }
        );
      }
      const existingReview = (existing.review as Record<string, unknown>) || {};
      const updated = await db.episode.update({
        where: { id },
        data: {
          status: "review",
          review: {
            ...existingReview,
            unlockReason: parsed.data.unlockReason.trim(),
          },
        },
      });
      await logActivity({
        seriesId: existing.seriesId,
        episodeId: existing.id,
        level: "warning",
        message: `Episode ${existing.number} dibuka untuk revisi`,
        detail: parsed.data.unlockReason.trim(),
      });
      return NextResponse.json({ episode: updated });
    }

    // Episode yang sudah Done dikunci dari edit naskah/timing
    if (
      existing.status === "done" &&
      (parsed.data.script || parsed.data.voiceTiming || parsed.data.shots)
    ) {
      return NextResponse.json(
        {
          error:
            "Episode sudah berstatus Done dan dikunci. Gunakan tombol 'Buka untuk Revisi' di halaman Review bila ingin mengubah.",
        },
        { status: 403 }
      );
    }

    // Validasi lanjutan bila episode ini memang melanjutkan cliffhanger sebelumnya
    if (
      existing.cliffhangerFrom &&
      (parsed.data.script || parsed.data.cliffhanger !== undefined || parsed.data.hook !== undefined)
    ) {
      const nextHook = parsed.data.hook ?? existing.hook;
      const nextCliff = parsed.data.cliffhanger ?? existing.cliffhanger;
      const nextScript = parsed.data.script ?? (existing.script as { lines: Array<{ text: string }> });
      const continuity = await getContinuity(existing.seriesId);

      const seqCheck = validateSequelEpisode({
        activeCliffhanger: existing.cliffhangerFrom || continuity?.activeCliffhanger || "",
        hook: nextHook,
        scriptTexts: (nextScript?.lines ?? []).map((l) => l.text),
        nextCliffhanger: nextCliff,
        continuityConfirmed: parsed.data.script?.continuityConfirmed,
        continuityNote: parsed.data.script?.continuityNote,
      });

      if (!seqCheck.ok) {
        return NextResponse.json({ error: seqCheck.error }, { status: 400 });
      }
    }

    const nextScript = parsed.data.script ?? existing.script;
    const lines = ((nextScript as { lines?: Array<{ durationSec: number }> })?.lines ?? []);
    const estDur = lines.reduce((sum, l) => sum + (l.durationSec || 1.5), 0);

    let nextStatus = parsed.data.status ?? existing.status;
    if (!parsed.data.status && parsed.data.script && existing.status === "draft") {
      nextStatus = "script";
    }
    if (!parsed.data.status && parsed.data.shots && existing.voiceTiming && existing.status === "timing") {
      nextStatus = "ready";
    }

    const updated = await db.episode.update({
      where: { id },
      data: {
        title: parsed.data.title ?? existing.title,
        status: nextStatus,
        hook: parsed.data.hook ?? existing.hook,
        twist: parsed.data.twist ?? existing.twist,
        cliffhanger: parsed.data.cliffhanger ?? existing.cliffhanger,
        cliffhangerFrom:
          parsed.data.cliffhangerFrom !== undefined
            ? parsed.data.cliffhangerFrom
            : existing.cliffhangerFrom,
        script: nextScript as object,
        voiceTiming:
          parsed.data.voiceTiming !== undefined
            ? (parsed.data.voiceTiming as object)
            : (existing.voiceTiming as object | undefined),
        shots:
          parsed.data.shots !== undefined
            ? (parsed.data.shots as object)
            : (existing.shots as object),
        durationSec: parsed.data.voiceTiming
          ? existing.durationSec
          : Number(estDur.toFixed(2)),
      },
    });

    return NextResponse.json({ episode: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memperbarui episode" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  await db.episode.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
