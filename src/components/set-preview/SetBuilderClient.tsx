"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2, Upload, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { SeriesBible, SetConfig } from "@/lib/schemas";
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
import { SetPreview3D } from "./SetPreview3D";
import { SeriesHeaderNav } from "@/components/series-nav";

const SET_TEMPLATES: Array<{
  template: SetConfig["template"];
  label: string;
  mood: string;
  lighting: SetConfig["lighting"];
}> = [
  { template: "desa", label: "Desa Voxel", mood: "cerah dan ramai", lighting: "siang" },
  { template: "hutan", label: "Hutan Misteri", mood: "sejuk penuh rahasia", lighting: "senja" },
  { template: "gua", label: "Gua Kristal", mood: "misterius dan berkilau", lighting: "malam" },
  { template: "rumah", label: "Rumah Kayu", mood: "hangat di dalam ruang", lighting: "siang" },
  { template: "arena", label: "Arena Tantangan", mood: "kompetitif dan tegas", lighting: "senja" },
  { template: "pantai", label: "Pantai Blok", mood: "santai dan terbuka", lighting: "siang" },
];

const PROP_CATALOG = [
  { kind: "pohon", name: "Pohon Voxel" },
  { kind: "rumah", name: "Pondok / Balai" },
  { kind: "meja", name: "Meja Kayu" },
  { kind: "portal", name: "Portal Kristal" },
  { kind: "kristal", name: "Batu Kristal" },
  { kind: "batu", name: "Blok Batu" },
];

export function SetBuilderClient({
  series,
  initialBible,
  uploadedProps,
}: {
  series: { id: string; name: string; visualStyle: string; bibleVersion: number };
  initialBible: SeriesBible;
  uploadedProps: Array<{ id: string; name: string; path: string }>;
}) {
  const router = useRouter();
  const [sets, setSets] = useState<SetConfig[]>(initialBible.sets);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [customProps, setCustomProps] = useState(uploadedProps);
  const [saving, setSaving] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [aiCommand, setAiCommand] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const activeSet = sets[selectedIdx] ?? sets[0];

  const updateSet = (patch: Partial<SetConfig>) => {
    setSets((prev) =>
      prev.map((s, idx) => (idx === selectedIdx ? { ...s, ...patch } : s))
    );
  };

  async function generateSet(description: string, edit = false) {
    setAiBusy(true);
    try {
      const res = await fetch("/api/ai/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "setDesigner", input: { description: `${description}${edit && activeSet ? `; modifikasi set yang ada bernama ${activeSet.name} dengan properti: ${JSON.stringify(activeSet)}` : ""}`, bible: initialBible } }) });
      const reader = res.body?.getReader(); if (!reader) throw new Error("SSE tidak tersedia");
      const decoder = new TextDecoder(); let buffer = ""; let spec: Record<string, unknown> | null = null;
      while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const chunks = buffer.split("\n\n"); buffer = chunks.pop() || ""; for (const chunk of chunks) { const line = chunk.split("\n").find((item) => item.startsWith("data: ")); if (!line) continue; const payload = JSON.parse(line.slice(6)); if (chunk.includes("event: result")) spec = payload.data; if (chunk.includes("event: error")) throw new Error(payload.error); } }
      if (!spec) throw new Error("AI tidak menghasilkan set");
      const lighting = spec.timeOfDay === "malam" ? "malam" : spec.timeOfDay === "sore" ? "senja" : "siang";
      const next: SetConfig = { id: `set-ai-${sets.length + 1}`, name: String(spec.name), template: "desa", mood: `${spec.timeOfDay} · ${spec.sky}`, lighting, palette: (spec.objects as Array<{color:string}>).slice(0, 5).map((obj)=>obj.color), props: (spec.objects as Array<{type:string;position:number[];size:number[];color:string;rotation:number[]}>).map((obj, i)=>({ id:`ai-prop-${i+1}`, kind:obj.type, name:obj.type, position:[obj.position[0], obj.position[1], obj.position[2]] as [number,number,number], rotationY:obj.rotation[1], scale:Math.max(...obj.size) })) };
      const updated = edit && selectedIdx >= 0 ? sets.map((item, i) => i === selectedIdx ? { ...next, id: item.id } : item) : [...sets, next];
      setSets(updated); if (!edit) setSelectedIdx(updated.length - 1); toast.success("Set dibuat dengan AI");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal membuat set"); }
    finally { setAiBusy(false); }
  }

  async function handleUploadProp(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "prop");
    fd.append("name", file.name.replace(/\.[^.]+$/, ""));
    fd.append("seriesId", series.id);

    const res = await fetch("/api/assets", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Gagal mengunggah prop .glb");
      return;
    }
    setCustomProps((prev) => [json.asset, ...prev]);
    toast.success(`Prop "${json.asset.name}" ditambahkan ke katalog!`);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/series/${series.id}/sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sets, activeSetId: activeSet?.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal menyimpan set");
        return;
      }
      toast.success(
        `Set tersimpan ke Bible v${json.series.bibleVersion} & scene dibuat di ${json.generatedFiles?.join(", ")}`
      );
      router.refresh();
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <SeriesHeaderNav
        seriesId={series.id}
        seriesName={series.name}
        bibleVersion={series.bibleVersion}
        accentColor={initialBible.visualStyle.accentColor}
        emoji={initialBible.visualStyle.emoji}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {sets.map((s, idx) => (
            <Button
              key={s.id}
              variant={idx === selectedIdx ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedIdx(idx)}
            >
              {s.name} ({s.lighting})
            </Button>
          ))}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const newSet: SetConfig = {
                id: `set-${Date.now()}`,
                name: `Set Baru ${sets.length + 1}`,
                template: "hutan",
                mood: "sejuk",
                lighting: "senja",
                palette: ["#22C55E", "#F97316", "#0F172A"],
                props: [
                  {
                    id: `prop-${Date.now()}`,
                    kind: "pohon",
                    name: "Pohon Voxel",
                    position: [-2, 0, -2],
                    rotationY: 0,
                    scale: 1,
                  },
                ],
              };
              setSets((prev) => [...prev, newSet]);
              setSelectedIdx(sets.length);
            }}
          >
            <Plus className="size-4" /> Set Baru
          </Button>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-4" /> {saving ? "Menyimpan..." : "Simpan Set & Komponen"}
        </Button>
      </div>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4"/>Set / Scene oleh AI</CardTitle><CardDescription>Set disimpan sebagai set tambahan dan dapat dipilih per beat.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2"><Input placeholder="warung kelontong desa voxel sore hari" aria-label="Deskripsi set AI" value={aiDescription} onChange={(e)=>setAiDescription(e.target.value)} className="min-w-60 flex-1"/><Button disabled={aiBusy||!aiDescription.trim()} onClick={()=>generateSet(aiDescription)}><Sparkles className="size-4"/>{aiBusy?"Membuat…":"Buat set dengan AI"}</Button><Input placeholder="ubah latar jadi malam" aria-label="Perintah ubah set" value={aiCommand} onChange={(e)=>setAiCommand(e.target.value)}/><Button variant="secondary" disabled={aiBusy||!aiCommand.trim()} onClick={()=>generateSet(aiCommand,true)}>Ubah dengan perintah</Button></CardContent></Card>

      {activeSet && (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-6">
            <CardHeader>
              <CardTitle>Preview 3D — {activeSet.name}</CardTitle>
              <CardDescription>
                Lighting dikunci per set untuk menjaga konsistensi antar episode.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SetPreview3D
                set={activeSet}
                characters={initialBible.characters}
                visualStyle={series.visualStyle as "voxel-3d" | "cartoon-3d"}
                height={340}
              />
            </CardContent>
          </Card>

          <Card className="lg:col-span-6">
            <CardHeader>
              <CardTitle>Konfigurasi Template &amp; Props</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nama Set</Label>
                  <Input
                    value={activeSet.name}
                    onChange={(e) => updateSet({ name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Mood</Label>
                  <Input
                    value={activeSet.mood}
                    onChange={(e) => updateSet({ mood: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Template Set (6 Baku)</Label>
                  <Select
                    value={activeSet.template}
                    onValueChange={(v) => {
                      const tpl = SET_TEMPLATES.find((t) => t.template === v);
                      updateSet({
                        template: (v as SetConfig["template"]) || "desa",
                        ...(tpl ? { mood: tpl.mood, lighting: tpl.lighting } : {}),
                      });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SET_TEMPLATES.map((t) => (
                        <SelectItem key={t.template} value={t.template}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Lighting Preset</Label>
                  <Select
                    value={activeSet.lighting}
                    onValueChange={(v) =>
                      updateSet({ lighting: (v as SetConfig["lighting"]) || "siang" })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="siang">Siang Cerah</SelectItem>
                      <SelectItem value="senja">Senja Hangat</SelectItem>
                      <SelectItem value="malam">Malam Biru</SelectItem>
                      <SelectItem value="horror">Horror Gelap</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Katalog Props */}
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Tambah Prop dari Katalog</Label>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted">
                    <Upload className="size-3.5" />
                    <span>Upload .glb</span>
                    <input
                      type="file"
                      accept=".glb,.gltf"
                      className="hidden"
                      onChange={handleUploadProp}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PROP_CATALOG.map((p) => (
                    <Button
                      key={p.kind}
                      variant="outline"
                      size="xs"
                      onClick={() =>
                        updateSet({
                          props: [
                            ...activeSet.props,
                            {
                              id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                              kind: p.kind,
                              name: p.name,
                              position: [
                                Number(((Math.random() - 0.5) * 6).toFixed(1)),
                                0,
                                Number((-1.5 - Math.random() * 3).toFixed(1)),
                              ],
                              rotationY: 0,
                              scale: 1,
                            },
                          ],
                        })
                      }
                    >
                      + {p.name}
                    </Button>
                  ))}
                  {customProps.map((cp) => (
                    <Button
                      key={cp.id}
                      variant="secondary"
                      size="xs"
                      onClick={() =>
                        updateSet({
                          props: [
                            ...activeSet.props,
                            {
                              id: `prop-${Date.now()}`,
                              kind: "batu",
                              name: cp.name,
                              position: [0, 0, -2],
                              rotationY: 0,
                              scale: 1,
                              assetPath: cp.path,
                            },
                          ],
                        })
                      }
                    >
                      + {cp.name} (.glb)
                    </Button>
                  ))}
                </div>
              </div>

              {/* Posisi Props di Grid */}
              <div className="space-y-2">
                <Label>Props di Set ({activeSet.props.length})</Label>
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {activeSet.props.map((prop, pIdx) => (
                    <div
                      key={prop.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-xs"
                    >
                      <span className="min-w-24 font-medium">{prop.name}</span>
                      {(["X", "Y", "Z"] as const).map((axis, aIdx) => (
                        <label key={axis} className="flex items-center gap-1">
                          <span className="text-muted-foreground">{axis}</span>
                          <Input
                            type="number"
                            step={0.5}
                            className="h-7 w-16 text-xs"
                            value={prop.position[aIdx]}
                            onChange={(e) => {
                              const pos = [...prop.position] as [number, number, number];
                              pos[aIdx] = Number(e.target.value) || 0;
                              const nextProps = [...activeSet.props];
                              nextProps[pIdx] = { ...prop, position: pos };
                              updateSet({ props: nextProps });
                            }}
                          />
                        </label>
                      ))}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          updateSet({
                            props: activeSet.props.filter((_, idx) => idx !== pIdx),
                          })
                        }
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
