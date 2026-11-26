"use client";

import { m } from "motion/react";

export function TimelinePlayhead({ left }: { left: number }) {
  return (
    <m.span
      className="pointer-events-none absolute inset-y-0 w-px bg-primary shadow-[0_0_8px_#10b981]"
      initial={{ left: 0, opacity: 0 }}
      whileInView={{ left: `${left}%`, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden="true"
    />
  );
}
