import { db } from "@/lib/db";
import { SeriesListClient } from "@/components/series-list-client";

export const dynamic = "force-dynamic";

export default async function SeriesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const sp = await searchParams;
  const series = await db.series.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, name: true, theme: true, audience: true, tone: true, language: true,
      visualStyle: true, bibleVersion: true, bible: true, updatedAt: true,
      episodes: { orderBy: { number: "asc" }, select: { id: true, number: true, title: true, status: true } },
    },
  });

  return (
    <SeriesListClient
      initialSeries={series}
      openNewDefault={sp.new === "1"}
    />
  );
}
