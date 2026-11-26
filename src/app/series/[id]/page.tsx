import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SeriesBible } from "@/lib/schemas";
import { BibleEditorClient } from "@/components/bible-editor/BibleEditorClient";
import { AiEpisodeGenerator } from "@/components/ai-episode-generator";
import { SeriesHeaderNav } from "@/components/series-nav";

export const dynamic = "force-dynamic";

export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const series = await db.series.findUnique({
    where: { id },
  });

  if (!series) notFound();

  return (
    <div className="space-y-4">
    <SeriesHeaderNav seriesId={series.id} seriesName={series.name} bibleVersion={series.bibleVersion} accentColor={(series.bible as unknown as SeriesBible).visualStyle?.accentColor} emoji={(series.bible as unknown as SeriesBible).visualStyle?.emoji} />
    <AiEpisodeGenerator seriesId={series.id} />
    <BibleEditorClient
      series={{
        id: series.id,
        name: series.name,
        theme: series.theme,
        audience: series.audience,
        tone: series.tone,
        language: series.language,
        visualStyle: series.visualStyle,
        bibleVersion: series.bibleVersion,
      }}
      initialBible={series.bible as unknown as SeriesBible}
    />
    </div>
  );
}
