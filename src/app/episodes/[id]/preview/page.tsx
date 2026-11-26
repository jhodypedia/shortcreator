import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  EpisodeScript,
  SeriesBible,
  ShotItem,
  VoiceTiming,
} from "@/lib/schemas";
import { EpisodePreviewClient } from "@/components/player/EpisodePreviewClient";

export const dynamic = "force-dynamic";

export default async function EpisodePreviewPage({
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

  return (
    <EpisodePreviewClient
      episode={{
        id: episode.id,
        number: episode.number,
        title: episode.title,
        status: episode.status,
        hook: episode.hook,
        script: episode.script as unknown as EpisodeScript,
        voiceTiming: (episode.voiceTiming as unknown as VoiceTiming) ?? null,
        shots: (episode.shots as { shots: ShotItem[] }) ?? { shots: [] },
        audioFiles: (Array.isArray(episode.audioFiles) ? episode.audioFiles : []) as Array<{
          lineId: string;
          path: string;
          durationSec: number;
        }>,
        totalFrames: episode.totalFrames,
        renderPath: episode.renderPath,
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
