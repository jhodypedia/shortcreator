"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Camera, Save } from "lucide-react";
import { toast } from "sonner";
import { EpisodeScript, SeriesBible, ShotItem } from "@/lib/schemas";
import { SHOT_HINTS, validateShotList } from "@/lib/bible";
import { EpisodeHeaderNav } from "@/components/episode-nav";
import { SetPreview3D } from "@/components/set-preview/SetPreview3D";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export function EpisodeShotsClient({
  episode,
  series,
  bible,
}: {
  episode: {
    id: string;
    number: number;
    title: string;
    status: string;
    script: EpisodeScript;
    shots: ShotItem[];
  };
  series: { id: string; name: string; visualStyle: string };
  bible: SeriesBible;
}) {
  const router = useRouter();
  const isLocked = episode.status === "done";
  const [shots, setShots] = useState<ShotItem[]>(episode.shots ?? []);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  const activeShot = shots[selectedIdx] ?? shots[0];
  const warnings = validateShotList(shots, 30);

  const activeLine = episode.script.lines[selectedIdx];
  const activeSet =
    bible.sets.find((s) => s.id === (activeLine?.setId || episode.script.setId)) ??
    bible.sets[0];

  const updateShot = (idx: number, patch: Partial<ShotItem>) => {
    setShots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/episodes/${episode.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shots: { shots } }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal menyimpan shot list");
        return;
      }
      toast.success("Shot list tersimpan ✓");
      router.refresh();
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setSaving(false);
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Total {shots.length} shot • 1 beat naskah = 1 shot kamera
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={saving || isLocked} size="sm">
            <Save className="size-4" /> {saving ? "Menyimpan..." : "Simpan Shot List"}
          </Button>
          <Link href={`/episodes/${episode.id}/preview`}>
            <Button size="sm" variant="secondary">
              Lanjut Preview Player <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          {warnings.map((w, i) => (
            <p key={i} className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0 text-amber-400" />
              <span>{w}</span>
            </p>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Preview Kamera 3D Interaktif */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="size-4" /> Atur Kamera dari Preview 3D
            </CardTitle>
            <CardDescription>
              Geser sudut pandang di 3D untuk Shot #{selectedIdx + 1}, lalu klik &ldquo;Pakai Kamera Ini&rdquo;.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeSet && activeShot && (
              <SetPreview3D
                set={activeSet}
                characters={bible.characters}
                visualStyle={series.visualStyle as "voxel-3d" | "cartoon-3d"}
                height={320}
                cameraPosition={activeShot.camera.position}
                cameraTarget={activeShot.camera.lookAt}
                onCameraCaptured={
                  isLocked
                    ? undefined
                    : (pos, target) => {
                        updateShot(selectedIdx, {
                          camera: {
                            ...activeShot.camera,
                            position: pos,
                            lookAt: target,
                          },
                        });
                        toast.success(`Koordinat kamera Shot #${selectedIdx + 1} diperbarui!`);
                      }
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Daftar Shot */}
        <Card className="studio-card lg:col-span-7">
          <CardHeader>
            <CardTitle className="text-base">Daftar Shot Kamera</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {shots.map((shot, idx) => {
              const line = episode.script.lines[idx];
              const hint = SHOT_HINTS[shot.shot];
              const isSelected = idx === selectedIdx;

              return (
                <div
                  key={shot.id ?? idx}
                  onClick={() => setSelectedIdx(idx)}
                  className={`cursor-pointer space-y-2.5 rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Bidikan #{idx + 1}</Badge>
                      <span className="text-xs font-semibold">
                        {line ? `${line.speaker}: "${line.text}"` : shot.note}
                      </span>
                    </div>
                    <span className="hidden text-[11px] text-muted-foreground md:inline">
                      {shot.startFrame}f → {shot.endFrame}f
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div>
                      <Label className="text-[11px]">Tipe Shot</Label>
                        <Select
                        value={shot.shot}
                        disabled={isLocked}
                        onValueChange={(v) => {
                          const nextType = (v as ShotItem["shot"]) || "medium";
                          const preset = SHOT_HINTS[nextType];
                          updateShot(idx, {
                            shot: nextType,
                            camera: {
                              position: [...preset.position] as [number, number, number],
                              lookAt: [...preset.lookAt] as [number, number, number],
                              fov: preset.fov,
                            },
                          });
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(SHOT_HINTS).map(([key, info]) => (
                            <SelectItem key={key} value={key}>
                              {info.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-[11px]">Transisi</Label>
                      <Select
                        value={shot.transition}
                        disabled={isLocked}
                        onValueChange={(v) =>
                          updateShot(idx, { transition: (v as "cut" | "fade") || "cut" })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cut">Cut (Default)</SelectItem>
                          <SelectItem value="fade">Fade (Ganti Lokasi/Waktu)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-[11px]">Start Frame</Label>
                      <Input
                        type="number"
                        disabled={isLocked}
                        value={shot.startFrame}
                        onChange={(e) =>
                          updateShot(idx, { startFrame: Number(e.target.value) || 0 })
                        }
                      />
                    </div>

                    <div>
                      <Label className="text-[11px]">End Frame</Label>
                      <Input
                        type="number"
                        disabled={isLocked}
                        value={shot.endFrame}
                        onChange={(e) =>
                          updateShot(idx, { endFrame: Number(e.target.value) || 1 })
                        }
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    💡 <strong>{hint.label}:</strong> {hint.description} • Kamera [
                    {shot.camera.position.join(", ")}] FOV {shot.camera.fov}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
