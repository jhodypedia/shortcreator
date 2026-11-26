import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "./db";

const DOWNLOAD_ROOT = path.join(process.cwd(), "storage", "downloads");

const ALLOWED_HOSTS = [
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "fb.watch",
  "twitter.com",
  "x.com",
  "vimeo.com",
  "dailymotion.com",
  "twitch.tv",
  "reddit.com",
  "bilibili.com",
];

let running = false;

export function isAllowedUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "URL tidak valid." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Hanya URL http/https yang diizinkan." };
  }
  if (
    url.hostname === "localhost" ||
    url.hostname.startsWith("127.") ||
    url.hostname.startsWith("10.") ||
    url.hostname.startsWith("192.168.") ||
    url.hostname.startsWith("169.254.") ||
    url.hostname.endsWith(".local") ||
    url.hostname.endsWith(".internal")
  ) {
    return { ok: false, error: "Alamat internal tidak diizinkan." };
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (!ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
    return {
      ok: false,
      error: `Domain belum didukung. Didukung: ${ALLOWED_HOSTS.join(", ")}.`,
    };
  }
  return { ok: true, url };
}

export function sanitizeFileName(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[^\w\s.-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "video"
  );
}

function run(
  command: string,
  args: string[],
  onStdout?: (chunk: string) => void
): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stdout.on("data", (data: Buffer) => onStdout?.(data.toString()));
    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
      onStdout?.(data.toString());
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
  });
}

export async function fetchMetadata(url: string): Promise<{
  title: string;
  durationSec: number | null;
  thumbnail: string | null;
  uploader: string | null;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "yt-dlp",
      ["--dump-single-json", "--no-warnings", "--no-playlist", "--skip-download", url],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (data: Buffer) => {
      out += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      err += data.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            err.split("\n").filter(Boolean).slice(-2).join(" ") || "Gagal membaca metadata video"
          )
        );
        return;
      }
      try {
        const json = JSON.parse(out) as {
          title?: string;
          duration?: number;
          thumbnail?: string;
          uploader?: string;
        };
        resolve({
          title: json.title?.trim() || "video",
          durationSec: typeof json.duration === "number" ? json.duration : null,
          thumbnail: json.thumbnail ?? null,
          uploader: json.uploader ?? null,
        });
      } catch {
        reject(new Error("Metadata video tidak dapat dibaca."));
      }
    });
  });
}

export async function runDownloadJob(jobId: string): Promise<void> {
  const job = await db.downloadJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const check = isAllowedUrl(job.url);
  if (!check.ok) {
    await db.downloadJob.update({
      where: { id: job.id },
      data: { status: "failed", error: check.error },
    });
    return;
  }

  await fs.mkdir(DOWNLOAD_ROOT, { recursive: true });
  await db.downloadJob.update({
    where: { id: job.id },
    data: { status: "running", stage: "Mengambil metadata", progress: 2 },
  });

  try {
    const meta = await fetchMetadata(job.url);
    const base = `${Date.now()}-${sanitizeFileName(meta.title)}`;
    const targetTemplate = path.join(DOWNLOAD_ROOT, `${base}.%(ext)s`);

    await db.downloadJob.update({
      where: { id: job.id },
      data: {
        title: meta.title,
        durationSec: meta.durationSec,
        stage: "Mengunduh video",
        progress: 5,
      },
    });

    const { code, stderr } = await run(
      "yt-dlp",
      [
        "--no-playlist",
        "--no-warnings",
        "--newline",
        "--merge-output-format",
        "mp4",
        "-f",
        "bv*[height<=1080]+ba/b[height<=1080]/b",
        "--recode-video",
        "mp4",
        "-o",
        targetTemplate,
        job.url,
      ],
      (chunk) => {
        const match = chunk.match(/\[download\]\s+([\d.]+)%/);
        if (match) {
          const pct = Number(match[1]);
          void db.downloadJob
            .update({
              where: { id: job.id },
              data: { progress: Math.min(95, 5 + pct * 0.9) },
            })
            .catch(() => null);
        }
      }
    );

    if (code !== 0) {
      throw new Error(
        stderr.split("\n").filter(Boolean).slice(-3).join(" ") || "yt-dlp gagal mengunduh video"
      );
    }

    const files = await fs.readdir(DOWNLOAD_ROOT);
    const produced = files
      .filter((file) => file.startsWith(base) && file.endsWith(".mp4"))
      .sort()
      .pop();
    if (!produced) throw new Error("File hasil unduhan tidak ditemukan.");

    const diskPath = path.join(DOWNLOAD_ROOT, produced);
    const stat = await fs.stat(diskPath);

    await db.downloadJob.update({
      where: { id: job.id },
      data: {
        status: "done",
        stage: "Selesai",
        progress: 100,
        fileName: produced,
        path: `/api/storage/downloads/${produced}`,
        sizeBytes: stat.size,
      },
    });
  } catch (err) {
    await db.downloadJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        stage: "Gagal",
        error: err instanceof Error ? err.message : "Unduhan gagal",
      },
    });
  }
}

export function triggerDownloadWorker(jobId: string): void {
  if (running) {
    setTimeout(() => triggerDownloadWorker(jobId), 1500);
    return;
  }
  running = true;
  void runDownloadJob(jobId).finally(() => {
    running = false;
    void drainQueue();
  });
}

async function drainQueue(): Promise<void> {
  const next = await db.downloadJob.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
  });
  if (!next) return;
  triggerDownloadWorker(next.id);
}

export async function deleteDownloadFile(jobId: string): Promise<void> {
  const job = await db.downloadJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (job.fileName) {
    await fs
      .unlink(path.join(DOWNLOAD_ROOT, job.fileName))
      .catch(() => null);
  }
  await db.downloadJob.delete({ where: { id: jobId } }).catch(() => null);
}
