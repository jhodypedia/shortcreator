import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, logActivity } from "@/lib/db";

const EnqueueSchema = z.object({
  episodeIds: z.array(z.string().min(1)).min(1, "Pilih minimal 1 episode untuk antrean"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = EnqueueSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Input antrean tidak valid" },
        { status: 400 }
      );
    }

    const episodes = await db.episode.findMany({
      where: { id: { in: parsed.data.episodeIds } },
      include: { series: true },
      orderBy: { number: "asc" },
    });

    if (episodes.length === 0) {
      return NextResponse.json({ error: "Episode tidak ditemukan" }, { status: 404 });
    }

    const maxPos = await db.queueItem.aggregate({ _max: { position: true } });
    let pos = (maxPos._max.position ?? 0) + 1;

    const createdItems = [];
    for (const ep of episodes) {
      const existingActive = await db.queueItem.findFirst({
        where: {
          episodeId: ep.id,
          status: { in: ["queued", "rendering"] },
        },
      });
      if (existingActive) {
        createdItems.push(existingActive);
        continue;
      }

      const item = await db.queueItem.create({
        data: {
          episodeId: ep.id,
          position: pos++,
          status: "queued",
          progress: 0,
          attempts: 0,
        },
      });
      createdItems.push(item);
    }

    await logActivity({
      seriesId: episodes[0].seriesId,
      level: "info",
      message: `${createdItems.length} episode dimasukkan ke antrean render`,
      detail: episodes.map((e) => `Eps ${e.number}`).join(", "),
    });

    return NextResponse.json({ items: createdItems }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memasukkan antrean" },
      { status: 500 }
    );
  }
}
