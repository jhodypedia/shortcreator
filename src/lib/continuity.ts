import { db } from "./db";
import { SeriesBible, SeriesBibleSchema } from "./schemas";

export interface ContinuitySnapshot {
  seriesId: string;
  seriesName: string;
  lastEpisodeNumber: number;
  lastEpisodeTitle: string | null;
  summary: string;
  activeCliffhanger: string;
  threads: string[];
  characterChanges: string[];
  threeLineSummary: [string, string, string];
}

export function buildContinuityFromData(params: {
  seriesId: string;
  seriesName: string;
  bible: SeriesBible;
  lastEpisode: {
    number: number;
    title: string;
    hook: string;
    twist: string;
    cliffhanger: string;
    status: string;
    review?: unknown;
  } | null;
}): ContinuitySnapshot {
  const { seriesId, seriesName, bible, lastEpisode } = params;
  const summary =
    bible.continuity.summary ||
    (lastEpisode
      ? `Episode ${lastEpisode.number} ("${lastEpisode.title}"): ${lastEpisode.twist}`
      : "Belum ada episode sebelumnya.");
  const activeCliffhanger =
    bible.continuity.activeCliffhanger || lastEpisode?.cliffhanger || "";

  const characterStates = Object.entries(bible.continuity.characterStates ?? {}).map(
    ([k, v]) => `${k}: ${v}`
  );

  const line1 = lastEpisode
    ? `Sudah terjadi (Eps ${lastEpisode.number}): ${summary}`
    : `Kondisi awal: ${bible.premise}`;
  const line2 = activeCliffhanger
    ? `Cliffhanger menggantung: ${activeCliffhanger}`
    : "Cliffhanger aktif: Belum ada (episode pembuka).";
  const line3 =
    characterStates.length > 0
      ? `Perubahan karakter: ${characterStates.join("; ")}`
      : `Karakter siap beraksi: ${bible.characters.map((c) => c.name).join(", ")}`;

  return {
    seriesId,
    seriesName,
    lastEpisodeNumber: lastEpisode?.number ?? 0,
    lastEpisodeTitle: lastEpisode?.title ?? null,
    summary,
    activeCliffhanger,
    threads: bible.continuity.threads ?? [],
    characterChanges: characterStates,
    threeLineSummary: [line1, line2, line3],
  };
}

export async function getContinuity(seriesId: string): Promise<ContinuitySnapshot | null> {
  const series = await db.series.findUnique({
    where: { id: seriesId },
    include: {
      episodes: {
        orderBy: { number: "desc" },
      },
    },
  });

  if (!series) return null;
  const parsedBible = SeriesBibleSchema.safeParse(series.bible);
  if (!parsedBible.success) return null;

  const doneEpisodes = series.episodes.filter((ep) => ep.status === "done");
  const lastEpisode = doneEpisodes[0] ?? series.episodes[0] ?? null;

  return buildContinuityFromData({
    seriesId: series.id,
    seriesName: series.name,
    bible: parsedBible.data,
    lastEpisode,
  });
}

export async function applyEpisodeDone(
  seriesId: string,
  episode: {
    number: number;
    title: string;
    twist: string;
    cliffhanger: string;
    cliffhangerFrom?: string | null;
    script?: { lines?: Array<{ speaker: string; emotion: string; text: string }> } | null;
  }
) {
  const series = await db.series.findUnique({
    where: { id: seriesId },
  });
  if (!series) throw new Error("Series tidak ditemukan");

  const parsedBible = SeriesBibleSchema.parse(series.bible);
  const existingThreads = parsedBible.continuity.threads ?? [];

  const updatedThreads = [...existingThreads];
  if (episode.cliffhanger && !updatedThreads.includes(episode.cliffhanger)) {
    updatedThreads.unshift(episode.cliffhanger);
  }

  const characterStates = { ...(parsedBible.continuity.characterStates ?? {}) };
  const lastLines = episode.script?.lines ?? [];
  for (const line of lastLines) {
    if (line.emotion !== "netral") {
      characterStates[line.speaker] = `Terakhir terlihat ${line.emotion} di Eps ${episode.number}`;
    }
  }

  const nextSummary = `Eps ${episode.number} ("${episode.title}"): ${episode.twist}.`;
  const nextVersion = series.bibleVersion + 1;

  const nextBible: SeriesBible = {
    ...parsedBible,
    continuity: {
      summary: nextSummary,
      activeCliffhanger: episode.cliffhanger,
      threads: updatedThreads.slice(0, 10),
      characterStates,
    },
    changelog: [
      {
        date: new Date().toISOString().slice(0, 10),
        version: nextVersion,
        change: `Update continuity otomatis dari Episode ${episode.number}`,
        reason: `Episode ${episode.number} selesai (Done)`,
      },
      ...(parsedBible.changelog ?? []),
    ].slice(0, 30),
  };

  await db.series.update({
    where: { id: seriesId },
    data: {
      bible: nextBible,
      bibleVersion: nextVersion,
    },
  });

  return { bible: nextBible, bibleVersion: nextVersion };
}

export function validateSequelEpisode(params: {
  activeCliffhanger: string;
  hook: string;
  scriptTexts: string[];
  nextCliffhanger: string;
  continuityConfirmed?: boolean;
  continuityNote?: string;
}): { ok: true } | { ok: false; error: string } {
  if (!params.nextCliffhanger || params.nextCliffhanger.trim().length < 4) {
    return {
      ok: false,
      error:
        "Peringatan keras: Episode lanjutan WAJIB menyisakan cliffhanger baru agar benang cerita tidak putus.",
    };
  }

  if (!params.activeCliffhanger.trim()) {
    return { ok: true };
  }

  const stopWords = new Set(["yang", "dan", "di", "ke", "dari", "ini", "itu", "ada", "apa", "dengan"]);
  const keywords = params.activeCliffhanger
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stopWords.has(w));

  const combinedText = `${params.hook} ${params.scriptTexts.join(" ")}`.toLowerCase();
  const hasKeywordMatch = keywords.some((kw) => combinedText.includes(kw));

  if (!hasKeywordMatch && !params.continuityConfirmed) {
    return {
      ok: false,
      error:
        "Episode lanjutan harus menyebut/menjawab cliffhanger sebelumnya, atau centang konfirmasi bahwa cliffhanger sengaja ditunda beserta alasannya.",
    };
  }

  if (params.continuityConfirmed && (!params.continuityNote || params.continuityNote.trim().length < 3)) {
    return {
      ok: false,
      error: "Tuliskan alasan penundaan/penyelesaian cliffhanger di kolom konfirmasi.",
    };
  }

  return { ok: true };
}
