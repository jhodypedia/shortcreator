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
        "relative h-1.5 w-full overflow-hidden rounded-sm bg-[#262a30]",
        className
      )}
    >
      <div
        data-slot="progress-indicator"
        data-complete={isComplete || undefined}
        className={cn(
          "relative h-full rounded-sm transition-[width] duration-300",
          isActive
            ? "bg-[linear-gradient(90deg,var(--primary),#34d399,var(--primary))] bg-[length:200%_100%] animate-[shimmer_1.8s_linear_infinite]"
            : "bg-primary",
          !isActive && "after:absolute after:inset-0 after:bg-[repeating-linear-gradient(90deg,transparent_0_10px,#131518_10px_12px)]"
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
