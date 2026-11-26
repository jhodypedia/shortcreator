import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const control = await db.queueControl.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", isPaused: false },
  });

  const items = await db.queueItem.findMany({
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
          renderPath: true,
          review: true,
          series: {
            select: {
              id: true,
              name: true,
              visualStyle: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ control, items });
}
