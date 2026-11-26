import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, logActivity } from "@/lib/db";
import {
  EpisodeScriptSchema,
  SeriesBibleSchema,
  ShotListSchema,
} from "@/lib/schemas";
import { buildDefaultShotsFromLines } from "@/lib/bible";
import { getContinuity, validateSequelEpisode } from "@/lib/continuity";

const CreateEpisodeSchema = z.object({
  seriesId: z.string().min(1, "ID series wajib diisi"),
  number: z.number().int().min(1).optional(),
  title: z.string().min(1, "Judul episode wajib diisi"),
  hook: z.string().min(1, "Hook wajib diisi"),
  twist: z.string().default("Twist sedang disusun"),
  cliffhanger: z.string().default(""),
  cliffhangerFrom: z.string().nullable().optional(),
  isSequel: z.boolean().default(false),
  continuityConfirmed: z.boolean().optional(),
  continuityNote: z.string().optional(),
  script: EpisodeScriptSchema.optional(),
  shots: ShotListSchema.optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateEpisodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data episode tidak valid" },
        { status: 400 }
      );
    }

    const series = await db.series.findUnique({
      where: { id: parsed.data.seriesId },
      include: { episodes: { orderBy: { number: "desc" } } },
    });

    if (!series) {
      return NextResponse.json({ error: "Series tidak ditemukan" }, { status: 404 });
    }

    const bible = SeriesBibleSchema.parse(series.bible);
    const maxEp = series.episodes[0]?.number ?? 0;
    const number = parsed.data.number ?? maxEp + 1;

    const defaultSpeaker = bible.characters[0]?.name ?? "Raka";
    const defaultSetId = bible.sets[0]?.id ?? "set-1";

    const script = parsed.data.script ?? {
      lines: [
        {
          id: "line-1",
          beat: "hook" as const,
          speaker: defaultSpeaker,
          text: parsed.data.hook,
          emotion: "kaget" as const,
          durationSec: 2.4,
          setId: defaultSetId,
        },
      ],
      setId: defaultSetId,
    };

    if (parsed.data.isSequel || maxEp > 0) {
      const continuity = await getContinuity(series.id);
      if (continuity && continuity.activeCliffhanger) {
        const seqCheck = validateSequelEpisode({
          activeCliffhanger: continuity.activeCliffhanger,
          hook: parsed.data.hook,
          scriptTexts: script.lines.map((l) => l.text),
          nextCliffhanger: parsed.data.cliffhanger,
          continuityConfirmed: parsed.data.continuityConfirmed,
          continuityNote: parsed.data.continuityNote,
        });
        if (!seqCheck.ok) {
          return NextResponse.json({ error: seqCheck.error }, { status: 400 });
        }
      } else if (parsed.data.isSequel && !parsed.data.cliffhanger.trim()) {
        return NextResponse.json(
          {
            error:
              "Peringatan keras: Episode lanjutan wajib menyisakan cliffhanger baru.",
          },
          { status: 400 }
        );
      }
    }

    const shots = parsed.data.shots ?? {
      shots: buildDefaultShotsFromLines(script.lines, []),
    };

    const episode = await db.episode.create({
      data: {
        seriesId: series.id,
        number,
        title: parsed.data.title,
        status: script.lines.length > 1 ? "script" : "draft",
        hook: parsed.data.hook,
        twist: parsed.data.twist,
        cliffhanger: parsed.data.cliffhanger,
        cliffhangerFrom: parsed.data.cliffhangerFrom ?? null,
        script,
        shots,
        durationSec: Number(
          script.lines.reduce((sum, l) => sum + l.durationSec, 0).toFixed(2)
        ),
      },
    });

    await logActivity({
      seriesId: series.id,
      episodeId: episode.id,
      level: "info",
      message: `Episode ${episode.number} dibuat: ${episode.title}`,
    });

    return NextResponse.json({ episode }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal membuat episode" },
      { status: 500 }
    );
  }
}
