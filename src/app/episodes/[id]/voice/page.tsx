import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { EpisodeScript, SeriesBible, VoiceTiming } from "@/lib/schemas";
import { EpisodeVoiceClient } from "@/components/timeline/EpisodeVoiceClient";

export const dynamic = "force-dynamic";

export default async function EpisodeVoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [episode, assets] = await Promise.all([
    db.episode.findUnique({ where: { id }, include: { series: true } }),
    db.asset.findMany({
      where: { kind: { in: ["sfx", "music"] } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!episode) notFound();

  return (
    <EpisodeVoiceClient
      episode={{
        id: episode.id,
        number: episode.number,
        title: episode.title,
        status: episode.status,
        script: episode.script as unknown as EpisodeScript,
        audioFiles: (Array.isArray(episode.audioFiles) ? episode.audioFiles : []) as Array<{
          lineId: string;
          path: string;
          durationSec: number;
          providerUsed?: string;
        }>,
        voiceTiming: (episode.voiceTiming as unknown as VoiceTiming) ?? null,
        durationSec: episode.durationSec,
        totalFrames: episode.totalFrames,
      }}
      series={{ id: episode.series.id, name: episode.series.name }}
      bible={episode.series.bible as unknown as SeriesBible}
      initialAssets={assets}
    />
  );
}
