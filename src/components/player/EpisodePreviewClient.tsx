"use client";

import React, { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PlayerRef } from "@remotion/player";
import {
  ArrowRight,
  Clapperboard,
  EyeOff,
  ListPlus,
  ShieldCheck,
  Subtitles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import {
  EpisodeScript,
  SeriesBible,
  ShotItem,
  VoiceTiming,
} from "@/lib/schemas";
import { buildVoiceTimingObject } from "@/lib/timing";
const Player = dynamic(() => import("@remotion/player").then((module) => module.Player), { ssr: false, loading: () => <div className="aspect-[9/16] w-full animate-pulse rounded-xl bg-secondary" /> });
const ShortComposition = dynamic(() => import("@/remotion/ShortComposition").then((module) => module.ShortComposition), { ssr: false, loading: () => <div className="aspect-[9/16] w-full animate-pulse rounded-xl bg-secondary" /> });
import { EpisodeHeaderNav } from "@/components/episode-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function EpisodePreviewClient({
  episode,
  series,
  bible,
}: {
  episode: {
    id: string;
    number: number;
    title: string;
    status: string;
    hook: string;
    script: EpisodeScript;
    voiceTiming: VoiceTiming | null;
    shots: { shots: ShotItem[] };
    audioFiles: Array<{ lineId: string; path: string; durationSec: number }>;
    totalFrames: number | null;
    renderPath: string | null;
  };
  series: { id: string; name: string; visualStyle: string };
  bible: SeriesBible;
}) {
  const router = useRouter();
  const playerRef = useRef<PlayerRef>(null);

  const [showSafeArea, setShowSafeArea] = useState(true);
  const [showCaptions, setShowCaptions] = useState(true);
  const [includeSfx, setIncludeSfx] = useState(true);
  const [muteAudio, setMuteAudio] = useState(false);
  const [audioOnly, setAudioOnly] = useState(false);
  const [jumpFrame, setJumpFrame] = useState(0);
  const [quickPreview, setQuickPreview] = useState(true);
  const [enqueuing, setEnqueuing] = useState(false);

  const resolvedTiming = useMemo(() => {
    if (episode.voiceTiming) return episode.voiceTiming;
    const durMap: Record<string, number> = {};
    for (const af of episode.audioFiles) durMap[af.lineId] = af.durationSec;
    return buildVoiceTimingObject({
      lines: episode.script.lines,
      audioDurations: durMap,
      fps: 30,
    }).voiceTiming;
  }, [episode.audioFiles, episode.script.lines, episode.voiceTiming]);

  const totalFrames = Math.max(
    30,
    episode.totalFrames ??
      resolvedTiming.captions[resolvedTiming.captions.length - 1]?.endFrame ??
      150
  );

  async function handleEnqueue(immediate = false) {
    setEnqueuing(true);
    try {
      const res = await fetch(`/api/render/${episode.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: immediate ? "immediate" : "queue" }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal memproses render");
        return;
      }
      if (immediate) {
        toast.success(`Render MP4 selesai! File: ${json.renderPath}`);
      } else {
        toast.success("Episode dimasukkan ke Render Queue!");
        router.push("/queue");
      }
      router.refresh();
    } catch {
      toast.error("Gagal menghubungi server render");
    } finally {
      setEnqueuing(false);
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

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Remotion Player 9:16 */}
        <Card className="lg:col-span-6">
          <CardHeader className="pb-2">
          <CardTitle className="text-base">Remotion Player ({quickPreview ? "Pratinjau cepat · 360×640" : "1080×1920"} @ 30fps)</CardTitle>
            <CardDescription>
              Memakai data asli naskah, voice timing, shot list, dan karakter 3D Bible.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <div className="w-full max-w-[320px] overflow-hidden rounded-lg border border-border bg-black shadow-xl">
              <Player
                ref={playerRef}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                component={ShortComposition as React.ComponentType<any>}
                durationInFrames={totalFrames}
                fps={30}
                compositionWidth={quickPreview ? 360 : 1080}
                compositionHeight={quickPreview ? 640 : 1920}
                style={{ width: "100%", aspectRatio: "9 / 16" }}
                controls
                inputProps={{
                  episode: {
                    id: episode.id,
                    number: episode.number,
                    title: episode.title,
                    hook: episode.hook,
                    script: episode.script,
                    voiceTiming: resolvedTiming,
                    shots: episode.shots,
                    audioFiles: episode.audioFiles,
                    totalFrames,
                  },
                  bible,
                  visualStyle: series.visualStyle as "voxel-3d" | "cartoon-3d",
                  showSafeArea,
                  showCaptions,
                  muteAudio,
                  includeSfx,
                  audioOnly,
                  qualityScale: quickPreview ? 0.5 : 1,
                }}
              />
            </div>

            <div className="flex w-full max-w-[320px] items-center justify-between rounded-md border px-2 py-1.5">
              <Label htmlFor="quick-preview" className="text-xs">Pratinjau cepat (kualitas rendah)</Label>
              <Switch aria-label="Pratinjau cepat kualitas rendah" checked={quickPreview} onCheckedChange={setQuickPreview} />
            </div>

            <div className="flex w-full max-w-[320px] flex-wrap gap-1">
              {episode.script.lines.map((line, index) => {
                const timing = resolvedTiming.lineTimings.find((item) => item.lineId === line.id);
                return <Button key={line.id} size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => { playerRef.current?.seekTo(timing?.startFrame ?? index * 60); playerRef.current?.play(); }}>
                  Putar Beat {index + 1}
                </Button>;
              })}
            </div>

            {/* Scrub Frame Spesifik */}
            <div className="flex w-full max-w-[320px] items-center gap-2">
              <Input
                type="number"
                aria-label="Nomor frame"
                min={0}
                max={totalFrames - 1}
                value={jumpFrame}
                onChange={(e) => setJumpFrame(Number(e.target.value) || 0)}
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => playerRef.current?.seekTo(jumpFrame)}
              >
                Lompat Frame
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Kontrol Review & Render */}
        <div className="space-y-4 lg:col-span-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kontrol Lapisan dan Mode Tinjauan</CardTitle>
              <CardDescription>
                Uji cerita tanpa suara &amp; tanpa visual sebelum render final di PC.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <Label className="flex items-center gap-2 text-sm">
                  <ShieldCheck className="size-4 text-emerald-400" />
                  Tampilkan Safe-Area Guide (1080×1420)
                </Label>
                <Switch checked={showSafeArea} onCheckedChange={setShowSafeArea} aria-label="Tampilkan safe-area guide" />
              </div>

              <div className="flex items-center justify-between gap-3">
                <Label className="flex items-center gap-2 text-sm">
                  <Subtitles className="size-4 text-amber-400" />
                  Tampilkan Caption Kata-per-Kata
                </Label>
                <Switch checked={showCaptions} onCheckedChange={setShowCaptions} aria-label="Tampilkan caption kata-per-kata" />
              </div>

              <div className="flex items-center justify-between gap-3">
                <Label className="flex items-center gap-2 text-sm">
                  <Volume2 className="size-4 text-sky-400" />
                  Aktifkan Layer SFX
                </Label>
                <Switch checked={includeSfx} onCheckedChange={setIncludeSfx} aria-label="Aktifkan layer SFX" />
              </div>

              <div className="grid grid-cols-1 gap-2 border-t border-border pt-3 sm:grid-cols-2">
                <Button
                  variant={muteAudio ? "default" : "outline"}
                  onClick={() => {
                    setMuteAudio((m) => !m);
                    setAudioOnly(false);
                  }}
                >
                  <VolumeX className="size-4" />
                  {muteAudio ? "Mode Tanpa Suara: ON" : "Tonton Tanpa Suara"}
                </Button>
                <Button
                  variant={audioOnly ? "default" : "outline"}
                  onClick={() => {
                    setAudioOnly((a) => !a);
                    setMuteAudio(false);
                  }}
                >
                  <EyeOff className="size-4" />
                  {audioOnly ? "Mode Hanya Suara: ON" : "Dengar Tanpa Visual"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Render ke MP4 (1080×1920 H.264)</CardTitle>
              <CardDescription>
                Render berat berjalan di server/PC (bukan di browser HP).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="flex-1"
                  disabled={enqueuing}
                  onClick={() => handleEnqueue(false)}
                >
                  <ListPlus className="size-4" />
                  {enqueuing ? "Memproses..." : "Masukkan ke Antrean Bulk"}
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={enqueuing}
                  onClick={() => handleEnqueue(true)}
                >
                  <Clapperboard className="size-4" />
                  {enqueuing ? "Merender di PC..." : "Render Episode Ini Sekarang"}
                </Button>
              </div>

              {episode.renderPath && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs">
                  <p className="font-semibold text-emerald-300">
                    Hasil Render MP4 Tersedia:
                  </p>
                  <video
                    controls
                    src={episode.renderPath}
                    className="mt-2 max-h-64 w-full rounded-lg bg-black"
                  />
                </div>
              )}

              <Link href={`/episodes/${episode.id}/review`} className="block">
                <Button variant="outline" className="w-full">
                  Lanjut ke Review Checklist <ArrowRight className="size-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
