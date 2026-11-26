import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SeriesBible } from "@/lib/schemas";
import { SetBuilderClient } from "@/components/set-preview/SetBuilderClient";

export const dynamic = "force-dynamic";

export default async function SetsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [series, propAssets] = await Promise.all([
    db.series.findUnique({ where: { id } }),
    db.asset.findMany({
      where: { kind: "prop", OR: [{ seriesId: id }, { seriesId: null }] },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!series) notFound();

  return (
    <SetBuilderClient
      series={{
        id: series.id,
        name: series.name,
        visualStyle: series.visualStyle,
        bibleVersion: series.bibleVersion,
      }}
      initialBible={series.bible as unknown as SeriesBible}
      uploadedProps={propAssets.map((a) => ({ id: a.id, name: a.name, path: a.path }))}
    />
  );
}
