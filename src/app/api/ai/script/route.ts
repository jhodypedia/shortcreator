import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { SeriesBibleSchema } from "@/lib/schemas";
import { generateScriptLines } from "@/lib/ai";

const ScriptReqSchema = z.object({
  seriesId: z.string().min(1),
  title: z.string().default("Episode Baru"),
  hook: z.string().min(1, "Hook wajib diisi"),
  conflict: z.string().default("Masalah mulai membesar"),
  twist: z.string().default("Ada fakta tak terduga"),
  payoff: z.string().optional(),
  cliffhanger: z.string().default("Misteri baru muncul"),
  cliffhangerFrom: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ScriptReqSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Input naskah tidak valid" },
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
    const result = await generateScriptLines({
      seriesName: series.name,
      tone: series.tone,
      bible,
      title: parsed.data.title,
      hook: parsed.data.hook,
      conflict: parsed.data.conflict,
      twist: parsed.data.twist,
      payoff: parsed.data.payoff,
      cliffhanger: parsed.data.cliffhanger,
      cliffhangerFrom: parsed.data.cliffhangerFrom,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menulis naskah" },
      { status: 500 }
    );
  }
}
