import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export async function logActivity(params: {
  seriesId?: string | null;
  episodeId?: string | null;
  level?: "info" | "success" | "warning" | "error";
  message: string;
  detail?: string;
}) {
  try {
    await db.activityLog.create({
      data: {
        seriesId: params.seriesId ?? null,
        episodeId: params.episodeId ?? null,
        level: params.level ?? "info",
        message: params.message,
        detail: params.detail ?? null,
      },
    });
  } catch (err) {
    console.error("Gagal mencatat activity log:", err);
  }
}
