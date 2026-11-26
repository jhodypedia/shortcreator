import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { EpisodeReview, SeriesBible } from "@/lib/schemas";
import { ReviewClient } from "@/components/review-client";

export const dynamic = "force-dynamic";

export default async function EpisodeReviewPage({
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
    <ReviewClient
      episode={{
        id: episode.id,
        number: episode.number,
        title: episode.title,
        status: episode.status,
        renderPath: episode.renderPath,
        review: (episode.review as unknown as EpisodeReview) ?? null,
      }}
      series={{ id: episode.series.id, name: episode.series.name }}
      bible={episode.series.bible as unknown as SeriesBible}
    />
  );
}
