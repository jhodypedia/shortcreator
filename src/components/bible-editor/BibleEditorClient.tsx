"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Plus, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { SeriesBible, SeriesBibleSchema } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CharacterPreview3D } from "@/components/character-preview/CharacterPreview3D";
import { SetPreview3D } from "@/components/set-preview/SetPreview3D";
import { SeriesHeaderNav } from "@/components/series-nav";

export function BibleEditorClient({
  series,
  initialBible,
}: {
  series: {
    id: string;
    name: string;
    theme: string;
    audience: string;
    tone: string;
    language: string;
    visualStyle: string;
    bibleVersion: number;
  };
  initialBible: SeriesBible;
}) {
  const router = useRouter();
  const [bible, setBible] = useState<SeriesBible>(initialBible);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(initialBible, null, 2));
  const [version, setVersion] = useState(series.bibleVersion);
  const [changeReason, setChangeReason] = useState("");
  const [saving, setSaving] = useState(false);

  const syncBible = (next: SeriesBible) => {
    setBible(next);
    setJsonText(JSON.stringify(next, null, 2));
  };

  const handleJsonChange = (raw: string) => {
    setJsonText(raw);
    try {
      const parsed = JSON.parse(raw);
      const checked = SeriesBibleSchema.safeParse(parsed);
      if (checked.success) {
        setBible(checked.data);
      }
    } catch {
      // tunggu user selesai mengetik JSON
    }
  };

  async function handleSave() {
    let targetBible = bible;
    try {
      const parsedJson = JSON.parse(jsonText);
      const check = SeriesBibleSchema.safeParse(parsedJson);
      if (!check.success) {
        toast.error(check.error.issues[0]?.message || "Validasi Bible gagal");
        return;
      }
      targetBible = check.data;
    } catch {
      toast.error("Format JSON tidak valid, periksa tanda kurung/koma.");
      return;
    }

    for (const ch of targetBible.characters) {
      if (!ch.colorPrimary || !ch.voiceId) {
        toast.error(`Karakter "${ch.name}" wajib punya warna utama dan suara (voiceId).`);
        return;
      }
    }
    for (const st of targetBible.sets) {
      if (!st.lighting) {
        toast.error(`Set "${st.name}" wajib punya lighting preset.`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/series/${series.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bible: targetBible,
          changeNote: "Edit Series Bible",
          reason: changeReason.trim() || "Pembaruan konsistensi oleh kreator",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal menyimpan Series Bible");
        return;
      }
      setVersion(json.series.bibleVersion);
      syncBible(json.series.bible as SeriesBible);
      setChangeReason("");
      toast.success(`Series Bible tersimpan (v${json.series.bibleVersion})`);
      router.refresh();
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setSaving(false);
    }
  }

  function handleExportJson() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            seriesName: series.name,
            bibleVersion: version,
            bible,
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${series.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-bible-v${version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const candidate = raw.bible ?? raw;
      const checked = SeriesBibleSchema.safeParse(candidate);
      if (!checked.success) {
        toast.error(checked.error.issues[0]?.message || "File JSON Bible tidak valid");
        return;
      }
      syncBible(checked.data);
      toast.success("JSON Bible dimuat ke editor! Klik Simpan untuk mengunci versi baru.");
    } catch {
      toast.error("Gagal membaca file JSON");
    }
  }

  return (
    <div className="space-y-3">
      <SeriesHeaderNav
        seriesId={series.id}
        seriesName={series.name}
        bibleVersion={version}
        accentColor={bible.visualStyle.accentColor}
        emoji={bible.visualStyle.emoji}
      />

      {/* Action Bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <Input
            placeholder="Catatan perubahan (opsional, mis: tambah karakter baru)..."
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExportJson}>
            <Download className="size-4" /> Export .json
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">
            <Upload className="size-3.5" />
            <span>Import .json</span>
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportJson}
            />
          </label>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="size-4" /> {saving ? "Menyimpan..." : "Simpan Bible"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="form" className="space-y-4">
        <TabsList>
          <TabsTrigger value="form">Editor Form</TabsTrigger>
          <TabsTrigger value="json">JSON View (Sinkron 2 Arah)</TabsTrigger>
          <TabsTrigger value="changelog">Changelog ({bible.changelog?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="space-y-3">
          {/* Premise & Aturan Dunia */}
          <Card>
            <CardHeader>
              <CardTitle>Premise &amp; Aturan Dunia</CardTitle>
              <CardDescription>
                Satu sumber kebenaran agar cerita tidak melenceng antar episode.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Premise Utama (min. 10 karakter)</Label>
                <Textarea
                  rows={2}
                  value={bible.premise}
                  onChange={(e) => syncBible({ ...bible, premise: e.target.value })}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Aturan Dunia (1 baris = 1 aturan)</Label>
                  <Textarea
                    rows={4}
                    value={bible.world.rules.join("\n")}
                    onChange={(e) =>
                      syncBible({
                        ...bible,
                        world: {
                          ...bible.world,
                          rules: e.target.value.split("\n").filter(Boolean),
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Hal Mustahil</Label>
                  <Textarea
                    rows={4}
                    value={bible.world.impossible.join("\n")}
                    onChange={(e) =>
                      syncBible({
                        ...bible,
                        world: {
                          ...bible.world,
                          impossible: e.target.value.split("\n").filter(Boolean),
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Never Do / Larangan Series</Label>
                  <Textarea
                    rows={4}
                    value={bible.neverDo.join("\n")}
                    onChange={(e) =>
                      syncBible({
                        ...bible,
                        neverDo: e.target.value.split("\n").filter(Boolean),
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Continuity */}
          <Card>
            <CardHeader>
              <CardTitle>Continuity Serial (Otomatis Update Tiap Done)</CardTitle>
              <CardDescription>
                Episode lanjutan &amp; Bulk akan membaca kotak ini agar cerita terus bersambung.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Ringkasan Cerita Sejauh Ini</Label>
                <Textarea
                  rows={3}
                  value={bible.continuity.summary}
                  onChange={(e) =>
                    syncBible({
                      ...bible,
                      continuity: { ...bible.continuity, summary: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cliffhanger Aktif</Label>
                <Textarea
                  rows={3}
                  value={bible.continuity.activeCliffhanger}
                  onChange={(e) =>
                    syncBible({
                      ...bible,
                      continuity: {
                        ...bible.continuity,
                        activeCliffhanger: e.target.value,
                      },
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Visual Style */}
          <Card>
            <CardHeader>
              <CardTitle>Gaya Visual Global</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Warna Aksen Series</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    className="h-9 w-14 p-1"
                    value={bible.visualStyle.accentColor}
                    onChange={(e) =>
                      syncBible({
                        ...bible,
                        visualStyle: {
                          ...bible.visualStyle,
                          accentColor: e.target.value,
                        },
                      })
                    }
                  />
                  <Input
                    value={bible.visualStyle.accentColor}
                    onChange={(e) =>
                      syncBible({
                        ...bible,
                        visualStyle: {
                          ...bible.visualStyle,
                          accentColor: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Emoji Cover</Label>
                <Input
                  value={bible.visualStyle.emoji}
                  onChange={(e) =>
                    syncBible({
                      ...bible,
                      visualStyle: { ...bible.visualStyle, emoji: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Font Caption</Label>
                <Input
                  value={bible.visualStyle.captionFont}
                  onChange={(e) =>
                    syncBible({
                      ...bible,
                      visualStyle: { ...bible.visualStyle, captionFont: e.target.value },
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Karakter + 3D Avatar Preview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Karakter ({bible.characters.length})</CardTitle>
                <CardDescription>
                  Edit cepat di sini atau buka{" "}
                  <Link href={`/series/${series.id}/characters`} className="text-primary underline">
                    Character Builder 3D
                  </Link>
                  .
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  syncBible({
                    ...bible,
                    characters: [
                      ...bible.characters,
                      {
                        id: `char-${Date.now()}`,
                        name: `Karakter ${bible.characters.length + 1}`,
                        role: "Pendukung",
                        traits: ["unik", "sigap", "jujur"],
                        colorPrimary: "#10B981",
                        colorSkin: "#F5C6A5",
                        colorPants: "#1E293B",
                        colorHair: "#27272A",
                        proportions: { headScale: 1, bodyHeight: 1, limbLength: 1 },
                        voiceId: "id-ID-ArdiNeural",
                        voicePitch: 0,
                        voiceSpeed: 1,
                        expression: "netral",
                        accessory: "none",
                        catchphrase: "",
                        forbidden: "",
                      },
                    ],
                  })
                }
              >
                <Plus className="size-4" /> Tambah Karakter
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {bible.characters.map((ch, idx) => (
                <div
                  key={ch.id}
                  className="space-y-3 rounded-lg border border-border p-3"
                >
                  <CharacterPreview3D
                    character={ch}
                    visualStyle={series.visualStyle as "voxel-3d" | "cartoon-3d"}
                    height={180}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Nama</Label>
                      <Input
                        value={ch.name}
                        onChange={(e) => {
                          const next = [...bible.characters];
                          next[idx] = { ...ch, name: e.target.value };
                          syncBible({ ...bible, characters: next });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Peran</Label>
                      <Input
                        value={ch.role}
                        onChange={(e) => {
                          const next = [...bible.characters];
                          next[idx] = { ...ch, role: e.target.value };
                          syncBible({ ...bible, characters: next });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Warna Baju</Label>
                      <div className="flex gap-1.5">
                        <Input
                          type="color"
                          className="h-8 w-12 p-1"
                          value={ch.colorPrimary}
                          onChange={(e) => {
                            const next = [...bible.characters];
                            next[idx] = { ...ch, colorPrimary: e.target.value };
                            syncBible({ ...bible, characters: next });
                          }}
                        />
                        <Input
                          value={ch.colorPrimary}
                          onChange={(e) => {
                            const next = [...bible.characters];
                            next[idx] = { ...ch, colorPrimary: e.target.value };
                            syncBible({ ...bible, characters: next });
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Voice ID</Label>
                      <Input
                        value={ch.voiceId}
                        onChange={(e) => {
                          const next = [...bible.characters];
                          next[idx] = { ...ch, voiceId: e.target.value };
                          syncBible({ ...bible, characters: next });
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Sifat: {ch.traits.join(", ")}
                    </span>
                    {bible.characters.length > 1 && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          syncBible({
                            ...bible,
                            characters: bible.characters.filter((_, i) => i !== idx),
                          })
                        }
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Sets + 3D Scene Preview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Set / Lokasi ({bible.sets.length})</CardTitle>
                <CardDescription>
                  Atur props dan lighting lengkap di{" "}
                  <Link href={`/series/${series.id}/sets`} className="text-primary underline">
                    Set Builder 3D
                  </Link>
                  .
                </CardDescription>
              </div>
              <Link href={`/series/${series.id}/sets`}>
                <Button variant="outline" size="sm">
                  Buka Set Builder
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {bible.sets.map((st) => (
                <div key={st.id} className="space-y-2 rounded-lg border border-border p-3">
                  <SetPreview3D
                    set={st}
                    characters={bible.characters}
                    visualStyle={series.visualStyle as "voxel-3d" | "cartoon-3d"}
                    height={200}
                  />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{st.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {st.mood} • {st.props.length} props
                      </p>
                    </div>
                    <Badge variant="outline">{st.lighting}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json">
          <Card>
            <CardHeader>
              <CardTitle>JSON Series Bible (Sinkron Dua Arah)</CardTitle>
              <CardDescription>
                Edit JSON secara langsung; perubahan valid otomatis memperbarui tab Form.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={26}
                className="font-mono text-xs"
                value={jsonText}
                onChange={(e) => handleJsonChange(e.target.value)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="changelog">
          <Card>
            <CardHeader>
              <CardTitle>Riwayat Versi Series Bible</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {(bible.changelog ?? []).map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <span className="font-semibold">v{entry.version}</span> — {entry.change}
                    <p className="text-xs text-muted-foreground">{entry.reason}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
