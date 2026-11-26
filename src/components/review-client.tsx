"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  LockOpen,
  RotateCcw,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { EpisodeReview, SeriesBible } from "@/lib/schemas";
import { EpisodeHeaderNav } from "@/components/episode-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const DEFAULT_CHECKS = [
  {
    id: "hook-3s",
    label: "1. Hook 3 detik pertama jelas & bikin penasaran?",
    passed: true,
    note: "",
  },
  {
    id: "audio-sync",
    label: "2. Audio vs visual sinkron? Caption kata-per-kata tepat?",
    passed: true,
    note: "",
  },
  {
    id: "bible-consistent",
    label: "3. Karakter/set konsisten dengan Series Bible?",
    passed: true,
    note: "",
  },
  {
    id: "shot-pacing",
    label: "4. Tidak ada shot diam terlalu lama / potongan membingungkan?",
    passed: true,
    note: "",
  },
  {
    id: "originality",
    label: "5. AMAN dari jiplak/mirip video orang lain? (Pilih TIDAK bila ada kemiripan)",
    passed: true,
    note: "",
  },
  {
    id: "no-sound",
    label: "6. Tonton tanpa suara: cerita kebaca dari visual + caption?",
    passed: true,
    note: "",
  },
  {
    id: "audio-only",
    label: "7. Dengar hanya suara: cerita kebaca tanpa visual?",
    passed: true,
    note: "",
  },
];

export function ReviewClient({
  episode,
  series,
  bible,
}: {
  episode: {
    id: string;
    number: number;
    title: string;
    status: string;
    renderPath: string | null;
    review: EpisodeReview | null;
  };
  series: { id: string; name: string };
  bible: SeriesBible;
}) {
  const router = useRouter();
  const [checks, setChecks] = useState(
    episode.review?.checks?.length === 7 ? episode.review.checks : DEFAULT_CHECKS
  );
  const [submitting, setSubmitting] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const allPassed = checks.every((c) => c.passed);
  const renderAttempts = episode.review?.renderAttempts ?? 0;
  const isDone = episode.status === "done";

  async function submitReview(reRenderRequested: boolean) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/episodes/${episode.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checks, reRenderRequested }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal menyimpan review");
        return;
      }
      if (json.queueStopped) {
        toast.error(json.stopReason);
      } else if (json.review?.status === "lolos") {
        toast.success(
          `Episode lolos review (Done)! Continuity Bible diperbarui ke v${json.bibleVersion}.`
        );
      } else {
        toast.warning(
          reRenderRequested
            ? "Status: Perlu Revisi & dijadwalkan Render Ulang."
            : "Status: Perlu Revisi disimpan."
        );
      }
      router.refresh();
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnlock() {
    if (!unlockReason.trim()) {
      toast.error("Isi alasan membuka kunci revisi.");
      return;
    }
    setUnlocking(true);
    try {
      const res = await fetch(`/api/episodes/${episode.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock", unlockReason }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal membuka kunci");
        return;
      }
      toast.success("Kunci episode dibuka untuk revisi.");
      router.refresh();
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <div className="space-y-3">
      <EpisodeHeaderNav
        episodeId={episode.id}
        seriesId={series.id}
        seriesName={series.name}
        episodeNumber={episode.number}
        episodeTitle={episode.title}
        status={episode.status}
        accentColor={bible.visualStyle.accentColor}
      />

      {isDone && (
        <Card className="border-emerald-500/40 bg-emerald-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-emerald-300">
              <CheckCircle2 className="size-5" /> Episode Lolos &amp; Dikunci (Done)
            </CardTitle>
            <CardDescription>
              Continuity Series Bible sudah otomatis diperbarui dari episode ini.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Alasan bila ingin membuka kunci untuk revisi..."
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
            />
            <Button variant="outline" disabled={unlocking} onClick={handleUnlock}>
              <LockOpen className="size-4" /> Buka untuk Revisi
            </Button>
          </CardContent>
        </Card>
      )}

      {renderAttempts >= 2 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-400" />
          <span>
            Episode ini sudah gagal review {renderAttempts}×. Render ulang otomatis dibatasi maksimal 2× — tinjau naskah/timing secara manual sebelum lanjut.
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="text-base">Video Hasil Render / Pratinjau</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {episode.renderPath ? (
              <video
                controls
                src={episode.renderPath}
                className="w-full rounded-lg bg-black"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 border-2 border-border p-6 text-center text-xs text-muted-foreground">
                <span aria-hidden="true" className="pixel-empty-art" />
                <p>MP4 hasil render belum tersedia.</p>
                <Link href={`/episodes/${episode.id}/preview`} className="mt-2 inline-block">
                  <Button size="sm" variant="outline">
                    Buka Pratinjau dan Render
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Daftar Periksa 7 Poin</CardTitle>
              <Badge variant={allPassed ? "default" : "destructive"}>
                {allPassed ? "Siap Lolos" : "Perlu Revisi"}
              </Badge>
            </div>
            <CardDescription>
              Episode hanya bisa berstatus <strong>Selesai</strong> bila semua 7 poin lolos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {checks.map((item, idx) => (
              <div
                key={item.id}
                className="space-y-2 rounded-lg border border-border p-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Label className="text-xs leading-snug">{item.label}</Label>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      type="button"
                      size="xs"
                      disabled={isDone}
                      variant={item.passed ? "default" : "outline"}
                      onClick={() => {
                        const next = [...checks];
                        next[idx] = { ...item, passed: true };
                        setChecks(next);
                      }}
                    >
                      Ya / Aman
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      disabled={isDone}
                      variant={!item.passed ? "destructive" : "outline"}
                      onClick={() => {
                        const next = [...checks];
                        next[idx] = { ...item, passed: false };
                        setChecks(next);
                      }}
                    >
                      Tidak / Revisi
                    </Button>
                  </div>
                </div>
                {!item.passed && (
                  <Input
                    disabled={isDone}
                    placeholder="Wajib isi catatan apa yang harus diperbaiki..."
                    value={item.note}
                    onChange={(e) => {
                      const next = [...checks];
                      next[idx] = { ...item, note: e.target.value };
                      setChecks(next);
                    }}
                  />
                )}
              </div>
            ))}

            {!isDone && (
              <div className="flex flex-wrap gap-2 pt-2">
                {allPassed ? (
                  <Button disabled={submitting} onClick={() => submitReview(false)}>
                    <CheckCircle2 className="size-4" /> Setujui &amp; Tandai Done ✓
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      disabled={submitting}
                      onClick={() => submitReview(false)}
                    >
                      <Save className="size-4" /> Simpan Perlu Revisi
                    </Button>
                    {renderAttempts < 2 && (
                      <Button
                        variant="destructive"
                        disabled={submitting}
                        onClick={() => submitReview(true)}
                      >
                        <RotateCcw className="size-4" /> Render Ulang ({renderAttempts + 1}/2)
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
