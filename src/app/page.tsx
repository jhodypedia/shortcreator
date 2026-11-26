import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clapperboard,
  Film,
  Info,
  ListOrdered,
  Plus,
  Radio,
} from "lucide-react";
import { db } from "@/lib/db";
import { SeriesBible } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Progress } from "@/components/ui/progress";
import { CountUp, Reveal, Sparkline } from "@/components/studio-motion";
import { TimelineClips } from "@/components/timeline-clips";
import { TimelinePlayhead } from "@/components/timeline-playhead";

export const dynamic = "force-dynamic";

function formatEta(seconds: number | null) {
  if (seconds === null || seconds <= 0) return "--:--";
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default async function DashboardPage() {
  const [seriesList, queueItems, queueControl, logs] = await Promise.all([
    db.series.findMany({
      orderBy: { updatedAt: "desc" },
      include: { episodes: { orderBy: { number: "asc" } } },
    }),
    db.queueItem.findMany({
      where: { status: { in: ["queued", "rendering", "failed"] } },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: { episode: { include: { series: true } } },
    }),
    db.queueControl.findUnique({ where: { id: "default" } }),
    db.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  const allEpisodes = seriesList.flatMap((s) => s.episodes);
  const doneEpisodes = allEpisodes.filter((e) => e.status === "done");
  const activeQueue = queueItems.filter((q) => q.status === "rendering" || q.status === "queued");
  const metrics = [
    { label: "Serial", value: seriesList.length, tone: "emerald" as const, hint: "aktif" },
    { label: "Episode", value: allEpisodes.length, tone: "blue" as const, hint: "total" },
    { label: "Selesai", value: doneEpisodes.length, tone: "emerald" as const, hint: "final" },
    { label: "Antrean", value: activeQueue.length, tone: "amber" as const, hint: "render" },
  ];
  const seriesCounts = seriesList.map((s) => s.episodes.length);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate">Status Studio</h1>
          <p className="page-description">Monitor produksi serial shorts dari satu workspace.</p>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
          <Link href="/series?new=1" className="contents">
            <Button className="w-full sm:w-auto">
              <Plus className="size-3.5" /> Serial Baru
            </Button>
          </Link>
          <Link href="/queue" className="contents">
            <Button variant="outline" className="w-full sm:w-auto">
              <ListOrdered className="size-3.5" /> Antrean
            </Button>
          </Link>
        </div>
      </div>

      {queueControl?.isPaused && queueControl.stopReason && (
        <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-red-400" />
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-red-300">Antrean render dihentikan</p>
              <p className="text-[11px] text-red-200/80">{queueControl.stopReason}</p>
            </div>
          </div>
          <Link href="/queue">
            <Button size="sm" variant="destructive">Buka Antrean</Button>
          </Link>
        </div>
      )}

      {/* Status strip */}
      <section aria-label="Metrik studio" className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <h2 className="panel-title">Monitor</h2>
          <span className="mono flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Radio className="size-3 text-primary" /> LIVE
          </span>
        </div>
        <div className="grid grid-cols-2 divide-border lg:grid-cols-4 lg:divide-x">
          {metrics.map((metric, index) => (
            <Reveal key={metric.label} delay={index * 0.03} className="border-b border-border px-3 py-2.5 lg:border-b-0 [&:nth-child(n+3)]:border-b-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{metric.label}</p>
                  <CountUp value={metric.value} className="mt-0.5 block text-[26px] leading-8 font-semibold text-foreground" />
                  <p className="mono text-[10px] text-muted-foreground">{metric.hint}</p>
                </div>
                <Sparkline points={seriesCounts.length ? seriesCounts : [0, 1, 0]} tone={metric.tone} className="mt-2 w-16 shrink-0 opacity-80" />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Queue panel */}
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
            <h2 className="panel-title">Antrean Render</h2>
            <Link href="/queue" className="text-[11px] text-primary hover:text-[#34d399]">Kelola</Link>
          </div>
          <div className="divide-y divide-border">
            {queueItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <span aria-hidden="true" className="pixel-empty-art" />
                <p className="text-[13px] font-medium">Antrean kosong</p>
                <p className="max-w-xs text-[11px] text-muted-foreground">
                  Masukkan episode berstatus Siap Render dari halaman Pratinjau atau Panduan Massal.
                </p>
              </div>
            ) : (
              queueItems.map((item) => {
                const totalFrames = item.episode.totalFrames ?? 900;
                const isRendering = item.status === "rendering";
                return (
                  <div key={item.id} className="flex gap-2.5 px-3 py-2.5">
                    <div
                      className="relative flex aspect-[9/16] w-9 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-[#0b0c0e]"
                      aria-hidden="true"
                    >
                      <div className="absolute inset-x-0 top-1/3 h-px bg-border" />
                      <Clapperboard className="size-3.5 text-muted-foreground" />
                      <span className="mono absolute bottom-0.5 text-[8px] text-muted-foreground">{item.episode.number}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <p className="min-w-0 truncate text-[12px] font-medium">
                          {item.episode.series.name} · Eps {item.episode.number}
                        </p>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">{item.episode.title}</p>
                      <div className="mt-1.5">
                        <Progress value={item.progress} isActive={isRendering} isComplete={item.status === "done"} />
                      </div>
                      <div className="mono mt-1 flex flex-wrap items-center justify-between gap-x-2 text-[10px] text-muted-foreground">
                        <span>
                          {item.currentFrame} / {totalFrames} fr
                        </span>
                        <span>
                          {item.progress}% · ETA {formatEta(item.etaSec)}
                        </span>
                      </div>
                      {item.lastError && (
                        <p className="mt-1.5 rounded-sm border border-destructive/30 bg-destructive/10 px-2 py-1 text-[10px] text-red-300">
                          {item.lastError}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Series panel */}
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
            <h2 className="panel-title">Serial</h2>
            <Link href="/series" className="text-[11px] text-primary hover:text-[#34d399]">Semua</Link>
          </div>
          {seriesList.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <span aria-hidden="true" className="pixel-empty-art" />
              <p className="text-[13px] font-medium">Belum ada serial</p>
              <p className="max-w-[220px] text-[11px] text-muted-foreground">
                Mulai dengan panduan serial agar karakter dan latar tetap konsisten.
              </p>
              <Link href="/series?new=1">
                <Button size="sm"><Plus className="size-3.5" /> Buat Serial</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {seriesList.slice(0, 5).map((s) => {
                const bible = s.bible as unknown as SeriesBible;
                const accent = bible?.visualStyle?.accentColor || "#10b981";
                const latest = s.episodes[s.episodes.length - 1];
                const seriesQueue = queueItems.filter((q) => q.episode.seriesId === s.id && q.status !== "failed").length;
                return (
                  <Link key={s.id} href={`/series/${s.id}`} className="group flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-secondary">
                    <div className="relative flex aspect-[9/16] w-8 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-[#0b0c0e]">
                      <span className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: accent }} />
                      <Film className="size-3 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium group-hover:text-primary">{s.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {s.episodes.length} episode · {s.visualStyle} · {s.tone}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      {latest ? <StatusBadge status={latest.status} /> : <span className="mono text-[10px] text-muted-foreground">kosong</span>}
                      {seriesQueue > 0 && <span className="mono text-[9px] text-amber-400">{seriesQueue} antre</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Timeline */}
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <h2 className="panel-title">Timeline Produksi</h2>
          <span className="mono text-[10px] text-muted-foreground">klip = durasi episode</span>
        </div>
        {seriesList.length === 0 ? (
          <div className="px-4 py-8 text-center text-[11px] text-muted-foreground">Belum ada klip untuk ditampilkan.</div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
            <div className="min-w-[720px] space-y-1.5 px-3 py-2.5">
              <div className="mono flex justify-between border-b border-border pb-1 text-[9px] text-muted-foreground">
                <span>00:00</span>
                <span>00:15</span>
                <span>00:30</span>
                <span>00:45</span>
                <span>01:00</span>
              </div>
              {seriesList.slice(0, 4).map((s) => {
                const bible = s.bible as unknown as SeriesBible;
                const accent = bible?.visualStyle?.accentColor || "#10b981";
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 truncate text-[10px] text-muted-foreground">{s.name}</span>
                    <div className="relative flex min-w-0 flex-1 items-center">
                      <TimelineClips
                        accent={accent}
                        clips={s.episodes.slice(0, 12).map((ep) => ({
                          id: ep.id,
                          number: ep.number,
                          title: ep.title,
                          durationSec: ep.durationSec,
                          status: ep.status,
                        }))}
                      />
                      <TimelinePlayhead left={Math.min(97, 4 + s.episodes.length * 7)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Activity log */}
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <h2 className="panel-title">Log Aktivitas</h2>
          <span className="mono text-[10px] text-muted-foreground">{logs.length} entri</span>
        </div>
        <div className="mono max-h-64 overflow-y-auto text-[11px]">
          {logs.length === 0 ? (
            <p className="px-3 py-6 text-center text-muted-foreground">Belum ada aktivitas tercatat.</p>
          ) : (
            logs.map((log) => {
              const Icon = log.level === "error" ? AlertTriangle : log.level === "success" ? CheckCircle2 : log.level === "warning" ? AlertTriangle : Info;
              const tone = log.level === "error" ? "text-red-400" : log.level === "success" ? "text-primary" : log.level === "warning" ? "text-amber-400" : "text-sky-400";
              return (
                <div key={log.id} className="flex items-start gap-2 border-b border-border/60 px-3 py-1.5 last:border-b-0 hover:bg-secondary/40">
                  <span className="shrink-0 text-muted-foreground">{formatTime(log.createdAt)}</span>
                  <Icon className={`mt-0.5 size-3 shrink-0 ${tone}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-foreground/90">{log.message}</p>
                    {log.detail && <p className="truncate text-[10px] text-muted-foreground">{log.detail}</p>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
