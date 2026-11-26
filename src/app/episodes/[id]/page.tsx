import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { EpisodeScript, SeriesBible } from "@/lib/schemas";
import { getContinuity } from "@/lib/continuity";
import { EpisodeScriptClient } from "@/components/script-editor/EpisodeScriptClient";

export const dynamic = "force-dynamic";

export default async function EpisodeScriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const episode = await db.episode.findUnique({
    where: { id },
    include: { series: true },
  });

  if (!episode) notFound();

  const continuity = await getContinuity(episode.seriesId);

  return (
    <EpisodeScriptClient
      episode={{
        id: episode.id,
        number: episode.number,
        title: episode.title,
        status: episode.status,
        hook: episode.hook,
        twist: episode.twist,
        cliffhanger: episode.cliffhanger,
        cliffhangerFrom: episode.cliffhangerFrom,
        script: episode.script as unknown as EpisodeScript,
      }}
      series={{
        id: episode.series.id,
        name: episode.series.name,
      }}
      bible={episode.series.bible as unknown as SeriesBible}
      continuitySummary={continuity?.threeLineSummary ?? null}
    />
  );
}
