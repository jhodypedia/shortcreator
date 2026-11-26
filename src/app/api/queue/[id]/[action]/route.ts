import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processNextQueueItem } from "@/lib/queue-worker";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string; action: string }> }
) {
  const { id, action } = await context.params;
  const item = await db.queueItem.findUnique({ where: { id } });

  if (!item) {
    return NextResponse.json({ error: "Item antrean tidak ditemukan" }, { status: 404 });
  }

  if (action === "pause") {
    const updated = await db.queueItem.update({
      where: { id },
      data: { status: "cancelled", lastError: "Dijeda/ditahan dari antrean" },
    });
    return NextResponse.json({ item: updated });
  }

  if (action === "resume" || action === "retry") {
    const updated = await db.queueItem.update({
      where: { id },
      data: {
        status: "queued",
        progress: 0,
        lastError: null,
        ...(action === "retry" ? { attempts: 0 } : {}),
      },
    });
    await db.queueControl.upsert({
      where: { id: "default" },
      update: { isPaused: false, stopReason: null },
      create: { id: "default", isPaused: false, stopReason: null },
    });
    void processNextQueueItem();
    return NextResponse.json({ item: updated });
  }

  if (action === "cancel") {
    const updated = await db.queueItem.update({
      where: { id },
      data: { status: "cancelled" },
    });
    return NextResponse.json({ item: updated });
  }

  if (action === "up" || action === "down") {
    const all = await db.queueItem.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    const idx = all.findIndex((i) => i.id === id);
    const swapIdx = action === "up" ? idx - 1 : idx + 1;
    if (idx !== -1 && swapIdx >= 0 && swapIdx < all.length) {
      const other = all[swapIdx];
      await db.$transaction([
        db.queueItem.update({ where: { id: item.id }, data: { position: other.position } }),
        db.queueItem.update({ where: { id: other.id }, data: { position: item.position } }),
      ]);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Aksi antrean tidak dikenal" }, { status: 400 });
}
