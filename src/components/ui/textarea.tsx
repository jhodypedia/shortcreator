import * as React from "react"
import { cn } from "cn"
import { Sparkles } from "lucide-react"

type TextareaProps = React.ComponentProps<"textarea"> & { aiAction?: () => void; aiLabel?: string; characterCount?: boolean };
function Textarea({ className, aiAction, aiLabel = "Isi dengan AI", characterCount = false, maxLength, value, ...props }: TextareaProps) {
  const count = typeof value === "string" ? value.length : 0;
  return (
    <span className="relative block w-full">
      <textarea data-slot="textarea" maxLength={maxLength} value={value} className={cn("studio-input flex field-sizing-content min-h-24 w-full rounded-[14px] border border-border bg-[var(--studio-raised)] px-3 py-3 text-sm text-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.025)] transition-[border-color,box-shadow,background-color] outline-none placeholder:text-muted-foreground/80 focus-visible:border-primary/80 focus-visible:bg-[var(--studio-surface)] focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive", aiAction && "pb-12", characterCount && maxLength && "pb-7", className)} {...props}/>
      {aiAction && <button type="button" onClick={aiAction} className="absolute right-2 bottom-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 text-[11px] font-semibold text-amber-300 transition-colors hover:bg-amber-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"><Sparkles className="size-3.5"/>{aiLabel}</button>}
      {characterCount && maxLength && <span className="pointer-events-none absolute right-3 bottom-2 text-[10px] tabular-nums text-muted-foreground">{count}/{maxLength}</span>}
    </span>
  )
}

export { Textarea }
