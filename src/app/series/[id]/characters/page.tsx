import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SeriesBible } from "@/lib/schemas";
import { CharacterBuilderClient } from "@/components/character-preview/CharacterBuilderClient";

export const dynamic = "force-dynamic";

export default async function CharactersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const series = await db.series.findUnique({ where: { id } });
  if (!series) notFound();

  return (
    <CharacterBuilderClient
      series={{
        id: series.id,
        name: series.name,
        visualStyle: series.visualStyle,
        bibleVersion: series.bibleVersion,
      }}
      initialBible={series.bible as unknown as SeriesBible}
    />
  );
}
