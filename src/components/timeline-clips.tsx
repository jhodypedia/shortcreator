"use client";

import { m } from "motion/react";

export function TimelineClips({
  clips,
  accent,
}: {
  clips: Array<{ id: string; number: number; title: string; durationSec: number | null; status: string }>;
  accent: string;
}) {
  return (
    <div className="relative flex h-7 flex-1 items-center gap-1 overflow-hidden rounded-sm bg-[#0b0c0e] px-1">
      {clips.length === 0 && <span className="mono text-[9px] text-muted-foreground">tanpa episode</span>}
      {clips.map((ep, index) => (
        <m.div
          key={ep.id}
          title={`Eps ${ep.number}: ${ep.title}`}
          className="flex h-5 min-w-6 origin-left items-center justify-center overflow-hidden rounded-sm border text-[9px]"
          style={{
            flexGrow: Math.max(1, Math.round((ep.durationSec ?? 30) / 10)),
            flexBasis: 0,
            borderColor: `${accent}66`,
            backgroundColor: ep.status === "done" ? `${accent}33` : `${accent}14`,
          }}
          initial={{ scaleX: 0, opacity: 0.4 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: Math.min(index, 10) * 0.03, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="mono truncate px-0.5 text-foreground/80">{ep.number}</span>
        </m.div>
      ))}
    </div>
  );
}
