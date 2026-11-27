import * as React from "react";
import { cn } from "cn";

export function Progress({
  value = 0,
  className,
  isActive = false,
  isComplete = false,
}: {
  value?: number;
  className?: string;
  isActive?: boolean;
  isComplete?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-[var(--studio-raised)] ring-1 ring-white/5",
        className
      )}
    >
      <div
        data-slot="progress-indicator"
        data-complete={isComplete || undefined}
        className={cn(
          "relative h-full origin-left rounded-full transition-transform duration-300 ease-out",
          isActive ? "bg-[linear-gradient(90deg,var(--primary),var(--studio-teal))]" : "bg-primary",
        )}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        style={{ width: "100%", transform: `scaleX(${pct / 100})`, transformOrigin: "left" }}
      />
    </div>
  );
}
