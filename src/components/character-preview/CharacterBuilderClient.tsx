"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Volume2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CharacterConfig, SeriesBible } from "@/lib/schemas";
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
import { CharacterPreview3D } from "./CharacterPreview3D";
import { SeriesHeaderNav } from "@/components/series-nav";
import { BottomSheet } from "@/components/ui/studio-primitives";

const VOICES = [
  { id: "id-ID-ArdiNeural", label: "Ardi (id-ID Pria)" },
  { id: "id-ID-GadisNeural", label: "Gadis (id-ID Wanita)" },
  { id: "en-US-GuyNeural", label: "Guy (en-US Pria)" },
  { id: "en-US-JennyNeural", label: "Jenny (en-US Wanita)" },
];

export function CharacterBuilderClient({
  series,
  initialBible,
}: {
  series: { id: string; name: string; visualStyle: string; bibleVersion: number };
  initialBible: SeriesBible;
}) {
  const router = useRouter();
  const [characters, setCharacters] = useState<CharacterConfig[]>(
    normalizeCharacters(initialBible.characters)
  );
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [speakingTest, setSpeakingTest] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [aiCommand, setAiCommand] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [undoStack, setUndoStack] = useState<CharacterConfig[][]>([]);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const activeChar = characters[selectedIdx] ?? characters[0];

  function normalizeCharacters(input: unknown): CharacterConfig[] {
    if (!Array.isArray(input)) return [];
    return input.filter((item) => Boolean(item && typeof item === "object")).map((character, index) => {
      const source = character as Partial<CharacterConfig>;
      return {
        ...source,
        id: typeof source.id === "string" && source.id ? source.id : `character-${index + 1}`,
        name: typeof source.name === "string" && source.name ? source.name : `Karakter ${index + 1}`,
        role: typeof source.role === "string" ? source.role : "Karakter",
        traits: Array.isArray(source.traits) ? source.traits.filter((trait): trait is string => typeof trait === "string") : [],
        colorPrimary: typeof source.colorPrimary === "string" ? source.colorPrimary : "#10B981",
        colorSkin: typeof source.colorSkin === "string" ? source.colorSkin : "#F5C6A5",
        colorPants: typeof source.colorPants === "string" ? source.colorPants : "#334155",
        colorHair: typeof source.colorHair === "string" ? source.colorHair : "#1E293B",
        proportions: source.proportions ?? { headScale: 1, bodyHeight: 1, limbLength: 1 },
        voiceId: typeof source.voiceId === "string" ? source.voiceId : "id-ID-ArdiNeural",
        voicePitch: typeof source.voicePitch === "number" ? source.voicePitch : 0,
        voiceSpeed: typeof source.voiceSpeed === "number" ? source.voiceSpeed : 1,
        expression: source.expression ?? "netral",
        accessory: source.accessory ?? "none",
        catchphrase: typeof source.catchphrase === "string" ? source.catchphrase : "",
        forbidden: typeof source.forbidden === "string" ? source.forbidden : "",
      } as CharacterConfig;
    });
  }

  const updateChar = (patch: Partial<CharacterConfig>) => {
    setCharacters((prev) =>
      prev.map((c, idx) => (idx === selectedIdx ? { ...c, ...patch } : c))
    );
  };

  async function generateCharacter(command?: string, variation = false) {
    setAiBusy(true);
    try {
      const description = command || aiDescription || (variation ? `Buat variasi baru dari ${activeChar?.name}, pertahankan peran utama namun ubah detail visual.` : "");
      const response = await fetch("/api/ai/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "characterDesigner", input: { description, bible: initialBible } }) });
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Sambungan progres AI gagal");
      const decoder = new TextDecoder(); let buffer = ""; let generated: Record<string, unknown> | null = null;
      while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const chunks = buffer.split("\n\n"); buffer = chunks.pop() || ""; for (const chunk of chunks) { const dataLine = chunk.split("\n").find((line) => line.startsWith("data: ")); if (!dataLine) continue; const payload = JSON.parse(dataLine.slice(6)); if (chunk.includes("event: result")) generated = payload.data; if (chunk.includes("event: error")) throw new Error(payload.error); } }
      if (!generated) throw new Error("AI tidak menghasilkan karakter");
      setUndoStack((prev) => [...prev, characters]);
      const raw = generated as Record<string, unknown>;
      const accessoryType = String((raw.accessories as Array<{type:string}>)[0]?.type || "none");
      const accessory = (["none", "topi", "kacamata", "syal", "mahkota"] as string[]).includes(accessoryType) ? accessoryType as CharacterConfig["accessory"] : "none";
      const config: CharacterConfig = { id: `char-${characters.length + 1}`, name: String(raw.name), role: String(raw.role), traits: Array.isArray(raw.traits) ? raw.traits.map(String).slice(0, 3) : [], colorPrimary: String(raw.shirtColor), colorSkin: String(raw.skinColor), colorPants: String(raw.pantsColor), colorHair: String(raw.hairColor), proportions: { headScale: Number(raw.headRatio), bodyHeight: Number(raw.height), limbLength: Number(raw.bodyWidth) }, voiceId: String((raw.voice as Record<string, unknown>).id), voicePitch: Number((raw.voice as Record<string, unknown>).pitch), voiceSpeed: Number((raw.voice as Record<string, unknown>).speed), expression: "netral", accessory, catchphrase: String(raw.catchphrase || ""), forbidden: "" };
      setCharacters((prev) => variation || command || !activeChar ? [...prev, config] : prev.map((ch, idx) => idx === selectedIdx ? config : ch));
      if (variation || !activeChar) setSelectedIdx(characters.length);
      toast.success("Karakter dibuat oleh AI");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Gagal membuat karakter"); }
    finally { setAiBusy(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const safeCharacters = normalizeCharacters(characters);
      const res = await fetch(`/api/series/${series.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bible: { ...initialBible, characters: safeCharacters },
          changeNote: "Pembaruan Character Builder 3D",
          reason: "Konsistensi karakter voxel/kartun",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal menyimpan karakter");
        return;
      }
      toast.success(`Karakter tersimpan ke Series Bible v${json.series.bibleVersion}`);
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
          {characters.map((ch, idx) => (
            <Button
              key={ch.id}
              variant={idx === selectedIdx ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedIdx(idx)}
            >
              <span
                className="mr-1 inline-block size-3 rounded-full"
                style={{ backgroundColor: ch.colorPrimary }}
              />
              {ch.name}
            </Button>
          ))}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const next: CharacterConfig = {
                id: `char-${Date.now()}`,
                name: `Karakter ${characters.length + 1}`,
                role: "Karakter Baru",
                traits: ["cerdik", "ramah", "lucu"],
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
              };
              setCharacters((prev) => [...prev, next]);
              setSelectedIdx(characters.length);
            }}
          >
            <Plus className="size-4" /> Karakter
          </Button>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-4" /> {saving ? "Menyimpan..." : "Simpan ke Bible"}
        </Button>
      </div>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4"/>Buat karakter dengan AI</CardTitle><CardDescription>Deskripsikan karakter, minta variasi, atau ubah karakter aktif lewat perintah.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2"><Input aria-label="Deskripsi karakter" placeholder="Contoh: pedagang warung yang tegas tapi baik hati" value={aiDescription} onChange={(e)=>setAiDescription(e.target.value)} className="min-w-60 flex-1"/><Button disabled={aiBusy||!aiDescription.trim()} onClick={()=>generateCharacter()}><Sparkles className="size-4"/>{aiBusy?"Membuat…":"Buat dengan AI"}</Button><Button variant="outline" disabled={aiBusy||!activeChar} onClick={()=>generateCharacter(undefined,true)}>Variasi lain</Button><Input aria-label="Perintah ubah karakter" placeholder="buat lebih gemuk dan pakai peci hijau" value={aiCommand} onChange={(e)=>setAiCommand(e.target.value)}/><Button variant="secondary" disabled={aiBusy||!aiCommand.trim()} onClick={()=>generateCharacter(aiCommand)}>Ubah dengan perintah</Button><Button variant="outline" disabled={!undoStack.length} onClick={()=>{setCharacters(undoStack[undoStack.length-1]);setUndoStack((s)=>s.slice(0,-1));toast.success("Versi sebelumnya dipulihkan")}}>Undo</Button></CardContent></Card>

      {activeChar && (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle>Preview 3D — {activeChar.name}</CardTitle>
              <CardDescription>
                Putar 360° untuk memeriksa proporsi, warna, ekspresi, dan aksesori.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <CharacterPreview3D
                character={activeChar}
                visualStyle={series.visualStyle as "voxel-3d" | "cartoon-3d"}
                height={340}
                autoSpeak={speakingTest}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSpeakingTest((v) => !v)}
              >
                <Volume2 className="size-4" />
                {speakingTest ? "Hentikan Simulasi Bicara" : "Simulasi Animasi Bicara"}
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle>Detail &amp; Rig Karakter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nama Karakter</Label>
                  <Input
                    value={activeChar.name}
                    onChange={(e) => updateChar({ name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Peran</Label>
                  <Input
                    value={activeChar.role}
                    onChange={(e) => updateChar({ role: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>3 Sifat (pisahkan koma)</Label>
                  <Input
                    value={(activeChar.traits ?? []).join(", ")}
                    onChange={(e) =>
                      updateChar({
                        traits: e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean)
                          .slice(0, 3),
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ekspresi Baku</Label>
                  <Select
                    value={activeChar.expression}
                    onValueChange={(v) =>
                      updateChar({
                        expression: (v as CharacterConfig["expression"]) || "netral",
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="netral">Netral</SelectItem>
                      <SelectItem value="senang">Senang</SelectItem>
                      <SelectItem value="kaget">Kaget</SelectItem>
                      <SelectItem value="sedih">Sedih</SelectItem>
                      <SelectItem value="marah">Marah</SelectItem>
                      <SelectItem value="mikir">Mikir</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Warna Bagian Tubuh */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { key: "colorPrimary", label: "Baju / Utama" },
                  { key: "colorSkin", label: "Kulit / Kepala" },
                  { key: "colorPants", label: "Celana / Kaki" },
                  { key: "colorHair", label: "Rambut / Alis" },
                ].map((item) => {
                  const val = (activeChar[item.key as keyof CharacterConfig] as string) || "#ffffff";
                  return (
                    <div key={item.key} className="space-y-1">
                      <Label className="text-xs">{item.label}</Label>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="color"
                          className="h-8 w-10 p-0.5"
                          value={val}
                          onChange={(e) =>
                            updateChar({ [item.key]: e.target.value } as Partial<CharacterConfig>)
                          }
                        />
                        <Input
                          className="text-xs"
                          value={val}
                          onChange={(e) =>
                            updateChar({ [item.key]: e.target.value } as Partial<CharacterConfig>)
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Aksesori & Suara */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Aksesori</Label>
                  <Select
                    value={activeChar.accessory}
                    onValueChange={(v) =>
                      updateChar({
                        accessory: (v as CharacterConfig["accessory"]) || "none",
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tanpa Aksesori</SelectItem>
                      <SelectItem value="topi">Topi Voxel</SelectItem>
                      <SelectItem value="kacamata">Kacamata</SelectItem>
                      <SelectItem value="syal">Syal Kuning</SelectItem>
                      <SelectItem value="mahkota">Mahkota</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Suara Default (Voice ID)</Label>
                  <Select
                    value={activeChar.voiceId}
                    onValueChange={(v) => updateChar({ voiceId: v || "id-ID-ArdiNeural" })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICES.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Pitch ({activeChar.voicePitch} Hz)</Label>
                  <Input
                    type="number"
                    min={-20}
                    max={20}
                    value={activeChar.voicePitch}
                    onChange={(e) =>
                      updateChar({ voicePitch: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Kecepatan Bicara ({activeChar.voiceSpeed}x)</Label>
                  <Input
                    type="number"
                    step={0.05}
                    min={0.6}
                    max={1.6}
                    value={activeChar.voiceSpeed}
                    onChange={(e) =>
                      updateChar({ voiceSpeed: Number(e.target.value) || 1 })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Catchphrase</Label>
                  <Input
                    value={activeChar.catchphrase}
                    onChange={(e) => updateChar({ catchphrase: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Larangan Karakter</Label>
                  <Input
                    value={activeChar.forbidden}
                    onChange={(e) => updateChar({ forbidden: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <BottomSheet open={editSheetOpen} onOpenChange={setEditSheetOpen} title={`Edit ${activeChar?.name ?? "karakter"}`}>
        {activeChar ? <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><div><Label>Nama</Label><Input value={activeChar.name} onChange={(e)=>updateChar({name:e.target.value})}/></div><div><Label>Peran</Label><Input value={activeChar.role} onChange={(e)=>updateChar({role:e.target.value})}/></div><div className="col-span-2"><Label>Sifat</Label><Input value={(activeChar.traits ?? []).join(", ")} onChange={(e)=>updateChar({traits:e.target.value.split(",").map((item)=>item.trim()).filter(Boolean).slice(0,5)})}/></div></div><CharacterPreview3D character={activeChar} visualStyle={series.visualStyle as "voxel-3d"|"cartoon-3d"} height={220}/><Button className="w-full" onClick={handleSave}><Save className="size-4"/>Simpan perubahan</Button></div> : null}
      </BottomSheet>
    </div>
  );
}
