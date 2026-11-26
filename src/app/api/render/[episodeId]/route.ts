import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { renderEpisodeToMp4 } from "@/lib/renderer";
import { processNextQueueItem } from "@/lib/queue-worker";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ episodeId: string }> }
) {
  const { episodeId } = await context.params;
  try {
    const body = await req.json().catch(() => ({}));
    const mode = (body?.mode as "immediate" | "queue") || "queue";

    const episode = await db.episode.findUnique({ where: { id: episodeId } });
    if (!episode) {
      return NextResponse.json({ error: "Episode tidak ditemukan" }, { status: 404 });
    }

    if (mode === "immediate") {
      const result = await renderEpisodeToMp4({ episodeId });
      return NextResponse.json({ ok: true, ...result });
    }

    const maxPos = await db.queueItem.aggregate({ _max: { position: true } });
    const item = await db.queueItem.create({
      data: {
        episodeId,
        position: (maxPos._max.position ?? 0) + 1,
        status: "queued",
        progress: 0,
      },
    });
    void processNextQueueItem();

    return NextResponse.json({ ok: true, queueItem: item }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal merender episode" },
      { status: 500 }
    );
  }
}
