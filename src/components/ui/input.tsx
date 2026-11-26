import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"
import { Sparkles } from "lucide-react"

type InputProps = React.ComponentProps<"input"> & { aiAction?: () => void; aiLabel?: string; characterCount?: boolean };
function Input({ className, type, aiAction, aiLabel = "Isi dengan AI", characterCount = false, maxLength, value, ...props }: InputProps) {
  const count = typeof value === "string" ? value.length : 0;
  return (
    <span className="relative block w-full">
      <InputPrimitive type={type} data-slot="input" maxLength={maxLength} className={cn("studio-input h-11 w-full min-w-0 rounded-[14px] border border-border bg-[var(--studio-raised)] px-3 py-2 text-sm text-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.025)] outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground/80 focus-visible:border-primary/80 focus-visible:bg-[var(--studio-surface)] focus-visible:ring-2 focus-visible:ring-primary/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive", aiAction && "pr-32", characterCount && maxLength && "pr-20", className)} {...props} value={value}/>
      {aiAction && <button type="button" onClick={aiAction} className="absolute top-1/2 right-1.5 inline-flex min-h-9 -translate-y-1/2 items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 text-[11px] font-semibold text-amber-300 transition-colors hover:bg-amber-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"><Sparkles className="size-3.5"/>{aiLabel}</button>}
      {characterCount && maxLength && <span className="pointer-events-none absolute right-3 bottom-1.5 text-[10px] tabular-nums text-muted-foreground">{count}/{maxLength}</span>}
    </span>
  )
}

export { Input }
