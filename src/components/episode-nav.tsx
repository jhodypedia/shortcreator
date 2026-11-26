"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  CheckSquare,
  FileText,
  Mic,
  Play,
  Share2,
} from "lucide-react";
import { cn } from "cn";
import { StatusBadge } from "@/components/status-badge";

export function EpisodeHeaderNav({
  episodeId,
  seriesId,
  seriesName,
  episodeNumber,
  episodeTitle,
  status,
  accentColor = "#10b981",
}: {
  episodeId: string;
  seriesId: string;
  seriesName: string;
  episodeNumber: number;
  episodeTitle: string;
  status: string;
  accentColor?: string;
}) {
  const pathname = usePathname();

  const steps = [
    { href: `/episodes/${episodeId}`, label: "Naskah", icon: FileText, exact: true },
    { href: `/episodes/${episodeId}/voice`, label: "Suara", icon: Mic },
    { href: `/episodes/${episodeId}/shots`, label: "Bidikan", icon: Camera },
    { href: `/episodes/${episodeId}/preview`, label: "Pratinjau", icon: Play },
    { href: `/episodes/${episodeId}/review`, label: "Tinjauan", icon: CheckSquare },
    { href: `/episodes/${episodeId}/publish`, label: "Publikasi", icon: Share2 },
  ];

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-card">
      <div className="h-0.5 w-full" style={{ backgroundColor: accentColor }} aria-hidden="true" />
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/series/${seriesId}/episodes`}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-[#46505a] hover:text-foreground"
            aria-label="Kembali ke daftar episode"
          >
            <ArrowLeft className="size-3.5" />
          </Link>
          <div className="min-w-0">
            <p className="mono truncate text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{seriesName}</p>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <h1 className="truncate text-[13px] font-semibold">
                Eps {episodeNumber}: {episodeTitle}
              </h1>
              <StatusBadge status={status} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full min-w-0 gap-0.5 overflow-x-auto overscroll-x-contain border-t border-border px-1.5 [scrollbar-width:thin]">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const active = step.exact
            ? pathname === step.href
            : pathname.startsWith(step.href);
          return (
            <Link
              key={step.href}
              href={step.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex min-h-9 shrink-0 items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="mono text-[9px] text-muted-foreground">{index + 1}</span>
              <Icon className="size-3.5" />
              <span>{step.label}</span>
              {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-sm bg-primary" aria-hidden="true" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
