import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { applyJsonPatches } from "@/lib/ai/workflow";
import { SeriesBibleSchema } from "@/lib/schemas";

const PatchSchema = z.object({ entity: z.enum(["bible", "episode"]), entityId: z.string().optional(), operations: z.array(z.object({ op: z.enum(["set", "update", "delete"]), target: z.string(), path: z.string(), value: z.unknown().optional() })), note: z.string().default("Natural-language AI patch") });
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) { const { id } = await context.params; const versions = await db.aiVersion.findMany({ where: { seriesId: id }, orderBy: { createdAt: "desc" }, take: 100 }); return Response.json({ versions }); }
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const parsed = PatchSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  try {
    if (parsed.data.entity === "bible") {
      const series = await db.series.findUnique({ where: { id } }); if (!series) return Response.json({ error: "Serial tidak ditemukan" }, { status: 404 });
      const current = SeriesBibleSchema.parse(series.bible); const next = SeriesBibleSchema.parse(applyJsonPatches(current, parsed.data.operations));
      await db.aiVersion.create({ data: { seriesId: id, entity: "bible", entityId: id, snapshot: current, note: parsed.data.note } });
      const updated = await db.series.update({ where: { id }, data: { bible: next, bibleVersion: { increment: 1 } } }); return Response.json({ state: updated.bible, version: updated.bibleVersion });
    }
    if (!parsed.data.entityId) return Response.json({ error: "entityId episode wajib diisi" }, { status: 400 });
    const episode = await db.episode.findFirst({ where: { id: parsed.data.entityId, seriesId: id } }); if (!episode) return Response.json({ error: "Episode tidak ditemukan" }, { status: 404 });
    const current = { script: episode.script, shots: episode.shots, hook: episode.hook, twist: episode.twist, cliffhanger: episode.cliffhanger }; const next = applyJsonPatches(current, parsed.data.operations);
    await db.aiVersion.create({ data: { seriesId: id, entity: "episode", entityId: episode.id, snapshot: current, note: parsed.data.note } });
    const updated = await db.episode.update({ where: { id: episode.id }, data: { script: next.script as object, shots: next.shots as object, hook: String(next.hook), twist: String(next.twist), cliffhanger: String(next.cliffhanger) } }); return Response.json({ state: updated });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Patch gagal" }, { status: 400 }); }
}
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const version = await db.aiVersion.findFirst({ where: { seriesId: id }, orderBy: { createdAt: "desc" } }); if (!version) return Response.json({ error: "Tidak ada versi untuk di-undo" }, { status: 404 });
  if (version.entity === "bible") { const series = await db.series.findUnique({ where: { id } }); if (!series) return Response.json({ error: "Serial tidak ditemukan" }, { status: 404 }); const bible = SeriesBibleSchema.parse(version.snapshot); await db.series.update({ where: { id }, data: { bible, bibleVersion: { increment: 1 } } }); }
  else { const snapshot = version.snapshot as { script: object; shots: object; hook: string; twist: string; cliffhanger: string }; await db.episode.update({ where: { id: version.entityId }, data: snapshot }); }
  await db.aiVersion.delete({ where: { id: version.id } }); return Response.json({ ok: true, undone: version.id });
}
