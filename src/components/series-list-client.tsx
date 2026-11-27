"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Layers, Plus, Trash2, Search, LayoutGrid, List, MoreHorizontal, BookOpen, Film, ArrowUpDown } from "lucide-react";
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
import { ProgressRing } from "@/components/ui/studio-primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
  updatedAt?: Date | string;
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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"updated" | "name" | "episodes">("updated");
  const [layout, setLayout] = useState<"grid" | "list">("grid");

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

  const visibleSeries = useMemo(() => {
    const filtered = seriesList.filter((series) => `${series.name} ${series.theme} ${series.tone}`.toLowerCase().includes(query.trim().toLowerCase()) && (filter === "all" || series.episodes.some((episode) => episode.status === filter)));
    if (sort === "name") return filtered.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "episodes") return filtered.sort((a, b) => b.episodes.length - a.episodes.length);
    return filtered.sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());
  }, [seriesList, query, filter, sort]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1>Serial kreasiku</h1>
          <p className="page-description">Kelola dunia cerita, karakter, dan produksi episode dari satu tempat.</p>
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

      <section className="space-y-3">
        <div className="studio-card grid gap-2 p-3 sm:grid-cols-[minmax(180px,1fr)_auto_auto_auto] sm:items-center sm:p-4">
          <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-3"><Search className="size-4 shrink-0 text-muted-foreground"/><input aria-label="Cari serial" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari serial…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"/></label>
          <select aria-label="Filter status" value={filter} onChange={(event) => setFilter(event.target.value)} className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm"><option value="all">Semua status</option>{["draft","script","timing","ready","rendering","review","done"].map((status) => <option key={status} value={status}>{status}</option>)}</select>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs text-muted-foreground"><ArrowUpDown className="size-3.5"/><select aria-label="Urutkan serial" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="min-w-0 bg-transparent text-sm text-foreground outline-none"><option value="updated">Terbaru</option><option value="name">Nama</option><option value="episodes">Episode</option></select></label>
          <div className="flex min-h-11 items-center rounded-xl border border-border bg-background p-1"><Button size="icon-sm" variant={layout === "grid" ? "secondary" : "ghost"} aria-label="Tampilan grid" aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}><LayoutGrid className="size-4"/></Button><Button size="icon-sm" variant={layout === "list" ? "secondary" : "ghost"} aria-label="Tampilan daftar" aria-pressed={layout === "list"} onClick={() => setLayout("list")}><List className="size-4"/></Button></div>
        </div>
        <div className="flex items-center justify-between px-1"><h2>Semua serial</h2><span className="studio-chip text-xs text-muted-foreground">{visibleSeries.length} dari {seriesList.length}</span></div>
        {seriesList.length === 0 ? (
          <div className="p-4"><EmptyState title="Dunia voxelmu dimulai di sini" description="Ceritakan idemu. AI akan membangun bible, karakter, set, dan episode pertamamu." action={<Button size="lg" onClick={() => setOpen(true)}><Plus className="size-4"/>Buat serial pertama</Button>} /></div>
        ) : visibleSeries.length === 0 ? (
          <div className="studio-card p-4"><EmptyState title="Tidak ada hasil" description="Ubah pencarian atau filter untuk menemukan serial." action={<Button variant="outline" onClick={() => { setQuery(""); setFilter("all"); }}>Hapus filter</Button>} /></div>
        ) : (
          <div className={layout === "grid" ? "grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3" : "grid min-w-0 gap-2"}>
            {visibleSeries.map((s) => {
              const bible = s.bible as SeriesBible;
              const accent = typeof bible?.visualStyle?.accentColor === "string" && /^#[0-9a-f]{6}$/i.test(bible.visualStyle.accentColor) ? bible.visualStyle.accentColor : "#10b981";
              const emoji = typeof bible?.visualStyle?.emoji === "string" ? bible.visualStyle.emoji : "🎬";
              const complete = s.episodes.filter((episode) => episode.status === "done").length;
              const characters = bible?.characters ?? [];
              return (
                <div key={s.id} className={`studio-card spotlight-card touch-card relative min-w-0 overflow-hidden p-4 ${layout === "list" ? "sm:flex sm:items-center sm:gap-4" : ""}`} style={{ borderTopColor: accent }} onPointerMove={(event) => { if (event.pointerType === "mouse" && window.matchMedia("(pointer:fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) { const rect = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`); event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`); } }}>
                  <div aria-hidden="true" className="absolute inset-x-0 top-0 h-20 opacity-35" style={{ background: `linear-gradient(125deg, ${accent}55, transparent 72%)` }} />
                  <div className="relative flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div
                        className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border text-2xl"
                        style={{ background: `linear-gradient(145deg, ${accent}55, ${accent}12)`, borderColor: `${accent}66` }}
                        aria-hidden="true"
                      >
                        <span className="max-h-full max-w-full truncate" aria-hidden="true">{emoji}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className="line-clamp-1 min-w-0 text-[13px] font-semibold">{s.name}</p>
                          <Badge variant="outline">v{s.bibleVersion}</Badge>
                        </div>
                        <p className="line-clamp-1 min-w-0 text-[11px] text-muted-foreground">
                          {s.episodes.length} episode · {s.tone === "lucu" ? "komedi" : s.tone === "tegang" ? "menegangkan" : "hangat"} · {s.visualStyle === "voxel-3d" ? "Voxel 3D" : "Kartun 3D"}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Aksi ${s.name}`}><MoreHorizontal className="size-4"/></Button>}/><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => router.push(`/series/${s.id}`)}><BookOpen/>Buka panduan</DropdownMenuItem><DropdownMenuItem onClick={() => router.push(`/series/${s.id}/episodes`)}><Film/>Lihat episode</DropdownMenuItem><DropdownMenuItem variant="destructive" onClick={() => handleDelete(s.id, s.name)}><Trash2/>Hapus serial</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
                    {bible?.premise}
                  </p>
                  <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2"><ProgressRing value={s.episodes.length ? complete / s.episodes.length * 100 : 0} size={40} stroke={3}/><div className="text-xs"><p className="font-medium">{complete}/{s.episodes.length} selesai</p><p className="text-muted-foreground">episode</p></div></div>
                    <div className="flex items-center"><div className="flex -space-x-2">{characters.slice(0, 4).map((character) => <Avatar key={character.id} className="size-8 border-2 border-card"><AvatarFallback style={{ backgroundColor: character.colorPrimary, color: "#fff" }}>{character.name.slice(0,1)}</AvatarFallback></Avatar>)}</div><Badge variant="outline" className="ml-2">{characters.length} karakter</Badge></div>
                  </div>
                  <div className="relative mt-3 flex flex-wrap gap-1.5">
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
