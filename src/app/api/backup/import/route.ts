import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { db, logActivity } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "File backup .zip belum dipilih" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const zip = await JSZip.loadAsync(buf);

    const dataFile = zip.file("backup-data.json");
    if (!dataFile) {
      return NextResponse.json(
        { error: "File backup tidak valid (backup-data.json tidak ditemukan)" },
        { status: 400 }
      );
    }

    const raw = await dataFile.async("text");
    const parsed = JSON.parse(raw) as {
      series?: Array<{
        id: string;
        name: string;
        theme: string;
        audience: string;
        tone: string;
        language: string;
        visualStyle: string;
        bible: object;
        bibleVersion: number;
        episodes?: Array<{
          id: string;
          number: number;
          title: string;
          status: string;
          hook: string;
          twist: string;
          cliffhanger: string;
          cliffhangerFrom?: string | null;
          script: object;
          voiceTiming?: object | null;
          shots: object;
          durationSec?: number | null;
          totalFrames?: number | null;
          audioFiles?: object | null;
          renderPath?: string | null;
          review?: object | null;
          publish?: object | null;
        }>;
      }>;
    };

    if (!Array.isArray(parsed.series)) {
      return NextResponse.json(
        { error: "Format data series di dalam backup tidak valid" },
        { status: 400 }
      );
    }

    let restoredSeries = 0;
    let restoredEpisodes = 0;

    for (const s of parsed.series) {
      await db.series.upsert({
        where: { id: s.id },
        update: {
          name: s.name,
          theme: s.theme,
          audience: s.audience,
          tone: s.tone,
          language: s.language,
          visualStyle: s.visualStyle,
          bible: s.bible,
          bibleVersion: s.bibleVersion,
        },
        create: {
          id: s.id,
          name: s.name,
          theme: s.theme,
          audience: s.audience,
          tone: s.tone,
          language: s.language,
          visualStyle: s.visualStyle,
          bible: s.bible,
          bibleVersion: s.bibleVersion,
        },
      });
      restoredSeries++;

      for (const ep of s.episodes ?? []) {
        await db.episode.upsert({
          where: {
            seriesId_number: { seriesId: s.id, number: ep.number },
          },
          update: {
            title: ep.title,
            status: ep.status,
            hook: ep.hook,
            twist: ep.twist,
            cliffhanger: ep.cliffhanger,
            cliffhangerFrom: ep.cliffhangerFrom ?? null,
            script: ep.script,
            voiceTiming: ep.voiceTiming ?? undefined,
            shots: ep.shots,
            durationSec: ep.durationSec ?? null,
            totalFrames: ep.totalFrames ?? null,
            audioFiles: ep.audioFiles ?? undefined,
            renderPath: ep.renderPath ?? null,
            review: ep.review ?? undefined,
            publish: ep.publish ?? undefined,
          },
          create: {
            id: ep.id,
            seriesId: s.id,
            number: ep.number,
            title: ep.title,
            status: ep.status,
            hook: ep.hook,
            twist: ep.twist,
            cliffhanger: ep.cliffhanger,
            cliffhangerFrom: ep.cliffhangerFrom ?? null,
            script: ep.script,
            voiceTiming: ep.voiceTiming ?? undefined,
            shots: ep.shots,
            durationSec: ep.durationSec ?? null,
            totalFrames: ep.totalFrames ?? null,
            audioFiles: ep.audioFiles ?? undefined,
            renderPath: ep.renderPath ?? null,
            review: ep.review ?? undefined,
            publish: ep.publish ?? undefined,
          },
        });
        restoredEpisodes++;
      }
    }

    await logActivity({
      level: "success",
      message: `Backup berhasil direstore (${restoredSeries} series, ${restoredEpisodes} episode)`,
    });

    return NextResponse.json({
      ok: true,
      restoredSeries,
      restoredEpisodes,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal restore backup" },
      { status: 500 }
    );
  }
}
