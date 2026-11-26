import { NextRequest, NextResponse } from "next/server";
import { db, logActivity } from "@/lib/db";
import { createDefaultBible } from "@/lib/bible";
import { CreateSeriesInputSchema, SeriesBibleSchema } from "@/lib/schemas";
import { runAiRoleJson } from "@/lib/ai/runner";

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

    let bible: unknown = parsed.data.bible;
    if (!bible) {
      let generated: Awaited<ReturnType<typeof runAiRoleJson>> | undefined;
      let generationError: string | undefined;
      try {
        generated = await runAiRoleJson("bibleWriter", { idea: `${parsed.data.name}: ${parsed.data.theme}. Audiens ${parsed.data.audience}, tone ${parsed.data.tone}, gaya ${parsed.data.visualStyle}. Buat Bible awal yang valid dengan karakter dan set.` });
      } catch (error) {
        generationError = error instanceof Error ? error.message : String(error);
      }
      if (generationError) {
        return NextResponse.json({ error: `AI belum dapat membuat Bible: ${generationError}. Coba lagi atau gunakan model lain di Pengaturan → AI.` }, { status: 503 });
      }
      if (!generated) return NextResponse.json({ error: "AI belum menghasilkan Bible. Silakan coba lagi." }, { status: 503 });
      const defaults = createDefaultBible({ name: parsed.data.name, theme: parsed.data.theme, tone: parsed.data.tone, visualStyle: parsed.data.visualStyle });
      let candidate: unknown = { ...defaults, ...generated.data };
      let validation = SeriesBibleSchema.safeParse(candidate);
      if (!validation.success) {
        const repaired = await runAiRoleJson("bibleWriter", { idea: `Perbaiki Bible berikut agar valid. Error Zod: ${validation.error.message}\nBible: ${JSON.stringify(candidate)}` });
        candidate = { ...defaults, ...repaired.data };
        validation = SeriesBibleSchema.safeParse(candidate);
      }
      if (!validation.success) {
        return NextResponse.json({ error: "Bible AI tidak valid setelah satu kali perbaikan.", details: validation.error.issues }, { status: 422 });
      }
      bible = validation.data;
    }

    const validatedBible = SeriesBibleSchema.safeParse(bible);
    if (!validatedBible.success) return NextResponse.json({ error: "Bible tidak valid.", details: validatedBible.error.issues }, { status: 422 });
    bible = validatedBible.data;

    const created = await db.series.create({
      data: {
        name: parsed.data.name,
        theme: parsed.data.theme,
        audience: parsed.data.audience,
        tone: parsed.data.tone,
        language: parsed.data.language,
        visualStyle: parsed.data.visualStyle,
        bible: bible as import("@prisma/client").Prisma.InputJsonValue,
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
