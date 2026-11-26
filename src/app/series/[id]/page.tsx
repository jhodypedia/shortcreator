import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SeriesBible } from "@/lib/schemas";
import { BibleEditorClient } from "@/components/bible-editor/BibleEditorClient";

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
  );
}
