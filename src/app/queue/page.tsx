import { db } from "@/lib/db";
import { QueueClient } from "@/components/queue-client";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const [control, items] = await Promise.all([
    db.queueControl.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default", isPaused: false },
    }),
    db.queueItem.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: {
        episode: {
          select: {
            id: true,
            number: true,
            title: true,
            hook: true,
            status: true,
            durationSec: true,
            totalFrames: true,
            renderPath: true,
            series: { select: { id: true, name: true, visualStyle: true } },
          },
        },
      },
    }),
  ]);

  return (
    <QueueClient
      initialItems={items}
      initialControl={{
        isPaused: control.isPaused,
        stopReason: control.stopReason,
      }}
    />
  );
}
