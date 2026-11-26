"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "cn";

export function Checkbox({
  checked = false,
  onCheckedChange,
  disabled,
  className,
  id,
}: {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-sm border border-input bg-[#0b0c0e] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        checked && "border-primary bg-primary text-primary-foreground",
        className
      )}
    >
      {checked && <Check className="size-3 stroke-[3]" />}
    </button>
  );
}
