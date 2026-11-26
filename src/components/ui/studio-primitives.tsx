"use client";

import * as React from "react";
import { motion, useMotionValue, animate } from "motion/react";
import { Sparkles, X } from "lucide-react";
import { cn } from "cn";

export function IconButton({ label, children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button aria-label={label} title={label} className={cn("studio-button focus-ring inline-flex size-11 shrink-0 items-center justify-center border border-border bg-card text-foreground hover:border-primary/60", className)} {...props}>{children}</button>;
}

export function ProgressRing({ value, size = 48, stroke = 4, className }: { value: number; size?: number; stroke?: number; className?: string }) {
  const radius = (size - stroke) / 2; const circumference = radius * 2 * Math.PI; const progress = Math.max(0, Math.min(100, value));
  return <div className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
    <svg width={size} height={size} className="-rotate-90"><circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--studio-border)" strokeWidth={stroke}/><motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--studio-emerald)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: circumference * (1 - progress / 100) }} transition={{ duration: .5, ease: [.2,.75,.25,1] }}/></svg>
    <span className="absolute text-[10px] font-semibold tabular-nums">{Math.round(progress)}%</span>
  </div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="studio-card flex min-h-56 flex-col items-center justify-center gap-3 p-6 text-center"><div className="pixel-empty-art !h-16 !w-24" aria-hidden="true"/><div><h3>{title}</h3><p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p></div>{action}</div>;
}

export function BottomSheet({ open, onOpenChange, title, children, snap = .78 }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: React.ReactNode; snap?: number }) {
  const y = useMotionValue(1000); const startY = React.useRef(0);
  React.useEffect(() => { if (open) animate(y, 0, { type: "spring", stiffness: 360, damping: 34 }); else animate(y, 1000, { duration: .2 }); }, [open, y]);
  React.useEffect(() => { if (!open) return; const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onOpenChange(false); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [open, onOpenChange]);
  if (!open) return null;
  return <div className="fixed inset-0 z-[80] flex items-end justify-center" role="presentation"><button className="absolute inset-0 bg-black/65" aria-label="Tutup panel" onClick={() => onOpenChange(false)}/><motion.section role="dialog" aria-modal="true" aria-label={title} style={{ y, maxHeight: `${Math.round(snap * 100)}dvh` }} drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: .35 }} onDragStart={() => { startY.current = y.get(); }} onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 650) onOpenChange(false); else animate(y, 0, { type: "spring", stiffness: 400, damping: 35 }); }} className="modal-safe relative flex w-full max-w-2xl flex-col overflow-hidden rounded-t-[24px] border border-border bg-card shadow-[var(--studio-shadow-float)]"><div className="flex touch-none flex-col items-center px-4 pt-3" onClick={() => animate(y, 0, { type: "spring", stiffness: 400, damping: 35 })}><span className="mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/50"/><div className="flex w-full items-center justify-between pb-3"><h2>{title}</h2><IconButton label="Tutup" onClick={() => onOpenChange(false)}><X className="size-4"/></IconButton></div></div><div className="min-h-0 overflow-y-auto px-4 pb-6">{children}</div></motion.section></div>;
}

export function AiFillButton({ onClick, label = "Isi dengan AI" }: { onClick?: () => void; label?: string }) {
  return <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/15"><Sparkles className="size-3.5"/>{label}</button>;
}

export function FloatingTabList({ items, value, onValueChange }: { items: Array<{ value: string; label: string }>; value: string; onValueChange: (value: string) => void }) {
  const container = React.useRef<HTMLDivElement>(null); const buttons = React.useRef(new Map<string, HTMLButtonElement>());
  React.useEffect(() => { const selected = buttons.current.get(value); if (!selected || !container.current) return; const node = container.current; const target = selected.offsetLeft - (node.clientWidth - selected.offsetWidth) / 2; node.scrollTo({ left: target, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }, [value]);
  return <div ref={container} className="mobile-scroll-tabs relative flex w-full gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1.5">{items.map((item) => <button ref={(node) => { if (node) buttons.current.set(item.value, node); else buttons.current.delete(item.value); }} key={item.value} aria-pressed={value === item.value} onClick={() => onValueChange(item.value)} className={cn("relative z-0 min-h-11 shrink-0 snap-center rounded-xl px-4 text-sm font-medium text-muted-foreground transition-colors", value === item.value && "text-foreground")}><span className="relative z-10">{item.label}</span>{value === item.value && <motion.span layoutId="studio-tab-indicator" className="absolute inset-0 -z-0 rounded-xl bg-primary/15" transition={{ type: "spring", stiffness: 420, damping: 34 }}/>}</button>)}</div>;
}
