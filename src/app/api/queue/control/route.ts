import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { processNextQueueItem } from "@/lib/queue-worker";

const ControlSchema = z.object({
  action: z.enum(["pause-all", "resume-all", "cancel-all", "run-next"]),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ControlSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Aksi kontrol tidak valid" }, { status: 400 });
    }

    if (parsed.data.action === "pause-all") {
      const control = await db.queueControl.upsert({
        where: { id: "default" },
        update: { isPaused: true, stopReason: "Antrean dijeda manual oleh pengguna." },
        create: { id: "default", isPaused: true, stopReason: "Antrean dijeda manual." },
      });
      return NextResponse.json({ control });
    }

    if (parsed.data.action === "resume-all") {
      const control = await db.queueControl.upsert({
        where: { id: "default" },
        update: { isPaused: false, stopReason: null },
        create: { id: "default", isPaused: false, stopReason: null },
      });
      void processNextQueueItem();
      return NextResponse.json({ control });
    }

    if (parsed.data.action === "cancel-all") {
      await db.queueItem.updateMany({
        where: { status: { in: ["queued", "paused"] } },
        data: { status: "cancelled" },
      });
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.action === "run-next") {
      void processNextQueueItem();
      return NextResponse.json({ ok: true, message: "Worker dijalankan" });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal mengontrol antrean" },
      { status: 500 }
    );
  }
}
