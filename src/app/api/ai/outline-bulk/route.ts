import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { SeriesBibleSchema } from "@/lib/schemas";
import { generateBulkOutlines } from "@/lib/ai";
import { getContinuity } from "@/lib/continuity";

const BulkOutlineReqSchema = z
  .object({
    seriesId: z.string().min(1),
    fromEps: z.number().int().min(1),
    toEps: z.number().int().min(1),
  })
  .refine((d) => d.toEps >= d.fromEps, {
    message: "Nomor episode akhir harus >= episode awal",
  })
  .refine((d) => d.toEps - d.fromEps + 1 <= 20, {
    message: "Maksimal 20 episode sekali bulk agar kualitas cerita terjaga",
  });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = BulkOutlineReqSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Rentang episode tidak valid" },
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
    const continuity = await getContinuity(series.id);

    const result = await generateBulkOutlines({
      seriesName: series.name,
      tone: series.tone,
      bible,
      fromEps: parsed.data.fromEps,
      toEps: parsed.data.toEps,
      continuity,
    });

    return NextResponse.json({ ...result, continuity });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal membuat outline bulk" },
      { status: 500 }
    );
  }
}
