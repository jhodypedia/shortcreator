"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Lock,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { ActionTypeSchema, EpisodeScript, ScriptLine, SeriesBible } from "@/lib/schemas";
import { estimateLineDuration, validateScriptMetrics } from "@/lib/timing";
import { HookIdea } from "@/lib/ai";
import { EpisodeHeaderNav } from "@/components/episode-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export function EpisodeScriptClient({
  episode,
  series,
  bible,
  continuitySummary,
}: {
  episode: {
    id: string;
    number: number;
    title: string;
    status: string;
    hook: string;
    twist: string;
    cliffhanger: string;
    cliffhangerFrom: string | null;
    script: EpisodeScript;
  };
  series: { id: string; name: string };
  bible: SeriesBible;
  continuitySummary?: [string, string, string] | null;
}) {
  const isLocked = episode.status === "done";
  const [title, setTitle] = useState(episode.title);
  const [hook, setHook] = useState(episode.hook);
  const [twist, setTwist] = useState(episode.twist);
  const [cliffhanger, setCliffhanger] = useState(episode.cliffhanger);
  const [lines, setLines] = useState<ScriptLine[]>(episode.script.lines ?? []);
  const [continuityConfirmed, setContinuityConfirmed] = useState(
    Boolean(episode.script.continuityConfirmed)
  );
  const [continuityNote, setContinuityNote] = useState(
    episode.script.continuityNote ?? ""
  );

  const [ideas, setIdeas] = useState<HookIdea[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<HookIdea | null>(null);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [writingScript, setWritingScript] = useState(false);

  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty" | "error">("saved");
  const isFirstRender = useRef(true);

  const metrics = validateScriptMetrics(lines);

  async function saveToServer(silent = false) {
    if (isLocked) return;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/episodes/${episode.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          hook,
          twist,
          cliffhanger,
          script: {
            lines,
            setId: episode.script.setId ?? bible.sets[0]?.id,
            continuityConfirmed,
            continuityNote,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveState("error");
        if (!silent) toast.error(json.error || "Gagal menyimpan naskah");
        return;
      }
      setSaveState("saved");
      if (!silent) toast.success("Naskah tersimpan ✓");
    } catch {
      setSaveState("error");
      if (!silent) toast.error("Gagal menghubungi server");
    }
  }

  // Autosave debounce
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (isLocked) return;
    const timer = setTimeout(() => {
      void saveToServer(true);
    }, 1100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, hook, twist, cliffhanger, lines, continuityConfirmed, continuityNote]);

  async function handleGenerateIdeas() {
    setLoadingIdeas(true);
    try {
      const res = await fetch("/api/ai/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId: series.id,
          useContinuity: Boolean(episode.cliffhangerFrom || episode.number > 1),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal membuat ide");
        return;
      }
      setIdeas(json.ideas ?? []);
      toast.success(
        json.source === "ai"
          ? "3 ide hook dibuat oleh AI!"
          : "3 ide hook dibuat dari template lokal (AI belum dikonfigurasi)."
      );
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setLoadingIdeas(false);
    }
  }

  async function handleWriteFromIdea() {
    if (!selectedIdea) {
      toast.error("Pilih 1 dari 3 ide hook terlebih dahulu.");
      return;
    }
    setWritingScript(true);
    try {
      const res = await fetch("/api/ai/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId: series.id,
          title,
          hook: selectedIdea.hook,
          conflict: selectedIdea.conflict,
          twist: selectedIdea.twist,
          payoff: selectedIdea.payoff,
          cliffhanger: selectedIdea.cliffhanger,
          cliffhangerFrom: episode.cliffhangerFrom,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal menulis naskah");
        return;
      }
      setHook(selectedIdea.hook);
      setTwist(selectedIdea.twist);
      setCliffhanger(selectedIdea.cliffhanger);
      setLines(json.lines);
      toast.success("Naskah lengkap berhasil disusun!");
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setWritingScript(false);
    }
  }

  return (
    <div className="space-y-3">
      <EpisodeHeaderNav
        episodeId={episode.id}
        seriesId={series.id}
        seriesName={series.name}
        episodeNumber={episode.number}
        episodeTitle={title}
        status={episode.status}
        accentColor={bible.visualStyle.accentColor}
      />

      {isLocked && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
          <div className="flex items-center gap-2 text-emerald-300">
            <Lock className="size-4" />
            <span>
              Episode berstatus <strong>Selesai</strong> dan dikunci dari perubahan.
            </span>
          </div>
          <Link href={`/episodes/${episode.id}/review`}>
            <Button size="sm" variant="outline">
              Buka di Halaman Review
            </Button>
          </Link>
        </div>
      )}

      {/* Continuity Context Box */}
      {episode.cliffhangerFrom && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-300">
              Mode Lanjutan — Melanjutkan Cliffhanger Sebelumnya
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p>
              <strong>Cliffhanger wajib dijawab:</strong> {episode.cliffhangerFrom}
            </p>
            {continuitySummary && (
              <div className="space-y-0.5 text-muted-foreground">
                {continuitySummary.map((line, i) => (
                  <p key={i}>• {line}</p>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="ep-cont-ok"
                checked={continuityConfirmed}
                onCheckedChange={(v) => setContinuityConfirmed(v)}
                disabled={isLocked}
              />
              <label htmlFor="ep-cont-ok">
                Konfirmasi cliffhanger sudah dijawab / sengaja ditunda
              </label>
            </div>
            {continuityConfirmed && (
              <Input
                placeholder="Alasan / catatan continuity..."
                value={continuityNote}
                onChange={(e) => setContinuityNote(e.target.value)}
                disabled={isLocked}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Toolbar Save & Autosave */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-xs">
          {saveState === "saving" && (
            <Badge variant="outline">Menyimpan otomatis...</Badge>
          )}
          {saveState === "saved" && (
            <Badge className="bg-emerald-600/20 text-emerald-300">
              <Check className="autosave-check mr-1 size-3" /> Tersimpan ✓
            </Badge>
          )}
          {saveState === "dirty" && (
            <Badge variant="secondary">Perubahan belum tersimpan...</Badge>
          )}
          {saveState === "error" && (
            <Badge variant="destructive">Gagal autosave — cek validasi</Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateIdeas}
            disabled={loadingIdeas || isLocked}
          >
            <Sparkles className="size-4" />
            {loadingIdeas ? "Mencari ide..." : "Generate 3 Ide Hook"}
          </Button>
          <Button size="sm" onClick={() => saveToServer(false)} disabled={isLocked}>
            <Save className="size-4" /> Simpan Naskah
          </Button>
          <Link href={`/episodes/${episode.id}/voice`}>
            <Button size="sm" variant="secondary">
              Lanjut Voice &amp; Timing <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* 3 Ide Hook */}
      {ideas.length > 0 && (
        <Card className="border-primary/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Pilih 1 dari 3 Ide Hook</CardTitle>
              <CardDescription>Format: Hook | Konflik | Twist | Payoff</CardDescription>
            </div>
            <Button
              size="sm"
              disabled={!selectedIdea || writingScript || isLocked}
              onClick={handleWriteFromIdea}
            >
              <Wand2 className="size-4" />
              {writingScript ? "Menulis..." : "Tulis Naskah dari Ide"}
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {ideas.map((idea, idx) => {
              const active = selectedIdea === idea;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedIdea(idea)}
                  className={`rounded-lg border p-3 text-left text-xs transition-all ${
                    active
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">Ide #{idx + 1}</p>
                  <p className="mt-1">
                    <strong>Hook:</strong> {idea.hook}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    <strong>Konflik:</strong> {idea.conflict}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    <strong>Twist:</strong> {idea.twist}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    <strong>Cliffhanger:</strong> {idea.cliffhanger}
                  </p>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Editor Baris Naskah */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-2">
          <div>
            <CardTitle className="text-[13px]">Beat / Dialog</CardTitle>
            <CardDescription className="text-[11px]">
              1 baris = 1 shot, maksimal 12 kata per baris.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={isLocked}
            onClick={() =>
              setLines((prev) => [
                ...prev,
                {
                  id: `line-${Date.now()}`,
                  beat: "konflik",
                  speaker: bible.characters[0]?.name ?? "Raka",
                  text: "Kalimat dialog baru...",
                  emotion: "netral",
                  durationSec: 1.6,
                  setId: bible.sets[0]?.id,
                },
              ])
            }
          >
            <Plus className="size-3.5" /> Tambah Baris
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 pt-2">
          {lines.map((line, idx) => (
            <div
              key={line.id}
              className="space-y-2 rounded-md border border-border bg-[#0b0c0e] p-2"
            >
              <div className="flex items-center gap-1.5">
                <span className="mono flex size-5 shrink-0 items-center justify-center rounded-sm border border-border text-[10px] text-muted-foreground">{idx + 1}</span>
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:grid-cols-4">
                  <Select
                    value={line.beat}
                    disabled={isLocked}
                    onValueChange={(v) => {
                      const next = [...lines];
                      next[idx] = { ...line, beat: (v as ScriptLine["beat"]) || "konflik" };
                      setLines(next);
                    }}
                  >
                    <SelectTrigger className="w-full" aria-label={`Beat baris ${idx + 1}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hook">Hook (0–3s)</SelectItem>
                      <SelectItem value="setup">Setup</SelectItem>
                      <SelectItem value="konflik">Konflik</SelectItem>
                      <SelectItem value="twist">Twist</SelectItem>
                      <SelectItem value="payoff">Payoff + CTA</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={line.speaker}
                    disabled={isLocked}
                    onValueChange={(v) => {
                      const next = [...lines];
                      next[idx] = { ...line, speaker: v || bible.characters[0]?.name || "Raka" };
                      setLines(next);
                    }}
                  >
                    <SelectTrigger className="w-full" aria-label={`Speaker baris ${idx + 1}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {bible.characters.map((ch) => (
                        <SelectItem key={ch.id} value={ch.name}>
                          {ch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={line.emotion ?? "netral"}
                    disabled={isLocked}
                    onValueChange={(v) => {
                      const next = [...lines];
                      next[idx] = {
                        ...line,
                        emotion: (v as ScriptLine["emotion"]) || "netral",
                      };
                      setLines(next);
                    }}
                  >
                    <SelectTrigger className="w-full" aria-label={`Emosi baris ${idx + 1}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="netral">Netral</SelectItem>
                      <SelectItem value="senang">Senang</SelectItem>
                      <SelectItem value="kaget">Kaget</SelectItem>
                      <SelectItem value="sedih">Sedih</SelectItem>
                      <SelectItem value="marah">Marah</SelectItem>
                      <SelectItem value="mikir">Mikir</SelectItem>
                      <SelectItem value="curiga">Curiga</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={line.action ?? "talk"}
                    disabled={isLocked}
                    onValueChange={(v) => {
                      const next = [...lines];
                      next[idx] = { ...line, action: (v as ScriptLine["action"]) || "talk" };
                      setLines(next);
                    }}
                  >
                    <SelectTrigger className="w-full" aria-label={`Aksi baris ${idx + 1}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ActionTypeSchema.options.map((action) => <SelectItem key={action} value={action}>{action}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select
                    value={line.setId || bible.sets[0]?.id || ""}
                    disabled={isLocked}
                    onValueChange={(v) => {
                      const next = [...lines];
                      next[idx] = { ...line, setId: v || undefined };
                      setLines(next);
                    }}
                  >
                    <SelectTrigger className="w-full" aria-label={`Set baris ${idx + 1}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {bible.sets.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <span className="mono hidden shrink-0 items-center gap-1 text-[10px] text-muted-foreground sm:flex">
                  <Input
                    type="number"
                    step={0.1}
                    min={0.5}
                    max={20}
                    disabled={isLocked}
                    value={line.durationSec}
                    aria-label={`Durasi baris ${idx + 1}`}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx] = {
                        ...line,
                        durationSec: Number(e.target.value) || 1,
                      };
                      setLines(next);
                    }}
                    className="h-7 w-14 px-1 text-center text-[11px]"
                  />
                  s
                </span>
              </div>

              <div className="flex items-start gap-1.5">
                <Textarea
                  rows={2}
                  disabled={isLocked}
                  value={line.text}
                  aria-label={`Dialog baris ${idx + 1}`}
                  onChange={(e) => {
                    const txt = e.target.value;
                    const next = [...lines];
                    next[idx] = {
                      ...line,
                      text: txt,
                      durationSec: estimateLineDuration(txt),
                    };
                    setLines(next);
                  }}
                />
                {lines.length > 1 && !isLocked && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Hapus baris ${idx + 1}`}
                    onClick={() =>
                      setLines((prev) => prev.filter((_, i) => i !== idx))
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
        </div>

        <aside className="min-w-0 space-y-3">
      {/* Metadata Episode */}
      <Card>
        <CardHeader className="border-b border-border pb-2">
          <CardTitle className="text-[13px]">Kerangka Cerita</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 pt-2">
          <div className="space-y-1">
            <Label htmlFor="ep-title">Judul</Label>
            <Input
              id="ep-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLocked}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ep-hook">Hook (0–3 detik)</Label>
            <Input
              id="ep-hook"
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              disabled={isLocked}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ep-twist">Twist</Label>
            <Input
              id="ep-twist"
              value={twist}
              onChange={(e) => setTwist(e.target.value)}
              disabled={isLocked}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ep-cliffhanger">
              Cliffhanger Baru{" "}
              {episode.cliffhangerFrom && (
                <span className="text-[11px] text-destructive">(Wajib)</span>
              )}
            </Label>
            <Input
              id="ep-cliffhanger"
              value={cliffhanger}
              onChange={(e) => setCliffhanger(e.target.value)}
              disabled={isLocked}
            />
          </div>
        </CardContent>
      </Card>

      {/* Metrics & Warnings */}
      <div className="space-y-2">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border px-3 py-1.5">
            <p className="panel-title">Metrik Naskah</p>
          </div>
          <dl className="divide-y divide-border text-[11px]">
            <div className="flex items-center justify-between px-3 py-1.5">
              <dt className="text-muted-foreground">Total kata</dt>
              <dd className="mono text-foreground">{metrics.totalWords}</dd>
            </div>
            <div className="flex items-center justify-between px-3 py-1.5">
              <dt className="text-muted-foreground">Estimasi durasi</dt>
              <dd className="mono text-foreground">{metrics.estimatedDurationSec}s / 15–60s</dd>
            </div>
            <div className="flex items-center justify-between px-3 py-1.5">
              <dt className="text-muted-foreground">Total beat</dt>
              <dd className="mono text-foreground">{lines.length}</dd>
            </div>
          </dl>
        </div>

        {metrics.warnings.length > 0 && (
          <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
            {metrics.warnings.map((w, idx) => (
              <p key={idx} className="flex items-center gap-1.5">
                <AlertTriangle className="size-3 shrink-0 text-amber-400" />
                <span>{w}</span>
              </p>
            ))}
          </div>
        )}
      </div>
        </aside>
      </div>
    </div>
  );
}
