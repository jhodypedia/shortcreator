"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Layers, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { SeriesBible } from "@/lib/schemas";
import { EmptyState } from "@/components/ui/studio-primitives";

interface SeriesSummary {
  id: string;
  name: string;
  theme: string;
  audience: string;
  tone: string;
  language: string;
  visualStyle: string;
  bibleVersion: number;
  bible: unknown;
  episodes: Array<{ id: string; number: number; title: string; status: string }>;
}

export function SeriesListClient({
  initialSeries,
  openNewDefault = false,
}: {
  initialSeries: SeriesSummary[];
  openNewDefault?: boolean;
}) {
  const router = useRouter();
  const [seriesList, setSeriesList] = useState(initialSeries);
  const [open, setOpen] = useState(openNewDefault);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [theme, setTheme] = useState("");
  const [audience, setAudience] = useState<"anak" | "remaja" | "umum">("umum");
  const [tone, setTone] = useState<"lucu" | "tegang" | "heartwarming">("lucu");
  const [visualStyle, setVisualStyle] = useState<"voxel-3d" | "cartoon-3d">("voxel-3d");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          theme,
          audience,
          tone,
          language: "id-ID",
          visualStyle,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal membuat series");
        return;
      }
      toast.success(`Series "${json.series.name}" berhasil dibuat!`);
      setOpen(false);
      router.push(`/series/${json.series.id}`);
      router.refresh();
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, seriesName: string) {
    if (!confirm(`Hapus series "${seriesName}" beserta semua episodenya?`)) return;
    const res = await fetch(`/api/series/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Gagal menghapus series");
      return;
    }
    setSeriesList((prev) => prev.filter((s) => s.id !== id));
    toast.success(`Series "${seriesName}" dihapus`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1>Serial kreasiku</h1>
          <p className="page-description">
            Setiap serial dikunci oleh Panduan Serial agar karakter dan latar konsisten.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button>
                <Plus className="size-4" /> Serial Baru
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Buat Serial Baru</DialogTitle>
              <DialogDescription>
                Aplikasi akan membuat Panduan Serial awal berisi karakter, latar, dan aturan dunia yang dapat langsung Anda sunting.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="series-name">Nama Serial</Label>
                <Input
                  id="series-name"
                  placeholder="Misal: Kampung Voxel"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="series-theme">Tema Utama</Label>
                <Input
                  id="series-theme"
                  placeholder="Misal: Komedi misteri desa blok orisinal"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Audience</Label>
                  <Select
                    value={audience}
                    onValueChange={(v) =>
                      setAudience((v as "anak" | "remaja" | "umum") || "umum")
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anak">Anak</SelectItem>
                      <SelectItem value="remaja">Remaja</SelectItem>
                      <SelectItem value="umum">Umum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Tone</Label>
                  <Select
                    value={tone}
                    onValueChange={(v) =>
                      setTone((v as "lucu" | "tegang" | "heartwarming") || "lucu")
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lucu">Lucu</SelectItem>
                      <SelectItem value="tegang">Tegang</SelectItem>
                      <SelectItem value="heartwarming">Heartwarming</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Gaya Visual</Label>
                  <Select
                    value={visualStyle}
                    onValueChange={(v) =>
                      setVisualStyle((v as "voxel-3d" | "cartoon-3d") || "voxel-3d")
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="voxel-3d">Voxel 3D</SelectItem>
                      <SelectItem value="cartoon-3d">Kartun 3D</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={creating} className="w-full sm:w-auto">
                  {creating ? "Membuat..." : "Simpan & Buka Bible"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2>Semua serial</h2>
          <span className="studio-chip text-xs text-muted-foreground">{seriesList.length} serial</span>
        </div>
        {seriesList.length === 0 ? (
          <div className="p-4"><EmptyState title="Dunia voxelmu dimulai di sini" description="Ceritakan idemu. AI akan membangun bible, karakter, set, dan episode pertamamu." action={<Button size="lg" onClick={() => setOpen(true)}><Plus className="size-4"/>Buat serial pertama</Button>} /></div>
        ) : (
          <div className="grid gap-3 bg-transparent p-3 sm:grid-cols-2 xl:grid-cols-3">
            {seriesList.map((s) => {
              const bible = s.bible as SeriesBible;
              const accent = bible?.visualStyle?.accentColor || "#10b981";
              const emoji = bible?.visualStyle?.emoji || "🎬";
              return (
                <div key={s.id} className="studio-card touch-card relative p-4 transition-transform duration-200 hover:-translate-y-1" style={{ borderTopColor: accent }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div
                        className="flex size-14 shrink-0 items-center justify-center rounded-2xl border text-2xl transition-transform duration-200 hover:rotate-6 hover:scale-105"
                        style={{ backgroundColor: `${accent}1f`, borderColor: `${accent}66` }}
                        aria-hidden="true"
                      >
                        {emoji}
                      </div>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className="truncate text-[13px] font-semibold">{s.name}</p>
                          <Badge variant="outline">v{s.bibleVersion}</Badge>
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {s.episodes.length} episode · {s.tone === "lucu" ? "komedi" : s.tone === "tegang" ? "menegangkan" : "hangat"} · {s.visualStyle === "voxel-3d" ? "Voxel 3D" : "Kartun 3D"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(s.id, s.name)}
                      aria-label="Hapus series"
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
                    {bible?.premise}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Link href={`/series/${s.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">Panduan serial</Button>
                    </Link>
                    <Link href={`/series/${s.id}/episodes`} className="flex-1">
                      <Button size="sm" className="w-full">Episode ({s.episodes.length})</Button>
                    </Link>
                    <Link href={`/series/${s.id}/bulk`}>
                      <Button variant="secondary" size="sm">
                        <Layers className="size-3.5" /> Massal
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
