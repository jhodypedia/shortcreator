"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Mic,
  Music,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import {
  EpisodeScript,
  PauseMarker,
  SeriesBible,
  VoiceTiming,
  WordCaption,
} from "@/lib/schemas";
import { EpisodeHeaderNav } from "@/components/episode-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AudioEntry {
  lineId: string;
  path: string;
  durationSec: number;
  providerUsed?: string;
}

interface AssetEntry {
  id: string;
  kind: string;
  name: string;
  path: string;
  meta: unknown;
}

export function EpisodeVoiceClient({
  episode,
  series,
  bible,
  initialAssets,
}: {
  episode: {
    id: string;
    number: number;
    title: string;
    status: string;
    script: EpisodeScript;
    audioFiles: AudioEntry[];
    voiceTiming: VoiceTiming | null;
    durationSec: number | null;
    totalFrames: number | null;
  };
  series: { id: string; name: string };
  bible: SeriesBible;
  initialAssets: AssetEntry[];
}) {
  const router = useRouter();
  const isLocked = episode.status === "done";

  const [audioFiles, setAudioFiles] = useState<AudioEntry[]>(episode.audioFiles ?? []);
  const [voiceTiming, setVoiceTiming] = useState<VoiceTiming | null>(
    episode.voiceTiming
  );
  const [totalFrames, setTotalFrames] = useState<number>(episode.totalFrames ?? 0);
  const [durationSec, setDurationSec] = useState<number>(episode.durationSec ?? 0);
  const [assets, setAssets] = useState<AssetEntry[]>(initialAssets);

  const [busyLineId, setBusyLineId] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
  const [ttsNotice, setTtsNotice] = useState<string | null>(null);

  // Form upload SFX/BGM
  const [sfxName, setSfxName] = useState("");
  const [sfxCategory, setSfxCategory] = useState("aksi");
  const [sfxFrame, setSfxFrame] = useState(0);
  const [selectedWordIdx, setSelectedWordIdx] = useState<number | null>(null);

  const audioMap = new Map(audioFiles.map((a) => [a.lineId, a]));

  async function handleGenerateTts(lineId?: string) {
    setBusyLineId(lineId ?? "ALL");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: episode.id, lineId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal generate audio TTS");
        return;
      }
      setAudioFiles(json.audioFiles ?? []);
      if (json.notice) {
        setTtsNotice(json.notice);
        toast.info("Audio panduan lokal dibuat (TTS offline/belum ada key).");
      } else {
        setTtsNotice(null);
        toast.success(`Audio TTS (${json.providerUsed}) berhasil dibuat!`);
      }
      router.refresh();
    } catch {
      toast.error("Gagal menghubungi server TTS");
    } finally {
      setBusyLineId(null);
    }
  }

  async function handleUploadVoice(lineId: string, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "voice");
    fd.append("episodeId", episode.id);
    fd.append("lineId", lineId);

    const res = await fetch("/api/assets", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Gagal upload audio");
      return;
    }
    setAudioFiles((prev) => [
      ...prev.filter((a) => a.lineId !== lineId),
      { lineId, path: json.path, durationSec: json.durationSec, providerUsed: "upload" },
    ]);
    toast.success(`Rekaman suara terpasang (${json.durationSec} dtk)`);
  }

  async function handleComputeTiming(overrides?: {
    pauses?: PauseMarker[];
    sfxMarkers?: VoiceTiming["sfxMarkers"];
    bgm?: VoiceTiming["bgm"];
    captionStyle?: VoiceTiming["captionStyle"];
    captionsOverride?: WordCaption[];
  }) {
    setComputing(true);
    try {
      const res = await fetch(`/api/episodes/${episode.id}/timing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fps: 30,
          pauses: overrides?.pauses ?? voiceTiming?.pauses,
          sfxMarkers: overrides?.sfxMarkers ?? voiceTiming?.sfxMarkers,
          bgm: overrides?.bgm ?? voiceTiming?.bgm,
          captionStyle: overrides?.captionStyle ?? voiceTiming?.captionStyle,
          captionsOverride: overrides?.captionsOverride,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal menghitung timing");
        return;
      }
      setVoiceTiming(json.voiceTiming);
      setTotalFrames(json.totalFrames);
      setDurationSec(json.durationSec);
      toast.success(
        `Timing & ${json.voiceTiming.captions.length} caption kata terhitung (${json.durationSec} dtk)!`
      );
      router.refresh();
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setComputing(false);
    }
  }

  async function handleUploadAsset(kind: "sfx" | "music", file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    fd.append("name", sfxName.trim() || file.name.replace(/\.[^.]+$/, ""));
    fd.append("category", sfxCategory);
    fd.append("seriesId", series.id);

    const res = await fetch("/api/assets", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Gagal mengunggah audio");
      return;
    }
    setAssets((prev) => [json.asset, ...prev]);
    setSfxName("");
    toast.success(`${kind === "sfx" ? "SFX" : "Musik"} "${json.asset.name}" tersimpan!`);

    if (kind === "music" && voiceTiming) {
      const nextBgm = {
        assetId: json.asset.id,
        name: json.asset.name,
        path: json.asset.path,
        volume: 0.3,
        duckDb: -12,
      };
      setVoiceTiming({ ...voiceTiming, bgm: nextBgm });
    }
  }

  const sfxAssets = assets.filter((a) => a.kind === "sfx");
  const musicAssets = assets.filter((a) => a.kind === "music");
  const allHaveAudio = episode.script.lines.every((l) => audioMap.has(l.id));

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

      {ttsNotice && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          <strong>Info TTS:</strong> {ttsNotice}
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">
            Audio: {audioFiles.length}/{episode.script.lines.length} baris
          </Badge>
          {durationSec > 0 && (
            <Badge className="bg-sky-600/20 text-sky-300">
              Total: {durationSec} dtk ({totalFrames} frame @ 30fps)
            </Badge>
          )}
          {durationSec > 60 && (
            <Badge variant="destructive">Melebihi 60 dtk Shorts!</Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busyLineId !== null || isLocked}
            onClick={() => handleGenerateTts()}
          >
            <Mic className="size-4" />
            {busyLineId === "ALL" ? "Membuat Audio..." : "Generate Semua TTS"}
          </Button>
          <Button
            size="sm"
            disabled={computing || isLocked}
            onClick={() => handleComputeTiming()}
          >
            <Clock className="size-4" />
            {computing ? "Menghitung..." : "Hitung Timing & Captions"}
          </Button>
          <Link href={`/episodes/${episode.id}/shots`}>
            <Button size="sm" variant="secondary">
              Lanjut Shots <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </div>

      {!allHaveAudio && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
          <AlertTriangle className="size-4 shrink-0 text-amber-400" />
          <span>
            Klik <strong>Generate Semua TTS</strong> atau upload rekaman suara sendiri per baris agar durasi riil file audio terbaca sebelum menghitung timing.
          </span>
        </div>
      )}

      {/* Daftar Audio Per Baris */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audio Dialog per Baris</CardTitle>
          <CardDescription>
            Durasi dihitung langsung dari file audio asli, bukan sekadar estimasi kata.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {episode.script.lines.map((line, idx) => {
            const af = audioMap.get(line.id);
            return (
              <div
                key={line.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      #{idx + 1} {line.beat}
                    </Badge>
                    <span className="text-xs font-semibold">{line.speaker}</span>
                    {af ? (
                      <Badge className="bg-emerald-600/20 text-emerald-300 text-[10px]">
                        Riil: {af.durationSec} dtk
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Est: {line.durationSec} dtk
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm">{line.text}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {af && (
                    <audio controls src={af.path} className="h-8 w-44 sm:w-52" />
                  )}
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={busyLineId !== null || isLocked}
                    onClick={() => handleGenerateTts(line.id)}
                  >
                    <Volume2 className="size-3.5" />
                    {busyLineId === line.id ? "..." : "TTS"}
                  </Button>
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                    <Upload className="size-3" />
                    <span>Upload VO</span>
                    <input
                      type="file"
                      accept="audio/*"
                      disabled={isLocked}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUploadVoice(line.id, file);
                      }}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Visual Timeline Kata & Jeda */}
      {voiceTiming && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Timeline Visual &amp; Caption Kata-per-Kata ({voiceTiming.captions.length} kata)
            </CardTitle>
            <CardDescription>
              Klik kata untuk menggeser start/end frame, atau edit jeda sebelum punchline/twist.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Bar per line & kata */}
            <div className="space-y-2.5">
              {voiceTiming.lineTimings.map((lt, idx) => {
                const line = episode.script.lines.find((l) => l.id === lt.lineId);
                const lineWords = voiceTiming.captions
                  .map((c, globalIdx) => ({ ...c, globalIdx }))
                  .filter((c) => c.lineId === lt.lineId);
                const pauseAfter = voiceTiming.pauses.find(
                  (p) => p.afterLineId === lt.lineId
                );

                return (
                  <div key={lt.lineId} className="space-y-1.5 rounded-lg bg-muted/30 p-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">
                        Baris #{idx + 1} ({line?.speaker}) — {lt.startFrame}f..{lt.endFrame}f ({lt.durationSec}s)
                      </span>
                      <button
                        type="button"
                        onClick={() => setSfxFrame(lt.startFrame)}
                        className="text-[11px] text-primary hover:underline"
                      >
                        Set SFX ke {lt.startFrame}f
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {lineWords.map((w) => (
                        <button
                          key={w.globalIdx}
                          type="button"
                          onClick={() => setSelectedWordIdx(w.globalIdx)}
                          className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                            selectedWordIdx === w.globalIdx
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card hover:bg-muted"
                          }`}
                        >
                          <span className="font-semibold">{w.word}</span>{" "}
                          <span className="text-[10px] opacity-70">
                            {w.startFrame}-{w.endFrame}f
                          </span>
                        </button>
                      ))}
                    </div>

                    {pauseAfter && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-amber-300">
                        <span>⏸ {pauseAfter.reason || "Jeda"}:</span>
                        <Input
                          type="number"
                          aria-label="Durasi jeda (detik)"
                          step={0.1}
                          min={0}
                          max={3}
                          disabled={isLocked}
                          className="h-7 w-20 text-xs"
                          value={pauseAfter.durationSec}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            const nextPauses = voiceTiming.pauses.map((p) =>
                              p.afterLineId === lt.lineId
                                ? { ...p, durationSec: val }
                                : p
                            );
                            setVoiceTiming({ ...voiceTiming, pauses: nextPauses });
                          }}
                        />
                        <span>dtk</span>
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={isLocked}
                          onClick={() => handleComputeTiming({ pauses: voiceTiming.pauses })}
                        >
                          Terapkan Jeda
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Editor geser kata terpilih */}
            {selectedWordIdx !== null && voiceTiming.captions[selectedWordIdx] && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-xs">
                <span>
                  Edit Kata: <strong>{voiceTiming.captions[selectedWordIdx].word}</strong>
                </span>
                <label className="flex items-center gap-1">
                  Start Frame:
                  <Input
                    type="number"
                    className="h-7 w-20 text-xs"
                    disabled={isLocked}
                    value={voiceTiming.captions[selectedWordIdx].startFrame}
                    onChange={(e) => {
                      const nextCaps = [...voiceTiming.captions];
                      nextCaps[selectedWordIdx] = {
                        ...nextCaps[selectedWordIdx],
                        startFrame: Math.max(0, Number(e.target.value) || 0),
                      };
                      setVoiceTiming({ ...voiceTiming, captions: nextCaps });
                    }}
                  />
                </label>
                <label className="flex items-center gap-1">
                  End Frame:
                  <Input
                    type="number"
                    className="h-7 w-20 text-xs"
                    disabled={isLocked}
                    value={voiceTiming.captions[selectedWordIdx].endFrame}
                    onChange={(e) => {
                      const nextCaps = [...voiceTiming.captions];
                      nextCaps[selectedWordIdx] = {
                        ...nextCaps[selectedWordIdx],
                        endFrame: Math.max(1, Number(e.target.value) || 1),
                      };
                      setVoiceTiming({ ...voiceTiming, captions: nextCaps });
                    }}
                  />
                </label>
                <Button
                  size="xs"
                  disabled={isLocked}
                  onClick={() =>
                    handleComputeTiming({ captionsOverride: voiceTiming.captions })
                  }
                >
                  <Save className="size-3.5" /> Simpan Pergeseran Kata
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SFX, BGM Ducking, & Caption Style */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4" /> Library SFX &amp; Musik Latar (Ducking -12 dB)
            </CardTitle>
            <CardDescription>
              Gunakan file audio bebas lisensi milikmu. BGM otomatis mengecil -12 dB saat ada dialog.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Nama SFX / Musik..."
                value={sfxName}
                onChange={(e) => setSfxName(e.target.value)}
              />
              <Input
                placeholder="Kategori (aksi/transisi)"
                value={sfxCategory}
                onChange={(e) => setSfxCategory(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                <Upload className="size-3.5" /> Upload SFX
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUploadAsset("sfx", f);
                  }}
                />
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                <Music className="size-3.5" /> Upload Musik BGM
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUploadAsset("music", f);
                  }}
                />
              </label>
            </div>

            {/* Pasang SFX ke frame */}
            {sfxAssets.length > 0 && voiceTiming && (
              <div className="space-y-2 border-t border-border pt-3">
                <Label htmlFor="sfx-frame" className="text-xs">Pasang SFX ke Frame ({sfxFrame}f)</Label>
                <div className="flex flex-wrap gap-1.5">
                  <Input
                    id="sfx-frame"
                    type="number"
                    className="h-8 w-24 text-xs"
                    value={sfxFrame}
                    onChange={(e) => setSfxFrame(Number(e.target.value) || 0)}
                  />
                  {sfxAssets.map((a) => (
                    <Button
                      key={a.id}
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        const nextSfx = [
                          ...(voiceTiming.sfxMarkers ?? []),
                          {
                            id: `sfx-${Date.now()}`,
                            assetId: a.id,
                            name: a.name,
                            path: a.path,
                            frame: sfxFrame,
                            volume: 0.8,
                          },
                        ];
                        void handleComputeTiming({ sfxMarkers: nextSfx });
                      }}
                    >
                      <Plus className="size-3" /> {a.name} @ {sfxFrame}f
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Daftar SFX terpasang */}
            {voiceTiming?.sfxMarkers && voiceTiming.sfxMarkers.length > 0 && (
              <div className="space-y-1 text-xs">
                {voiceTiming.sfxMarkers.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded border border-border px-2.5 py-1"
                  >
                    <span>
                      🔊 {m.name} @ frame {m.frame}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = voiceTiming.sfxMarkers.filter((x) => x.id !== m.id);
                        void handleComputeTiming({ sfxMarkers: next });
                      }}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Pilih BGM */}
            {musicAssets.length > 0 && voiceTiming && (
              <div className="space-y-1.5 border-t border-border pt-3">
                <Label htmlFor="bgm-select" className="text-xs">Musik Latar Aktif</Label>
                <Select
                  value={voiceTiming.bgm?.assetId || "none"}
                  onValueChange={(v) => {
                    if (v === "none") {
                      void handleComputeTiming({ bgm: undefined });
                      return;
                    }
                    const found = musicAssets.find((m) => m.id === v);
                    if (found) {
                      void handleComputeTiming({
                        bgm: {
                          assetId: found.id,
                          name: found.name,
                          path: found.path,
                          volume: 0.3,
                          duckDb: -12,
                        },
                      });
                    }
                  }}
                >
                  <SelectTrigger id="bgm-select" aria-label="Musik latar aktif" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa Musik Latar</SelectItem>
                    {musicAssets.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        🎵 {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Caption Style Editor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gaya Caption Safe-Area</CardTitle>
            <CardDescription>
              Otomatis berada di dalam area aman 1080×1420 tengah.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {voiceTiming ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="caption-font-size" className="text-xs">Ukuran Font (px)</Label>
                    <Input
                      id="caption-font-size"
                      type="number"
                      min={32}
                      max={88}
                      value={voiceTiming.captionStyle.fontSize}
                      onChange={(e) =>
                        setVoiceTiming({
                          ...voiceTiming,
                          captionStyle: {
                            ...voiceTiming.captionStyle,
                            fontSize: Number(e.target.value) || 56,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="caption-position" className="text-xs">Posisi</Label>
                    <Select
                      value={voiceTiming.captionStyle.position}
                      onValueChange={(v) =>
                        setVoiceTiming({
                          ...voiceTiming,
                          captionStyle: {
                            ...voiceTiming.captionStyle,
                            position: (v as "tengah-bawah" | "tengah") || "tengah-bawah",
                          },
                        })
                      }
                    >
                      <SelectTrigger id="caption-position" aria-label="Posisi caption" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tengah-bawah">Tengah Bawah</SelectItem>
                        <SelectItem value="tengah">Tengah Layar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="caption-active-color" className="text-xs">Warna Kata Aktif</Label>
                    <Input
                      id="caption-active-color"
                      type="color"
                      className="h-9 w-full p-1"
                      value={voiceTiming.captionStyle.activeColor}
                      onChange={(e) =>
                        setVoiceTiming({
                          ...voiceTiming,
                          captionStyle: {
                            ...voiceTiming.captionStyle,
                            activeColor: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="caption-text-color" className="text-xs">Warna Teks Biasa</Label>
                    <Input
                      id="caption-text-color"
                      type="color"
                      className="h-9 w-full p-1"
                      value={voiceTiming.captionStyle.textColor}
                      onChange={(e) =>
                        setVoiceTiming({
                          ...voiceTiming,
                          captionStyle: {
                            ...voiceTiming.captionStyle,
                            textColor: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={isLocked}
                  onClick={() =>
                    handleComputeTiming({ captionStyle: voiceTiming.captionStyle })
                  }
                >
                  <Save className="size-4" /> Simpan Gaya Caption
                </Button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Klik &ldquo;Hitung Timing &amp; Captions&rdquo; terlebih dahulu untuk mengatur gaya caption.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
