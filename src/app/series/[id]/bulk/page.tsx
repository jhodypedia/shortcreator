import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SeriesBible } from "@/lib/schemas";
import { getContinuity } from "@/lib/continuity";
import { BulkWizardClient } from "@/components/bulk-wizard-client";

export const dynamic = "force-dynamic";

export default async function SeriesBulkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [series, continuity] = await Promise.all([
    db.series.findUnique({
      where: { id },
      include: { episodes: { orderBy: { number: "asc" } } },
    }),
    getContinuity(id),
  ]);

  if (!series) notFound();

  return (
    <BulkWizardClient
      series={{
        id: series.id,
        name: series.name,
        bibleVersion: series.bibleVersion,
      }}
      bible={series.bible as unknown as SeriesBible}
      initialEpisodes={series.episodes.map((e) => ({
        id: e.id,
        number: e.number,
        title: e.title,
        status: e.status,
        hook: e.hook,
        durationSec: e.durationSec,
        renderPath: e.renderPath,
      }))}
      continuity={continuity}
    />
  );
}
