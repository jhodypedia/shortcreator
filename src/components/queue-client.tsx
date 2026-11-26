"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Clapperboard,
  Download,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ProgressRing, EmptyState } from "@/components/ui/studio-primitives";
import { StatusBadge } from "@/components/status-badge";
import { CountUp, Reveal } from "@/components/studio-motion";

interface QueueRow {
  id: string;
  episodeId: string;
  position: number;
  status: string;
  progress: number;
  currentFrame: number;
  etaSec: number | null;
  attempts: number;
  lastError: string | null;
  episode: {
    id: string;
    number: number;
    title: string;
    hook: string;
    status: string;
    durationSec: number | null;
    totalFrames: number | null;
    renderPath: string | null;
    series: { id: string; name: string; visualStyle: string };
  };
}

interface ControlState {
  isPaused: boolean;
  stopReason: string | null;
}

function formatEta(seconds: number | null) {
  if (seconds === null || seconds <= 0) return "--:--";
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function QueueClient({
  initialItems,
  initialControl,
}: {
  initialItems: QueueRow[];
  initialControl: ControlState;
}) {
  const [items, setItems] = useState<QueueRow[]>(initialItems);
  const [control, setControl] = useState<ControlState>(initialControl);
  const [busy, setBusy] = useState(false);

  async function refreshStatus() {
    try {
      const res = await fetch("/api/queue/status", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items ?? []);
      setControl(json.control ?? { isPaused: false, stopReason: null });
    } catch {
      // abaikan saat polling sementara gagal
    }
  }

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    function start() {
      if (id) return;
      id = setInterval(() => {
        if (!document.hidden) void refreshStatus();
      }, 3000);
    }
    function onVisibility() {
      if (document.hidden) {
        if (id) clearInterval(id);
        id = null;
      } else {
        void refreshStatus();
        start();
      }
    }
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (id) clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  async function sendControl(action: "pause-all" | "resume-all" | "cancel-all" | "run-next") {
    setBusy(true);
    try {
      const res = await fetch("/api/queue/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        toast.error("Gagal mengirim perintah antrean");
        return;
      }
      await refreshStatus();
      toast.success("Status antrean diperbarui");
    } finally {
      setBusy(false);
    }
  }

  async function sendItemAction(
    id: string,
    action: "pause" | "resume" | "retry" | "cancel" | "up" | "down"
  ) {
    const res = await fetch(`/api/queue/${id}/${action}`, { method: "POST" });
    if (!res.ok) {
      toast.error("Gagal memperbarui item antrean");
      return;
    }
    await refreshStatus();
  }

  const rendering = items.filter((item) => item.status === "rendering");
  const waiting = items.filter((item) => item.status !== "rendering");

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1>Antrean Render</h1>
          <p className="page-description">Satu episode dirender pada satu waktu, 1080×1920.</p>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
          {control.isPaused ? (
            <Button disabled={busy} onClick={() => sendControl("resume-all")}>
              <Play className="size-3.5" /> Lanjutkan
            </Button>
          ) : (
            <Button variant="outline" disabled={busy} onClick={() => sendControl("pause-all")}>
              <Pause className="size-3.5" /> Jeda
            </Button>
          )}
          <Button variant="secondary" disabled={busy} onClick={() => sendControl("run-next")}>
            <RefreshCw className="size-3.5" /> Jalankan
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => sendControl("cancel-all")} className="col-span-2 sm:col-span-1">
            Batalkan Semua
          </Button>
        </div>
      </div>

      {control.isPaused && control.stopReason && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-red-200">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-red-400" />
          <div>
            <p className="font-semibold">Antrean dihentikan otomatis / dijeda</p>
            <p className="text-[11px] opacity-90">{control.stopReason}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-lg border border-border bg-card">
        <div className="px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Merender</p>
          <CountUp value={rendering.length} className="mt-0.5 block text-[24px] leading-7 font-semibold" />
        </div>
        <div className="px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Menunggu</p>
          <CountUp value={waiting.length} className="mt-0.5 block text-[24px] leading-7 font-semibold" />
        </div>
      </div>

      <section className="studio-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <h2 className="panel-title">Daftar Antrean</h2>
          <span className="mono text-[10px] text-muted-foreground">{items.length} item · live 3s</span>
        </div>
        {items.length === 0 ? (
          <div className="p-4"><EmptyState title="Render berikutnya menunggu" description="Siapkan episode dari pratinjau atau gunakan AI untuk membuat video pertama."/></div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item, idx) => {
              const totalFrames = item.episode.totalFrames ?? 900;
              const isRendering = item.status === "rendering";
              return (
                <Reveal key={item.id} delay={Math.min(idx, 5) * 0.02} className="px-3 py-2.5">
                  <div className="flex gap-3">
                    <div className="relative flex aspect-[9/16] w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-[#0b0c0e]" aria-hidden="true">
                      <Clapperboard className="size-3.5 text-muted-foreground" />
                      <span className="mono absolute bottom-0.5 text-[8px] text-muted-foreground">#{idx + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-medium">
                            {item.episode.series.name} — Eps {item.episode.number}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">{item.episode.title}</p>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>

                        <div className="mt-1.5 flex items-center gap-3">
                          <ProgressRing value={item.progress} size={42} stroke={3}/>
                          <div className="min-w-0 flex-1">
                          <Progress value={item.progress} isComplete={item.status === "done"} isActive={isRendering} />
                          <p className="mt-1 text-[11px] text-muted-foreground">Waktu tersisa · {formatEta(item.etaSec)}</p>
                          </div>
                        </div>

                      <div className="mono mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                        <span>{item.currentFrame} / {totalFrames} fr · {item.progress}%</span>
                        <span>Perlu percobaan {item.attempts}</span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {item.episode.renderPath && (
                          <a href={item.episode.renderPath} target="_blank" rel="noreferrer" className="inline-flex h-6 items-center gap-1 rounded-sm border border-primary/40 bg-primary/10 px-1.5 text-[10px] text-primary hover:bg-primary/20">
                            <Download className="size-3" /> MP4
                          </a>
                        )}
                        <Link href={`/episodes/${item.episodeId}/review`}>
                          <Button size="xs" variant="outline">Review</Button>
                        </Link>
                        <Button size="icon-xs" variant="ghost" onClick={() => sendItemAction(item.id, "up")} title="Naikkan urutan" aria-label="Naikkan urutan">
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button size="icon-xs" variant="ghost" onClick={() => sendItemAction(item.id, "down")} title="Turunkan urutan" aria-label="Turunkan urutan">
                          <ArrowDown className="size-3.5" />
                        </Button>
                        {(item.status === "failed" || item.status === "cancelled") && (
                          <Button size="xs" variant="outline" onClick={() => sendItemAction(item.id, "retry")}>
                            <RotateCcw className="size-3" /> Retry
                          </Button>
                        )}
                        {item.status === "queued" && (
                          <Button size="icon-xs" variant="ghost" onClick={() => sendItemAction(item.id, "cancel")} title="Batalkan item" aria-label="Batalkan item">
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>

                      {item.lastError && (
                        <p className="mt-1.5 rounded-sm border border-destructive/30 bg-destructive/10 px-2 py-1 text-[10px] text-red-300">
                          Error: {item.lastError}
                        </p>
                      )}
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
