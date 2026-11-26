"use client";

import { useState } from "react";
import { Sparkles, ChevronUp, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Operation = { op: "set" | "update" | "delete"; target: string; path: string; value?: unknown };
export function AiCommandBar({ state, onApply }: { state: unknown; onApply: (next: unknown, previous: unknown, operations: Operation[]) => void }) {
  const [command, setCommand] = useState(""); const [operations, setOperations] = useState<Operation[]>([]); const [busy, setBusy] = useState(false); const [expanded,setExpanded]=useState(false); const [history,setHistory]=useState<string[]>([]);
  async function preview() {
    setBusy(true);
    setHistory((old)=>[command,...old.filter((entry)=>entry!==command)].slice(0,5));
    try {
      const response = await fetch("/api/ai/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "editor", input: { command, state } }) });
      const reader = response.body?.getReader(); if (!reader) throw new Error("SSE tidak tersedia");
      const decoder = new TextDecoder(); let buffer = ""; let result: { data: { operations: Operation[] } } | null = null;
      while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const chunks = buffer.split("\n\n"); buffer = chunks.pop() || ""; for (const chunk of chunks) { const line = chunk.split("\n").find((part) => part.startsWith("data: ")); if (!line) continue; const data = JSON.parse(line.slice(6)); if (chunk.includes("event: result")) result = data; if (chunk.includes("event: error")) throw new Error(data.error); } }
      if (!result) throw new Error("Tidak ada patch dari AI"); setOperations(result.data.operations);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Perintah gagal"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2"><div className="flex gap-2"><Input value={command} onFocus={()=>setExpanded(true)} onChange={(e)=>setCommand(e.target.value)} placeholder="Perintah AI — mis. ubah latar jadi malam" aria-label="Perintah AI"/><Button disabled={busy||!command.trim()} onClick={preview}><Sparkles className="size-4"/>{busy?"Meminta AI…":"Minta AI"}</Button><Button variant="ghost" size="icon" aria-label="Saran perintah" onClick={()=>setExpanded((open)=>!open)}><ChevronUp className={`size-4 transition-transform ${expanded?"rotate-180":""}`}/></Button></div>{expanded&&<div className="flex gap-2 overflow-x-auto pb-1">{["buat lebih lucu","ganti latar jadi malam","buat karakter lebih ekspresif"].map((suggestion)=><button key={suggestion} onClick={()=>setCommand(suggestion)} className="studio-chip shrink-0 text-xs">{suggestion}</button>)}{history.length>0&&<span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3"/>Riwayat</span>}{history.map((entry)=><button key={entry} className="studio-chip shrink-0 text-xs" onClick={()=>setCommand(entry)}>{entry}</button>)}</div>}{busy&&<div className="ai-working h-1.5 overflow-hidden rounded-full" aria-label="AI sedang bekerja"/>}{operations.length>0&&<Card><CardContent className="space-y-2 pt-4"><p className="font-medium">Pratinjau perubahan ({operations.length})</p><pre className="max-h-60 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(operations,null,2)}</pre><div className="flex gap-2"><Button onClick={()=>{const previous=structuredClone(state);const next=structuredClone(state) as Record<string,unknown>;for(const op of operations){const parts=op.path.split(".");let target=next;for(const part of parts.slice(0,-1)){if(!target[part]||typeof target[part]!=="object")target[part]={};target=target[part] as Record<string,unknown>}if(op.op==="delete")delete target[parts.at(-1)!];else target[parts.at(-1)!]=op.value;}onApply(next,previous,operations);setOperations([]);toast.success("Perubahan diterapkan")}}>Terapkan</Button><Button variant="outline" onClick={()=>setOperations([])}>Batal</Button></div></CardContent></Card>}</div>;
}
