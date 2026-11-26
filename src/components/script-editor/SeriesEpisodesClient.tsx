"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Download,
  Layers,
  Play,
  Plus,
  Sparkles,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { ContinuitySnapshot } from "@/lib/continuity";
import { SeriesBible } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { SeriesHeaderNav } from "@/components/series-nav";
import { StatusBadge } from "@/components/status-badge";
import { Stepper } from "@/components/ui/studio-primitives";

interface EpRow {
  id: string;
  number: number;
  title: string;
  status: string;
  hook: string;
  twist: string;
  cliffhanger: string;
  durationSec: number | null;
  renderPath: string | null;
  publish: unknown;
}

export function SeriesEpisodesClient({
  series,
  bible,
  episodes,
  continuity,
  openSequelDefault = false,
}: {
  series: { id: string; name: string; bibleVersion: number };
  bible: SeriesBible;
  episodes: EpRow[];
  continuity: ContinuitySnapshot | null;
  openSequelDefault?: boolean;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(openSequelDefault);
  const [isSequel, setIsSequel] = useState(episodes.length > 0);
  const [creating, setCreating] = useState(false);

  const nextNumber = (episodes[episodes.length - 1]?.number ?? 0) + 1;
  const [title, setTitle] = useState(`Episode ${nextNumber}`);
  const [hook, setHook] = useState(
    continuity?.activeCliffhanger
      ? `Melanjutkan ${continuity.activeCliffhanger.slice(0, 45)}...`
      : ""
  );
  const [twist, setTwist] = useState("");
  const [nextCliffhanger, setNextCliffhanger] = useState("");
  const [continuityConfirmed, setContinuityConfirmed] = useState(false);
  const [continuityNote, setContinuityNote] = useState("");

  // Analitik publish per series
  const publishedEps = episodes
    .map((e) => ({
      ep: e,
      pub: e.publish as { views?: number; likes?: number; subsDelta?: number; platform?: string } | null,
    }))
    .filter((x) => x.pub && (x.pub.views ?? 0) > 0);

  const bestEp = [...publishedEps].sort(
    (a, b) => (b.pub?.views ?? 0) - (a.pub?.views ?? 0)
  )[0];

  function openNewDialog(sequelMode: boolean) {
    setIsSequel(sequelMode);
    setTitle(`Episode ${nextNumber}`);
    setHook(
      sequelMode && continuity?.activeCliffhanger
        ? `Soal "${continuity.activeCliffhanger.slice(0, 40)}", ternyata ini yang terjadi!`
        : ""
    );
    setTwist("");
    setNextCliffhanger("");
    setContinuityConfirmed(false);
    setContinuityNote("");
    setDialogOpen(true);
  }

  async function handleCreateEpisode(e: React.FormEvent) {
    e.preventDefault();
    if (isSequel && !nextCliffhanger.trim()) {
      toast.error(
        "PERINGATAN KERAS: Episode lanjutan WAJIB menyisakan cliffhanger baru agar cerita tidak putus!"
      );
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId: series.id,
          number: nextNumber,
          title,
          hook,
          twist: twist || "Fakta tak terduga terungkap di akhir.",
          cliffhanger: nextCliffhanger,
          cliffhangerFrom: isSequel ? continuity?.activeCliffhanger || null : null,
          isSequel,
          continuityConfirmed,
          continuityNote,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal membuat episode");
        return;
      }
      toast.success(`Episode ${json.episode.number} dibuat!`);
      setDialogOpen(false);
      router.push(`/episodes/${json.episode.id}`);
      router.refresh();
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-3">
      <SeriesHeaderNav
        seriesId={series.id}
        seriesName={series.name}
        bibleVersion={series.bibleVersion}
        accentColor={bible.visualStyle.accentColor}
        emoji={bible.visualStyle.emoji}
      />
      <div className="studio-card p-3 sm:p-4"><Stepper steps={["Naskah", "Timing", "Siap", "Render", "Review", "Selesai"]} current={Math.max(0, Math.min(5, episodes.length ? ["draft", "script", "timing", "ready", "rendering", "review", "done"].indexOf(episodes.at(-1)?.status ?? "draft") - 1 : 0))} /></div>

      {/* Bar Aksi Utama */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[14px] font-semibold">Daftar Episode ({episodes.length})</h2>
          <p className="text-xs text-muted-foreground">
            Alur: Naskah → Suara &amp; Penyelarasan → Bidikan → Pratinjau → Render → Tinjauan → Selesai
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {episodes.length > 0 && (
            <Button onClick={() => openNewDialog(true)}>
              <Sparkles className="size-4" /> Lanjut dari Episode Terakhir
            </Button>
          )}
          <Button
            variant={episodes.length === 0 ? "default" : "outline"}
            onClick={() => openNewDialog(false)}
          >
            <Plus className="size-4" /> Buat Episode {nextNumber}
          </Button>
          <Link href={`/series/${series.id}/bulk`}>
            <Button variant="secondary">
              <Layers className="size-4" /> Bulk Eps
            </Button>
          </Link>
        </div>
      </div>

      {/* Ringkasan Continuity Aktif */}
      {continuity && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-300">
              Continuity Terakhir (Membaca Bible + Eps {continuity.lastEpisodeNumber})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            {continuity.threeLineSummary.map((line, i) => (
              <p key={i} className="leading-relaxed">
                • {line}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Performa Publish Series */}
      {bestEp && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5 text-sm">
              <Trophy className="size-5 text-amber-400" />
              <div>
                <span className="font-semibold">
                  Episode Terbaik: Eps {bestEp.ep.number} ({bestEp.pub?.views?.toLocaleString("id-ID")} views)
                </span>
                <p className="text-xs text-muted-foreground">
                  Pola hook pemenang: &ldquo;{bestEp.ep.hook}&rdquo;
                </p>
              </div>
            </div>
            <Link href={`/episodes/${bestEp.ep.id}/publish`}>
              <Button size="xs" variant="outline">
                Lihat Detail Publish
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Empty State vs List */}
      {episodes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span aria-hidden="true" className="pixel-empty-art" />
            <p className="font-medium">Belum ada episode di series ini</p>
            <p className="max-w-md text-xs text-muted-foreground">
              Mulai dari Episode 1 atau langsung buat kerangka massal untuk 10 episode sekaligus.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => openNewDialog(false)}>
                <Plus className="size-4" /> Buat Episode 1
              </Button>
              <Link href={`/series/${series.id}/bulk`}>
                <Button variant="secondary">
                  <Layers className="size-4" /> Bulk EPS 1–10
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {episodes.map((ep) => (
            <Card key={ep.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      <span>
                        Eps {ep.number}: {ep.title}
                      </span>
                      <StatusBadge status={ep.status} />
                      {ep.durationSec && (
                        <span className="text-xs font-normal text-muted-foreground">
                          ({ep.durationSec} dtk)
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Hook: {ep.hook}
                    </CardDescription>
                  </div>
                  {ep.renderPath && (
                    <a
                      href={ep.renderPath}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300"
                    >
                      <Download className="size-3.5" /> MP4
                    </a>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                <Link href={`/episodes/${ep.id}`}>
                  <Button size="xs" variant="outline">
                    1. Naskah
                  </Button>
                </Link>
                <Link href={`/episodes/${ep.id}/voice`}>
                  <Button size="xs" variant="outline">
                    2. Voice &amp; Timing
                  </Button>
                </Link>
                <Link href={`/episodes/${ep.id}/shots`}>
                  <Button size="xs" variant="outline">
                    3. Shots
                  </Button>
                </Link>
                <Link href={`/episodes/${ep.id}/preview`}>
                  <Button size="xs">
                    <Play className="size-3" /> 4. Preview
                  </Button>
                </Link>
                <Link href={`/episodes/${ep.id}/review`}>
                  <Button size="xs" variant="secondary">
                    5. Review
                  </Button>
                </Link>
                <Link href={`/episodes/${ep.id}/publish`}>
                  <Button size="xs" variant="ghost">
                    6. Publish
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Buat Episode / Mode Lanjutan */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isSequel
                ? `Lanjut ke Episode ${nextNumber} (Mode Lanjutan)`
                : `Buat Episode ${nextNumber}`}
            </DialogTitle>
            <DialogDescription>
              {isSequel
                ? "Episode lanjutan wajib menyambung cliffhanger aktif dan menyisakan cliffhanger baru."
                : "Isi hook dan arah cerita awal episode."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateEpisode} className="space-y-3">
            {isSequel && continuity && (
              <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                <p className="font-semibold text-amber-300">
                  Konteks Continuity (Read-Only)
                </p>
                {continuity.threeLineSummary.map((line, i) => (
                  <p key={i} className="text-amber-100/90">
                    {line}
                  </p>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Judul Episode</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Hook 0–3 Detik (Langsung aksi, tanpa &ldquo;halo guys&rdquo;)</Label>
              <Textarea
                rows={2}
                value={hook}
                onChange={(e) => setHook(e.target.value)}
                placeholder="Misal: Cahaya ungu Gua Kristal barusan memanggil namaku!"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Twist Episode Ini</Label>
              <Input
                value={twist}
                onChange={(e) => setTwist(e.target.value)}
                placeholder="Misal: Ternyata penjaga gua adalah ayam berkacamata"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <span>Cliffhanger Baru untuk Episode Berikutnya</span>
                {isSequel && (
                  <span className="text-xs text-red-400">(WAJIB diisi)</span>
                )}
              </Label>
              <Textarea
                rows={2}
                value={nextCliffhanger}
                onChange={(e) => setNextCliffhanger(e.target.value)}
                placeholder="Misal: Peta dimensi menyala di dinding gua..."
              />
              {isSequel && !nextCliffhanger.trim() && (
                <p className="flex items-center gap-1 text-xs text-red-400">
                  <AlertTriangle className="size-3.5" /> Jangan kosongkan cliffhanger baru!
                </p>
              )}
            </div>

            {isSequel && continuity?.activeCliffhanger && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="seq-confirm"
                    checked={continuityConfirmed}
                    onCheckedChange={(c) => setContinuityConfirmed(c)}
                  />
                  <label htmlFor="seq-confirm" className="text-xs leading-snug">
                    Konfirmasi: cliffhanger sebelumnya dijawab di naskah / sengaja ditunda
                    dengan alasan jelas
                  </label>
                </div>
                {continuityConfirmed && (
                  <Input
                    placeholder="Alasan / catatan penyelesaian cliffhanger..."
                    value={continuityNote}
                    onChange={(e) => setContinuityNote(e.target.value)}
                  />
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="submit" disabled={creating} className="w-full sm:w-auto">
                {creating ? "Menyimpan..." : "Buat & Buka Editor Naskah"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
