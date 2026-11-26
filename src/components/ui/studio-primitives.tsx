"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Sparkles, Check, LoaderCircle } from "lucide-react";
import { cn } from "cn";
import { Drawer } from "vaul";

export function IconButton({ label, children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button aria-label={label} title={label} className={cn("studio-button focus-ring inline-flex size-11 shrink-0 items-center justify-center border border-border bg-card text-foreground hover:border-primary/60", className)} {...props}>{children}</button>;
}

export function SaveIndicator({ state }: { state: "saved" | "saving" | "error" }) {
  const Icon = state === "saved" ? Check : state === "saving" ? LoaderCircle : Sparkles;
  const label = state === "saved" ? "Tersimpan" : state === "saving" ? "Menyimpan…" : "Belum tersimpan";
  return <span role="status" className="inline-flex min-h-9 items-center gap-2 text-xs text-muted-foreground"><Icon className={cn("size-3.5", state === "saved" && "text-primary", state === "saving" && "animate-spin", state === "error" && "text-destructive")} />{label}</span>;
}

export function ProgressRing({ value, size = 48, stroke = 4, className }: { value: number; size?: number; stroke?: number; className?: string }) {
  const radius = (size - stroke) / 2; const circumference = radius * 2 * Math.PI; const progress = Math.max(0, Math.min(100, value));
  return <div className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
    <svg width={size} height={size} className="-rotate-90"><circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--studio-border)" strokeWidth={stroke}/><motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--studio-emerald)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: circumference * (1 - progress / 100) }} transition={{ duration: .32, ease: [.2,.75,.25,1] }}/></svg>
    <span className="absolute text-[10px] font-semibold tabular-nums">{Math.round(progress)}%</span>
  </div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="studio-card flex min-h-56 flex-col items-center justify-center gap-3 p-6 text-center"><div className="voxel-empty-art" aria-hidden="true"><span/><span/><span/><span/><span/><span/></div><div><h3>{title}</h3><p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p></div>{action}</div>;
}

export function BottomSheet({ open, onOpenChange, title, children, snap = .78 }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: React.ReactNode; snap?: number }) {
  const snapPoint = Math.max(.55, Math.min(.92, snap));
  return <Drawer.Root open={open} onOpenChange={onOpenChange} snapPoints={[snapPoint, 1]} fadeFromIndex={0} shouldScaleBackground dismissible handleOnly={false}>
    <Drawer.Portal>
      <Drawer.Overlay className="fixed inset-0 z-[80] bg-black/65 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in" />
      <Drawer.Content className="modal-safe fixed inset-x-0 bottom-0 z-[81] mx-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-t-[24px] border border-border bg-card shadow-[var(--studio-shadow-float)] outline-none" style={{ maxHeight: `${Math.round(snapPoint * 100)}dvh` }}>
        <div className="flex shrink-0 flex-col items-center px-4 pt-3">
          <Drawer.Handle className="mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/50" />
          <Drawer.Title className="w-full pb-3 text-lg font-semibold">{title}</Drawer.Title>
          <Drawer.Description className="sr-only">Panel editor. Geser ke bawah untuk menutup.</Drawer.Description>
        </div>
        <div className="min-h-0 overflow-y-auto px-4 pb-6">{children}</div>
      </Drawer.Content>
    </Drawer.Portal>
  </Drawer.Root>;
}

export function AiFillButton({ onClick, label = "Isi dengan AI" }: { onClick?: () => void; label?: string }) {
  return <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/15"><Sparkles className="size-3.5"/>{label}</button>;
}

export function FloatingTabList({ items, value, onValueChange }: { items: Array<{ value: string; label: string }>; value: string; onValueChange: (value: string) => void }) {
  const container = React.useRef<HTMLDivElement>(null); const buttons = React.useRef(new Map<string, HTMLButtonElement>());
  React.useEffect(() => { const selected = buttons.current.get(value); if (!selected || !container.current) return; const node = container.current; const target = selected.offsetLeft - (node.clientWidth - selected.offsetWidth) / 2; node.scrollTo({ left: target, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }, [value]);
  return <div ref={container} className="mobile-scroll-tabs relative flex w-full gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1.5">{items.map((item) => <button ref={(node) => { if (node) buttons.current.set(item.value, node); else buttons.current.delete(item.value); }} key={item.value} aria-pressed={value === item.value} onClick={() => onValueChange(item.value)} className={cn("relative z-0 min-h-11 shrink-0 snap-center rounded-xl px-4 text-sm font-medium text-muted-foreground transition-colors", value === item.value && "text-foreground")}><span className="relative z-10">{item.label}</span>{value === item.value && <motion.span layoutId="studio-tab-indicator" className="absolute inset-0 -z-0 rounded-xl bg-primary/15" transition={{ type: "spring", stiffness: 420, damping: 34 }}/>}</button>)}</div>;
}
