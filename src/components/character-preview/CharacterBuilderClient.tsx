"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Volume2 } from "lucide-react";
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
    initialBible.characters
  );
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [speakingTest, setSpeakingTest] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeChar = characters[selectedIdx] ?? characters[0];

  const updateChar = (patch: Partial<CharacterConfig>) => {
    setCharacters((prev) =>
      prev.map((c, idx) => (idx === selectedIdx ? { ...c, ...patch } : c))
    );
  };

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/series/${series.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bible: { ...initialBible, characters },
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
                    value={activeChar.traits.join(", ")}
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
    </div>
  );
}
