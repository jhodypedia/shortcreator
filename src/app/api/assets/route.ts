import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind");
  const seriesId = req.nextUrl.searchParams.get("seriesId");

  const assets = await db.asset.findMany({
    where: {
      ...(kind ? { kind } : {}),
      ...(seriesId ? { OR: [{ seriesId }, { seriesId: null }] } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ assets });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const kind = (formData.get("kind") as string) || "sfx";
    const name = ((formData.get("name") as string) || file?.name || "Asset").trim();
    const category = ((formData.get("category") as string) || "umum").trim();
    const seriesId = (formData.get("seriesId") as string) || null;
    const episodeId = (formData.get("episodeId") as string) || null;
    const lineId = (formData.get("lineId") as string) || null;

    if (!file) {
      return NextResponse.json({ error: "File belum dipilih" }, { status: 400 });
    }

    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const subFolder = kind === "voice" && episodeId ? `audio/${episodeId}` : `uploads/${kind}`;
    const targetDir = path.join(process.cwd(), "storage", subFolder);
    await fs.mkdir(targetDir, { recursive: true });
    const diskPath = path.join(targetDir, safeName);
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(diskPath, buf);

    const apiPath = `/api/storage/${subFolder}/${safeName}`;

    // Jika ini upload audio rekaman voice-over untuk 1 line
    if (kind === "voice" && episodeId && lineId) {
      const { measureAudioDurationSec } = await import("@/lib/tts");
      const durationSec = await measureAudioDurationSec(diskPath);
      const ep = await db.episode.findUnique({ where: { id: episodeId } });
      if (ep) {
        const existingFiles = Array.isArray(ep.audioFiles)
          ? (ep.audioFiles as Array<{ lineId: string; path: string; durationSec: number }>)
          : [];
        const filtered = existingFiles.filter((f) => f.lineId !== lineId);
        filtered.push({ lineId, path: apiPath, durationSec });
        await db.episode.update({
          where: { id: episodeId },
          data: { audioFiles: filtered },
        });
      }
      return NextResponse.json({ path: apiPath, durationSec }, { status: 201 });
    }

    const asset = await db.asset.create({
      data: {
        seriesId,
        kind,
        name,
        path: apiPath,
        meta: { category, originalName: file.name, size: file.size },
      },
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal mengunggah asset" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID asset wajib diisi" }, { status: 400 });
  }
  await db.asset.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
