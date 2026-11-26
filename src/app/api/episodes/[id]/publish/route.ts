import { NextRequest, NextResponse } from "next/server";
import { db, logActivity } from "@/lib/db";
import { EpisodePublishSchema } from "@/lib/schemas";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const episode = await db.episode.findUnique({
      where: { id },
      include: { series: true },
    });
    if (!episode) {
      return NextResponse.json({ error: "Episode tidak ditemukan" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = EpisodePublishSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data publish tidak valid" },
        { status: 400 }
      );
    }

    const updated = await db.episode.update({
      where: { id },
      data: { publish: parsed.data },
    });

    await logActivity({
      seriesId: episode.seriesId,
      episodeId: episode.id,
      level: "info",
      message: `Tracking publish diperbarui: ${episode.series.name} Eps ${episode.number}`,
      detail: `${parsed.data.platform} • ${parsed.data.views} views`,
    });

    return NextResponse.json({ episode: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menyimpan publish tracking" },
      { status: 500 }
    );
  }
}
