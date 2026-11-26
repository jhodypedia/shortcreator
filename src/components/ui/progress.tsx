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
          "relative h-full rounded-full transition-[width] duration-[var(--studio-motion-slow)]",
          isActive
            ? "bg-[linear-gradient(90deg,var(--primary),#34d399,var(--primary))] bg-[length:200%_100%] animate-[shimmer_1.8s_linear_infinite]"
            : "bg-primary shadow-[0_0_12px_rgb(16_185_129_/_0.35)]",
        )}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
