"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Layers,
  ListPlus,
  Pause,
  Play,
  Sparkles,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { BulkOutlineItem, SeriesBible } from "@/lib/schemas";
import { ContinuitySnapshot } from "@/lib/continuity";
import { SeriesHeaderNav } from "@/components/series-nav";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

interface EpisodeItem {
  id: string;
  number: number;
  title: string;
  status: string;
  hook: string;
  durationSec: number | null;
  renderPath: string | null;
}

export function BulkWizardClient({
  series,
  bible,
  initialEpisodes,
  continuity,
}: {
  series: { id: string; name: string; bibleVersion: number };
  bible: SeriesBible;
  initialEpisodes: EpisodeItem[];
  continuity: ContinuitySnapshot | null;
}) {
  const router = useRouter();
  const maxExisting = initialEpisodes[initialEpisodes.length - 1]?.number ?? 0;

  const [fromEps, setFromEps] = useState(maxExisting + 1);
  const [toEps, setToEps] = useState(maxExisting + 5);
  const [outlines, setOutlines] = useState<BulkOutlineItem[]>([]);
  const [loadingOutline, setLoadingOutline] = useState(false);

  // Step 2: Generate naskah massal berurutan dengan pause/resume
  const [episodes, setEpisodes] = useState<EpisodeItem[]>(initialEpisodes);
  const [genProgress, setGenProgress] = useState({ current: 0, total: 0, running: false });
  const pauseFlag = useRef(false);

  // Step 3: Batch TTS+Timing & Queue selection
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialEpisodes.filter((e) => e.status === "ready").map((e) => e.id)
  );
  const [batchTtsRunning, setBatchTtsRunning] = useState(false);
  const [enqueuing, setEnqueuing] = useState(false);

  // Validasi outline duplikat & continuity antar baris
  const outlineWarnings = useMemo(() => {
    const warnings: string[] = [];
    const seenHooks = new Set<string>();
    const seenTwists = new Set<string>();

    for (let i = 0; i < outlines.length; i++) {
      const o = outlines[i];
      const h = o.hook.trim().toLowerCase();
      const t = o.twist.trim().toLowerCase();
      if (seenHooks.has(h)) warnings.push(`Hook duplikat di Eps ${o.number}.`);
      if (seenTwists.has(t)) warnings.push(`Twist duplikat di Eps ${o.number}.`);
      seenHooks.add(h);
      seenTwists.add(t);

      if (i > 0) {
        const prevCliff = outlines[i - 1].cliffhanger.toLowerCase();
        const keywords = prevCliff
          .split(/\s+/)
          .filter((w) => w.length >= 5)
          .slice(0, 4);
        const hookLower = o.hook.toLowerCase();
        const connected =
          (!o.continuityChecked && keywords.some((kw) => hookLower.includes(kw)));
        if (!connected) {
          warnings.push(
            `Eps ${o.number}: hook belum terlihat menyebut cliffhanger Eps ${outlines[i - 1].number}.`
          );
        }
      }
    }
    return warnings;
  }, [outlines]);

  async function handleGenerateOutlines() {
    setLoadingOutline(true);
    try {
      const res = await fetch("/api/ai/outline-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId: series.id,
          fromEps,
          toEps,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal membuat outline bulk");
        return;
      }
      setOutlines(json.outlines ?? []);
      toast.success(
        `${json.outlines.length} outline episode siap diperiksa (${json.source}).`
      );
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setLoadingOutline(false);
    }
  }

  async function handleGenerateAllScripts() {
    if (outlines.length === 0) {
      toast.error("Generate outline di Langkah 1 terlebih dahulu.");
      return;
    }
    pauseFlag.current = false;
    setGenProgress({ current: 0, total: outlines.length, running: true });

    const createdList: EpisodeItem[] = [];
    for (let i = 0; i < outlines.length; i++) {
      if (pauseFlag.current) {
        toast.info(`Generate naskah dijeda di Eps ${outlines[i].number}.`);
        break;
      }
      const single = outlines[i];
      const res = await fetch("/api/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId: series.id,
          outlines: [single],
          generateScripts: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || `Gagal generate Eps ${single.number}`);
        setGenProgress((p) => ({ ...p, running: false }));
        return;
      }
      const ep = json.episodes?.[0];
      if (ep) createdList.push(ep);
      setGenProgress({ current: i + 1, total: outlines.length, running: true });
    }

    setGenProgress((p) => ({ ...p, running: false }));

    // Refresh episode list dari server
    const sRes = await fetch(`/api/series/${series.id}`);
    const sJson = await sRes.json();
    if (sJson.series?.episodes) {
      setEpisodes(sJson.series.episodes);
    }
    toast.success(`${createdList.length} naskah episode tersimpan (status: script).`);
    router.refresh();
  }

  async function handlePrepareAudioAndTimingForScripts() {
    const targets = episodes.filter(
      (e) => e.status === "script" || e.status === "timing" || e.status === "draft"
    );
    if (targets.length === 0) {
      toast.info("Tidak ada episode berstatus script/timing yang perlu disiapkan.");
      return;
    }
    setBatchTtsRunning(true);
    try {
      for (const ep of targets) {
        await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ episodeId: ep.id }),
        });
        await fetch(`/api/episodes/${ep.id}/timing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fps: 30 }),
        });
      }
      const sRes = await fetch(`/api/series/${series.id}`);
      const sJson = await sRes.json();
      if (sJson.series?.episodes) {
        setEpisodes(sJson.series.episodes);
        setSelectedIds(
          sJson.series.episodes
            .filter((e: EpisodeItem) => e.status === "ready")
            .map((e: EpisodeItem) => e.id)
        );
      }
      toast.success(`${targets.length} episode selesai TTS + Timing & siap antre render!`);
      router.refresh();
    } catch {
      toast.error("Gagal menyiapkan TTS/Timing massal");
    } finally {
      setBatchTtsRunning(false);
    }
  }

  async function handleEnqueueSelected() {
    if (selectedIds.length === 0) {
      toast.error("Pilih minimal 1 episode yang sudah berstatus Ready.");
      return;
    }
    setEnqueuing(true);
    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeIds: selectedIds }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal memasukkan ke antrean");
        return;
      }
      toast.success(`${json.items.length} episode masuk antrean render (1-per-1)!`);
      router.push("/queue");
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setEnqueuing(false);
    }
  }

  const readyEpisodes = episodes.filter((e) => e.status === "ready");
  const isSequelRange = maxExisting > 0 && fromEps > 1;

  return (
    <div className="space-y-3">
      <SeriesHeaderNav
        seriesId={series.id}
        seriesName={series.name}
        bibleVersion={series.bibleVersion}
        accentColor={bible.visualStyle.accentColor}
        emoji={bible.visualStyle.emoji}
      />

      {/* Bulk Lanjutan Context */}
      {isSequelRange && continuity && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-300">
              Mode Bulk Lanjutan — Melanjutkan Episode {continuity.lastEpisodeNumber}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            {continuity.threeLineSummary.map((line, i) => (
              <p key={i}>• {line}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* LANGKAH 1: RENTANG & OUTLINE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="size-4 text-primary" /> Langkah 1 — Rentang &amp; Outline Semua Episode
          </CardTitle>
          <CardDescription>
            Setujui outline semua episode lebih dulu agar konflik tidak tabrakan dan cliffhanger terus menyambung.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Dari EPS</Label>
              <Input
                type="number"
                min={1}
                className="w-24"
                value={fromEps}
                onChange={(e) => setFromEps(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sampai EPS</Label>
              <Input
                type="number"
                min={fromEps}
                className="w-24"
                value={toEps}
                onChange={(e) => setToEps(Math.max(fromEps, Number(e.target.value) || fromEps))}
              />
            </div>
            <Button onClick={handleGenerateOutlines} disabled={loadingOutline}>
              <Sparkles className="size-4" />
              {loadingOutline ? "Menyusun Outline..." : "Generate Outline Semua Episode"}
            </Button>
          </div>

          {outlineWarnings.length > 0 && (
            <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
              {outlineWarnings.map((w, i) => (
                <p key={i} className="flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 shrink-0 text-amber-400" />
                  <span>{w}</span>
                </p>
              ))}
            </div>
          )}

          {outlines.length > 0 && (
            <div className="space-y-3">
              {outlines.map((row, idx) => (
                <div
                  key={row.number}
                  className="space-y-2 rounded-lg border border-border bg-muted/20 p-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="mono font-semibold text-primary">Episode {row.number}</span>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`cont-${row.number}`}
                        checked={row.continuityChecked}
                        onCheckedChange={(c) => {
                          const next = [...outlines];
                          next[idx] = { ...row, continuityChecked: c };
                          setOutlines(next);
                        }}
                      />
                      <label htmlFor={`cont-${row.number}`}>
                        Sambung dari Eps {row.number - 1}
                      </label>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input
                      placeholder="Judul"
                      value={row.title}
                      onChange={(e) => {
                        const next = [...outlines];
                        next[idx] = { ...row, title: e.target.value };
                        setOutlines(next);
                      }}
                    />
                    <Input
                      placeholder="Hook (0-3s)"
                      value={row.hook}
                      onChange={(e) => {
                        const next = [...outlines];
                        next[idx] = { ...row, hook: e.target.value };
                        setOutlines(next);
                      }}
                    />
                    <Input
                      placeholder="Konflik"
                      value={row.conflict}
                      onChange={(e) => {
                        const next = [...outlines];
                        next[idx] = { ...row, conflict: e.target.value };
                        setOutlines(next);
                      }}
                    />
                    <Input
                      placeholder="Twist"
                      value={row.twist}
                      onChange={(e) => {
                        const next = [...outlines];
                        next[idx] = { ...row, twist: e.target.value };
                        setOutlines(next);
                      }}
                    />
                  </div>
                  <Input
                    placeholder="Cliffhanger untuk episode berikutnya"
                    value={row.cliffhanger}
                    onChange={(e) => {
                      const next = [...outlines];
                      next[idx] = { ...row, cliffhanger: e.target.value };
                      setOutlines(next);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* LANGKAH 2: GENERATE NASKAH MASSAL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Langkah 2 — Generate Naskah Massal (Berurutan)</CardTitle>
          <CardDescription>
            Setiap episode dibuat berurutan dengan context continuity berjalan. Hasil masuk status <strong>script</strong> (belum langsung render).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={outlines.length === 0 || genProgress.running}
              onClick={handleGenerateAllScripts}
            >
              <Play className="size-4" /> Generate Semua Naskah ({outlines.length})
            </Button>
            {genProgress.running && (
              <Button
                variant="outline"
                onClick={() => {
                  pauseFlag.current = true;
                }}
              >
                <Pause className="size-4" /> Jeda
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={batchTtsRunning}
              onClick={handlePrepareAudioAndTimingForScripts}
            >
              <Volume2 className="size-4" />
              {batchTtsRunning
                ? "Menyiapkan TTS & Timing..."
                : "Siapkan Audio & Timing Massal (→ Ready)"}
            </Button>
          </div>

          {genProgress.total > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span>Progress Generate Naskah</span>
                <span>
                  {genProgress.current}/{genProgress.total} episode
                </span>
              </div>
              <Progress
                value={(genProgress.current / Math.max(1, genProgress.total)) * 100}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* LANGKAH 3: ANTREAN RENDER & LAPORAN BULK */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">
              Langkah 3 — Antrean Render &amp; Laporan Bulk
            </CardTitle>
            <CardDescription>
              Pilih episode berstatus <strong>Siap Render (Ready)</strong> untuk dimasukkan ke antrean 1-per-1.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedIds(readyEpisodes.map((e) => e.id))}
            >
              <CheckCircle2 className="size-4" /> Pilih Semua Ready ({readyEpisodes.length})
            </Button>
            <Button
              size="sm"
              disabled={selectedIds.length === 0 || enqueuing}
              onClick={handleEnqueueSelected}
            >
              <ListPlus className="size-4" />
              {enqueuing
                ? "Mengirim..."
                : `Masukkan ke Antrean (${selectedIds.length})`}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="py-2 pr-2">Pilih</th>
                  <th className="py-2 pr-3">Ep</th>
                  <th className="py-2 pr-3">Durasi</th>
                  <th className="py-2 pr-3">Hook</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">File MP4</th>
                  <th className="py-2">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {episodes.map((ep) => {
                  const checked = selectedIds.includes(ep.id);
                  const isReady = ep.status === "ready";
                  return (
                    <tr key={ep.id}>
                      <td className="py-2.5 pr-2">
                        <Checkbox
                          checked={checked}
                          disabled={!isReady}
                          onCheckedChange={(c) =>
                            setSelectedIds((prev) =>
                              c ? [...prev, ep.id] : prev.filter((id) => id !== ep.id)
                            )
                          }
                        />
                      </td>
                      <td className="py-2.5 pr-3 font-semibold">
                        <Link href={`/episodes/${ep.id}`} className="hover:underline">
                          Eps {ep.number}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3">
                        {ep.durationSec ? `${ep.durationSec}s` : "-"}
                      </td>
                      <td className="max-w-xs truncate py-2.5 pr-3">{ep.hook}</td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge status={ep.status} />
                      </td>
                      <td className="py-2.5 pr-3">
                        {ep.renderPath ? (
                          <a
                            href={ep.renderPath}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
                          >
                            <Download className="size-3.5" /> MP4
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2.5">
                        <Link
                          href={`/episodes/${ep.id}/review`}
                          className="text-primary hover:underline"
                        >
                          Buka Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
