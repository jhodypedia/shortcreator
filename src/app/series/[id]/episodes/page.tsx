import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SeriesBible } from "@/lib/schemas";
import { getContinuity } from "@/lib/continuity";
import { SeriesEpisodesClient } from "@/components/script-editor/SeriesEpisodesClient";

export const dynamic = "force-dynamic";

export default async function SeriesEpisodesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sequel?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const [series, continuity] = await Promise.all([
    db.series.findUnique({
      where: { id },
      include: { episodes: { orderBy: { number: "asc" } } },
    }),
    getContinuity(id),
  ]);

  if (!series) notFound();

  return (
    <SeriesEpisodesClient
      series={{
        id: series.id,
        name: series.name,
        bibleVersion: series.bibleVersion,
      }}
      bible={series.bible as unknown as SeriesBible}
      episodes={series.episodes}
      continuity={continuity}
      openSequelDefault={sp.sequel === "1"}
    />
  );
}
