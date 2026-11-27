"use client";

import { useEffect, useState } from "react";
import { Sparkles, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type SavedEpisode = { id: string; number: number };

export function AiEpisodeGenerator({ seriesId }: { seriesId: string }) {
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("Siap");
  const [percent, setPercent] = useState(0);
  const [draft, setDraft] = useState<unknown>(null);
  const [stopAfter, setStopAfter] = useState("complete");
  const [persist, setPersist] = useState(false);
  const [autopilotCount, setAutopilotCount] = useState(1);
  const [videoProvider, setVideoProvider] = useState<"remotion" | "gflow-cli">("remotion");

  useEffect(() => {
    void fetch("/api/settings").then((response) => response.json()).then((json) => {
      setVideoProvider(json.settings?.render?.provider === "gflow-cli" ? "gflow-cli" : "remotion");
    }).catch(() => setVideoProvider("remotion"));
  }, []);

  async function generate(forcePersist = false) {
    setBusy(true); setPercent(0); setDraft(null);
    try {
      const res = await fetch("/api/ai/episode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seriesId, idea, stopAfter: forcePersist ? "complete" : stopAfter, persist: persist || forcePersist, autopilotCount }) });
      if (!res.ok) { const error = await res.json(); throw new Error(error.error || "Gagal membuat episode"); }
      const reader = res.body?.getReader(); if (!reader) throw new Error("SSE tidak tersedia");
      const decoder = new TextDecoder(); let buffer = ""; let output: Record<string, unknown> | null = null;
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true }); const chunks = buffer.split("\n\n"); buffer = chunks.pop() || "";
        for (const chunk of chunks) {
          const event = chunk.match(/^event: (.+)$/m)?.[1]; const line = chunk.split("\n").find((part) => part.startsWith("data: ")); if (!line) continue;
          const data = JSON.parse(line.slice(6));
          if (event === "progress") { setStage(data.text || data.stage); setPercent(data.percent || 0); }
          if (event === "stage") { setStage(`Tahap ${data.stage}`); setPercent(data.percent); setDraft(data.output); }
          if (event === "result") { output = data; setPercent(100); setStage("Paket episode selesai"); }
          if (event === "error") throw new Error(data.error);
        }
      }
      if (output) {
        setDraft(output); toast.success("Paket AI selesai");
        const saved = output.savedEpisodes as SavedEpisode[] | undefined;
        if (saved?.length) { toast.success(`${saved.length} episode masuk render dan siap diproses`); if ("vibrate" in navigator) navigator.vibrate?.(35); }
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Generation gagal"); }
    finally { setBusy(false); }
  }

  async function generateFlowVideo() {
    setBusy(true); setPercent(1); setStage("Membuat episode untuk Google Flow"); setDraft(null);
    try {
      const res = await fetch("/api/ai/episode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seriesId, idea, stopAfter: "complete", persist: true, autopilotCount: 1 }) });
      if (!res.ok) { const error = await res.json(); throw new Error(error.error || "Gagal membuat episode"); }
      const reader = res.body?.getReader(); if (!reader) throw new Error("SSE tidak tersedia");
      const decoder = new TextDecoder(); let buffer = ""; let saved: SavedEpisode[] = [];
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true }); const chunks = buffer.split("\n\n"); buffer = chunks.pop() || "";
        for (const chunk of chunks) {
          const event = chunk.match(/^event: (.+)$/m)?.[1]; const line = chunk.split("\n").find((part) => part.startsWith("data: ")); if (!line) continue;
          const data = JSON.parse(line.slice(6));
          if (event === "progress") { setStage(data.text || data.stage || "Membuat episode"); setPercent(data.percent || 1); }
          if (event === "result") saved = data.savedEpisodes || [];
          if (event === "error") throw new Error(data.error);
        }
      }
      if (!saved.length) throw new Error("Episode tidak tersimpan. Periksa bahwa proses selesai pada tahap kritik.");
      setPercent(100); setStage("Episode tersimpan dan masuk antrean Google Flow");
      toast.success(`Episode ${saved[0].number} tersimpan dan masuk antrean Flow.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal membuat video Flow"); }
    finally { setBusy(false); }
  }

  return (
    <Card className="studio-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-amber-400" />AI Episode</CardTitle>
        <CardDescription>Ide → naskah → sutradara → kritik → voice → render. Pilih checkpoint untuk meninjau.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2"><Input value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Ide singkat episode…" /><Button disabled={busy || !idea.trim()} onClick={() => generate()}><Sparkles className="size-4" />{busy ? "Menghasilkan…" : "Minta AI"}</Button></div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">Tinjau setelah <select className="rounded-xl border border-border bg-background p-2" value={stopAfter} onChange={(event) => setStopAfter(event.target.value)}><option value="script">Naskah</option><option value="director">Sutradara</option><option value="complete">Kritik</option></select></label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={persist} onChange={(event) => setPersist(event.target.checked)} />Simpan otomatis & buat voice</label>
          {persist && <label className="text-sm">Episode berurutan <input className="w-16 rounded-xl border border-border bg-background p-2" type="number" min={1} max={20} value={autopilotCount} onChange={(event) => setAutopilotCount(Number(event.target.value))} /></label>}
        </div>
        <Button size="lg" className="w-full" disabled={busy || !idea.trim()} onClick={() => videoProvider === "gflow-cli" ? generateFlowVideo() : generate(true)}><Video className="size-5" />{videoProvider === "gflow-cli" ? "Buat Episode & Video dengan Google Flow" : "Buat Video dengan AI"}</Button>
        {videoProvider === "gflow-cli" && <p className="text-xs text-muted-foreground">Membuat satu klip video pendek melalui antrean Flow. Proses ini memakai kredit akun Flow yang login pada server.</p>}
        {(busy || percent > 0) && <div className="space-y-1"><Progress value={percent} /><p className="text-xs text-muted-foreground">{percent}% · {stage}</p><div className="ai-working h-1.5 rounded-full" /></div>}
        {draft !== null && <div className="space-y-2"><pre className="max-h-96 overflow-auto rounded-2xl bg-muted p-3 text-xs">{JSON.stringify(draft, null, 2)}</pre><div className="flex gap-2"><Button onClick={() => setDraft(null)}><Video className="size-4" />Selesai ditinjau</Button><Button variant="outline" onClick={() => setDraft(null)}>Tutup</Button></div></div>}
      </CardContent>
    </Card>
  );
}
