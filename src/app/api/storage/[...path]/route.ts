import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const MIME_MAP: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;
  if (!segments || segments.length === 0) {
    return NextResponse.json({ error: "Path file tidak valid" }, { status: 400 });
  }

  const storageRoot = path.resolve(process.cwd(), "storage");
  const target = path.resolve(storageRoot, ...segments);

  if (!target.startsWith(storageRoot + path.sep)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const stat = await fsp.stat(target);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
    }

    const ext = path.extname(target).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";
    const range = req.headers.get("range");

    if (range) {
      const match = range.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
        const chunkSize = end - start + 1;
        const stream = fs.createReadStream(target, { start, end });
        const webStream = new ReadableStream({
          start(controller) {
            stream.on("data", (chunk) => controller.enqueue(chunk));
            stream.on("end", () => controller.close());
            stream.on("error", (err) => controller.error(err));
          },
          cancel() {
            stream.destroy();
          },
        });
        return new NextResponse(webStream, {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${end}/${stat.size}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunkSize),
            "Content-Type": contentType,
          },
        });
      }
    }

    const fileBuffer = await fsp.readFile(target);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(stat.size),
        "Accept-Ranges": "bytes",
      },
    });
  } catch {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
  }
}
