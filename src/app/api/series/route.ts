import { NextRequest, NextResponse } from "next/server";
import { db, logActivity } from "@/lib/db";
import { createDefaultBible } from "@/lib/bible";
import { CreateSeriesInputSchema } from "@/lib/schemas";

export async function GET() {
  const series = await db.series.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      episodes: {
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          hook: true,
          durationSec: true,
          renderPath: true,
          publish: true,
          updatedAt: true,
        },
      },
    },
  });
  return NextResponse.json({ series });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateSeriesInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data series tidak valid" },
        { status: 400 }
      );
    }

    const bible =
      parsed.data.bible ??
      createDefaultBible({
        name: parsed.data.name,
        theme: parsed.data.theme,
        tone: parsed.data.tone,
        visualStyle: parsed.data.visualStyle,
      });

    const created = await db.series.create({
      data: {
        name: parsed.data.name,
        theme: parsed.data.theme,
        audience: parsed.data.audience,
        tone: parsed.data.tone,
        language: parsed.data.language,
        visualStyle: parsed.data.visualStyle,
        bible,
        bibleVersion: 1,
      },
    });

    await logActivity({
      seriesId: created.id,
      level: "success",
      message: `Series baru dibuat: ${created.name}`,
      detail: `${created.visualStyle} • tone ${created.tone}`,
    });

    return NextResponse.json({ series: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal membuat series" },
      { status: 500 }
    );
  }
}
