import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, logActivity } from "@/lib/db";
import { BulkOutlineItemSchema, ScriptLine, SeriesBibleSchema } from "@/lib/schemas";
import { generateScriptLines } from "@/lib/ai";
import { buildDefaultShotsFromLines } from "@/lib/bible";

const BulkPostSchema = z.object({
  seriesId: z.string().min(1),
  outlines: z.array(BulkOutlineItemSchema).min(1, "Minimal 1 outline episode"),
  generateScripts: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = BulkPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data bulk tidak valid" },
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

    // Validasi tidak ada hook/twist duplikat
    const hooks = new Set<string>();
    for (const item of parsed.data.outlines) {
      const normHook = item.hook.trim().toLowerCase();
      if (hooks.has(normHook)) {
        return NextResponse.json(
          { error: `Ditemukan hook duplikat di Episode ${item.number}. Setiap episode harus unik.` },
          { status: 400 }
        );
      }
      hooks.add(normHook);
    }

    const createdEpisodes = [];
    let runningCliffhanger = bible.continuity.activeCliffhanger || "";

    for (const item of parsed.data.outlines) {
      const cliffFrom = item.cliffhangerFrom || runningCliffhanger || null;

      let lines: ScriptLine[] = [
        {
          id: "line-1",
          beat: "hook",
          speaker: bible.characters[0]?.name ?? "Raka",
          text: item.hook,
          emotion: "kaget",
          durationSec: 2.5,
          setId: bible.sets[0]?.id ?? "set-1",
        },
      ];

      if (parsed.data.generateScripts) {
        const res = await generateScriptLines({
          seriesName: series.name,
          tone: series.tone,
          bible,
          title: item.title,
          hook: item.hook,
          conflict: item.conflict,
          twist: item.twist,
          cliffhanger: item.cliffhanger,
          cliffhangerFrom: cliffFrom,
        });
        lines = res.lines.map((l) => ({
          ...l,
          setId: l.setId ?? bible.sets[0]?.id ?? "set-1",
        }));
      }

      const shots = buildDefaultShotsFromLines(lines, []);
      const durationSec = Number(
        lines.reduce((acc, l) => acc + l.durationSec, 0).toFixed(2)
      );

      const ep = await db.episode.upsert({
        where: {
          seriesId_number: {
            seriesId: series.id,
            number: item.number,
          },
        },
        update: {
          title: item.title,
          hook: item.hook,
          twist: item.twist,
          cliffhanger: item.cliffhanger,
          cliffhangerFrom: cliffFrom,
          script: { lines, setId: bible.sets[0]?.id ?? "set-1", continuityConfirmed: true },
          shots: { shots },
          durationSec,
          status: parsed.data.generateScripts ? "script" : "draft",
        },
        create: {
          seriesId: series.id,
          number: item.number,
          title: item.title,
          hook: item.hook,
          twist: item.twist,
          cliffhanger: item.cliffhanger,
          cliffhangerFrom: cliffFrom,
          script: { lines, setId: bible.sets[0]?.id ?? "set-1", continuityConfirmed: true },
          shots: { shots },
          durationSec,
          status: parsed.data.generateScripts ? "script" : "draft",
        },
      });

      createdEpisodes.push(ep);
      runningCliffhanger = item.cliffhanger;
    }

    await logActivity({
      seriesId: series.id,
      level: "success",
      message: `Bulk ${createdEpisodes.length} naskah episode selesai (${series.name})`,
      detail: `Eps ${parsed.data.outlines[0].number}–${parsed.data.outlines[parsed.data.outlines.length - 1].number}`,
    });

    return NextResponse.json({ episodes: createdEpisodes }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memproses bulk episode" },
      { status: 500 }
    );
  }
}
