import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { SetSchema } from "@/lib/schemas";
import { validateAndBumpBible } from "@/lib/bible";

const SaveSetsBodySchema = z.object({
  sets: z.array(SetSchema).min(1, "Minimal 1 set harus ada"),
  activeSetId: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const series = await db.series.findUnique({ where: { id } });
    if (!series) {
      return NextResponse.json({ error: "Series tidak ditemukan" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = SaveSetsBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data set tidak valid" },
        { status: 400 }
      );
    }

    const currentBible = series.bible as Record<string, unknown>;
    const res = validateAndBumpBible({
      nextBible: { ...currentBible, sets: parsed.data.sets },
      currentVersion: series.bibleVersion,
      changeNote: "Pembaruan Set & Props dari Set Builder",
      reason: "Simpan Set Builder",
    });

    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    const updated = await db.series.update({
      where: { id },
      data: {
        bible: res.bible as object,
        bibleVersion: res.nextVersion,
      },
    });

    return NextResponse.json({ series: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menyimpan set" },
      { status: 500 }
    );
  }
}
