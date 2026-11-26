import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { db } from "@/lib/db";

async function buildBackupZipBuffer() {
  const zip = new JSZip();

  const dbPath = path.join(process.cwd(), "prisma", "dev.db");
  try {
    const dbBytes = await fs.readFile(dbPath);
    zip.file("prisma/dev.db", dbBytes);
  } catch {
    // abaikan jika file belum ada
  }

  const allSeries = await db.series.findMany({
    include: { episodes: true },
  });

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    app: "short-generator",
    series: allSeries,
  };
  zip.file("backup-data.json", JSON.stringify(exportPayload, null, 2));

  for (const s of allSeries) {
    const slug =
      s.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || s.id;
    zip.file(
      `bibles/${slug}/series-bible.json`,
      JSON.stringify(
        {
          id: s.id,
          name: s.name,
          theme: s.theme,
          audience: s.audience,
          tone: s.tone,
          language: s.language,
          visualStyle: s.visualStyle,
          bibleVersion: s.bibleVersion,
          bible: s.bible,
        },
        null,
        2
      )
    );
  }

  return zip.generateAsync({ type: "nodebuffer" });
}

export async function GET() {
  const buffer = await buildBackupZipBuffer();
  const filename = `short-generator-backup-${new Date().toISOString().slice(0, 10)}.zip`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function POST() {
  return GET();
}
