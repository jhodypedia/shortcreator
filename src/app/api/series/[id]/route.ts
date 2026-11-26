import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, logActivity } from "@/lib/db";
import { validateAndBumpBible } from "@/lib/bible";

const UpdateSeriesSchema = z.object({
  name: z.string().min(2).optional(),
  theme: z.string().min(3).optional(),
  audience: z.enum(["anak", "remaja", "umum"]).optional(),
  tone: z.enum(["lucu", "tegang", "heartwarming"]).optional(),
  language: z.string().optional(),
  visualStyle: z.enum(["voxel-3d", "cartoon-3d"]).optional(),
  bible: z.unknown().optional(),
  changeNote: z.string().optional(),
  reason: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const series = await db.series.findUnique({
    where: { id },
    include: {
      episodes: {
        orderBy: { number: "asc" },
      },
    },
  });

  if (!series) {
    return NextResponse.json({ error: "Series tidak ditemukan" }, { status: 404 });
  }
  return NextResponse.json({ series });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const existing = await db.series.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Series tidak ditemukan" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = UpdateSeriesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Input update series tidak valid" },
        { status: 400 }
      );
    }

    let nextBible = existing.bible;
    let nextVersion = existing.bibleVersion;

    if (parsed.data.bible !== undefined) {
      const res = validateAndBumpBible({
        nextBible: parsed.data.bible,
        currentVersion: existing.bibleVersion,
        changeNote: parsed.data.changeNote,
        reason: parsed.data.reason,
      });
      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      nextBible = res.bible;
      nextVersion = res.nextVersion;
    }

    const updated = await db.series.update({
      where: { id },
      data: {
        name: parsed.data.name ?? existing.name,
        theme: parsed.data.theme ?? existing.theme,
        audience: parsed.data.audience ?? existing.audience,
        tone: parsed.data.tone ?? existing.tone,
        language: parsed.data.language ?? existing.language,
        visualStyle: parsed.data.visualStyle ?? existing.visualStyle,
        bible: nextBible as object,
        bibleVersion: nextVersion,
      },
    });

    await logActivity({
      seriesId: updated.id,
      level: "info",
      message: `Series Bible ${updated.name} diperbarui (v${updated.bibleVersion})`,
      detail: parsed.data.reason || "Pembaruan manual",
    });

    return NextResponse.json({ series: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memperbarui series" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const existing = await db.series.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Series tidak ditemukan" }, { status: 404 });
    }
    await db.series.delete({ where: { id } });
    await logActivity({
      level: "warning",
      message: `Series dihapus: ${existing.name}`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menghapus series" },
      { status: 500 }
    );
  }
}
