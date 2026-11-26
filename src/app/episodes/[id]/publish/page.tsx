import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { EpisodePublish, SeriesBible } from "@/lib/schemas";
import { PublishClient } from "@/components/publish-client";

export const dynamic = "force-dynamic";

export default async function EpisodePublishPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const episode = await db.episode.findUnique({
    where: { id },
    include: {
      series: {
        include: {
          episodes: { orderBy: { number: "asc" } },
        },
      },
    },
  });

  if (!episode) notFound();

  return (
    <PublishClient
      episode={{
        id: episode.id,
        number: episode.number,
        title: episode.title,
        status: episode.status,
        publish: (episode.publish as unknown as EpisodePublish) ?? null,
      }}
      series={{ id: episode.series.id, name: episode.series.name }}
      bible={episode.series.bible as unknown as SeriesBible}
      seriesEpisodes={episode.series.episodes.map((e) => ({
        id: e.id,
        number: e.number,
        title: e.title,
        hook: e.hook,
        publish: (e.publish as unknown as EpisodePublish) ?? null,
      }))}
    />
  );
}
