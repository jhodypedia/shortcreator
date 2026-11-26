import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { EpisodeScriptSchema, SeriesBibleSchema } from "@/lib/schemas";
import { generateLineAudio } from "@/lib/tts";

const TtsReqSchema = z.object({
  episodeId: z.string().min(1, "ID episode wajib diisi"),
  lineId: z.string().optional(), // jika kosong -> generate semua line
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = TtsReqSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Parameter TTS tidak valid" },
        { status: 400 }
      );
    }

    const episode = await db.episode.findUnique({
      where: { id: parsed.data.episodeId },
      include: { series: true },
    });

    if (!episode) {
      return NextResponse.json({ error: "Episode tidak ditemukan" }, { status: 404 });
    }

    const bible = SeriesBibleSchema.parse(episode.series.bible);
    const script = EpisodeScriptSchema.parse(episode.script);

    const targetLines = parsed.data.lineId
      ? script.lines.filter((l) => l.id === parsed.data.lineId)
      : script.lines;

    if (targetLines.length === 0) {
      return NextResponse.json({ error: "Baris naskah tidak ditemukan" }, { status: 404 });
    }

    const existingFiles = Array.isArray(episode.audioFiles)
      ? (episode.audioFiles as Array<{
          lineId: string;
          path: string;
          durationSec: number;
          providerUsed?: string;
        }>)
      : [];

    const map = new Map(existingFiles.map((f) => [f.lineId, f]));
    let lastNotice: string | undefined;
    let lastProvider = "";

    for (const line of targetLines) {
      const char = bible.characters.find((c) => c.name === line.speaker);
      const res = await generateLineAudio({
        episodeId: episode.id,
        lineId: line.id,
        text: line.text,
        voiceId: char?.voiceId,
        speed: char?.voiceSpeed,
        pitch: char?.voicePitch,
      });
      map.set(line.id, {
        lineId: line.id,
        path: res.path,
        durationSec: res.durationSec,
        providerUsed: res.providerUsed,
      });
      lastProvider = res.providerUsed;
      if (res.notice) lastNotice = res.notice;
    }

    const nextAudioFiles = Array.from(map.values());
    await db.episode.update({
      where: { id: episode.id },
      data: {
        audioFiles: nextAudioFiles,
        status: episode.status === "script" || episode.status === "draft" ? "timing" : episode.status,
      },
    });

    if (parsed.data.lineId) {
      const item = map.get(parsed.data.lineId)!;
      return NextResponse.json({
        path: item.path,
        durationSec: item.durationSec,
        providerUsed: lastProvider,
        notice: lastNotice,
        audioFiles: nextAudioFiles,
      });
    }

    return NextResponse.json({
      audioFiles: nextAudioFiles,
      providerUsed: lastProvider,
      notice: lastNotice,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal membuat audio TTS" },
      { status: 500 }
    );
  }
}
