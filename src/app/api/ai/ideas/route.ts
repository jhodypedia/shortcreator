import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { SeriesBibleSchema } from "@/lib/schemas";
import { generateHookIdeas } from "@/lib/ai";
import { getContinuity } from "@/lib/continuity";

const IdeasReqSchema = z.object({
  seriesId: z.string().min(1, "ID series wajib diisi"),
  useContinuity: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = IdeasReqSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Input tidak valid" },
        { status: 400 }
      );
    }

    const series = await db.series.findUnique({
      where: { id: parsed.data.seriesId },
    });
    if (!series) {
      return NextResponse.json({ error: "Series tidak ditemukan" }, { status: 404 });
    }

    const bible = SeriesBibleSchema.parse(series.bible);
    const continuity = parsed.data.useContinuity
      ? await getContinuity(series.id)
      : null;

    const result = await generateHookIdeas({
      seriesName: series.name,
      tone: series.tone,
      bible,
      continuity,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal membuat ide hook" },
      { status: 500 }
    );
  }
}
