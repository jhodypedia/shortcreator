import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { EpisodeScript, SeriesBible, ShotItem } from "@/lib/schemas";
import { EpisodeShotsClient } from "@/components/shot-editor/EpisodeShotsClient";

export const dynamic = "force-dynamic";

export default async function EpisodeShotsPage({
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

  const rawShots = (episode.shots as { shots?: ShotItem[] })?.shots ?? [];

  return (
    <EpisodeShotsClient
      episode={{
        id: episode.id,
        number: episode.number,
        title: episode.title,
        status: episode.status,
        script: episode.script as unknown as EpisodeScript,
        shots: rawShots,
      }}
      series={{
        id: episode.series.id,
        name: episode.series.name,
        visualStyle: episode.series.visualStyle,
      }}
      bible={episode.series.bible as unknown as SeriesBible}
    />
  );
}
