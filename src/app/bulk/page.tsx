import Link from "next/link";
import { ArrowRight, Film, Layers, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { SeriesBible } from "@/lib/schemas";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function BulkLandingPage() {
  const seriesList = await db.series.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { episodes: true } } },
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1>Panduan Episode Massal</h1>
          <p className="page-description">Buat kerangka cerita dan naskah berkelanjutan, lalu masukkan ke antrean render.</p>
        </div>
        <Link href="/series?new=1" className="shrink-0">
          <Button variant="outline" className="w-full sm:w-auto">
            <Plus className="size-3.5" /> Serial Baru
          </Button>
        </Link>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <h2 className="panel-title">Pilih Serial</h2>
          <span className="mono text-[10px] text-muted-foreground">{seriesList.length} serial</span>
        </div>

        {seriesList.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span aria-hidden="true" className="pixel-empty-art" />
            <p className="text-[13px] font-medium">Belum ada serial untuk diproses massal</p>
            <Link href="/series?new=1">
              <Button size="sm"><Plus className="size-3.5" /> Buat Serial Baru</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-px bg-border sm:grid-cols-2">
            {seriesList.map((s) => {
              const bible = s.bible as unknown as SeriesBible;
              const accent = bible?.visualStyle?.accentColor || "#10b981";
              return (
                <Link key={s.id} href={`/series/${s.id}/bulk`} className="group flex items-center gap-2.5 bg-card px-3 py-2.5 transition-colors hover:bg-secondary">
                  <div className="relative flex aspect-[9/16] w-9 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-[#0b0c0e]">
                    <span className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: accent }} />
                    <Film className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium group-hover:text-primary">{s.name}</p>
                    <p className="mono truncate text-[10px] text-muted-foreground">
                      {s._count.episodes} eps · {s.visualStyle} · {s.tone}
                    </p>
                  </div>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground">
        <Layers className="size-3.5 shrink-0 text-primary" />
        Panduan massal menghasilkan naskah berurutan; render tetap berjalan satu per satu.
      </div>
    </div>
  );
}
