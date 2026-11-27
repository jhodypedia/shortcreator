import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { renderEpisodeToMp4 } from "@/lib/renderer";
import { processNextQueueItem } from "@/lib/queue-worker";
import { getAppSettings } from "@/lib/settings";
import { gflowStatus } from "@/lib/gflow";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ episodeId: string }> }
) {
  const { episodeId } = await context.params;
  try {
    const body = await req.json().catch(() => ({}));
    const settings = (await getAppSettings()).publicSettings.render;
    const mode = (body?.mode as "immediate" | "queue" | "generate") || "queue";

    const episode = await db.episode.findUnique({ where: { id: episodeId } });
    if (!episode) {
      return NextResponse.json({ error: "Episode tidak ditemukan" }, { status: 404 });
    }

    if (mode === "generate") {
      if (settings.provider !== "gflow-cli") return NextResponse.json({ error: "Pilih provider Google Flow pada Pengaturan untuk membuat video langsung." }, { status: 409 });
      const status = await gflowStatus();
      if (!status.installed || !status.authenticated) return NextResponse.json({ error: status.detail || "gflow/Google Flow belum siap pada server." }, { status: 503 });
      const alreadyQueued = await db.queueItem.findFirst({ where: { episodeId, status: { in: ["queued", "rendering"] } } });
      if (alreadyQueued) return NextResponse.json({ error: "Episode ini sudah berada di antrean." }, { status: 409 });
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
