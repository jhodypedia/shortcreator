"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, BookOpen, Boxes, Film, Layers, Users } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";

export function SeriesHeaderNav({
  seriesId,
  seriesName,
  bibleVersion,
  accentColor = "#10b981",
  emoji = "🎬",
}: {
  seriesId: string;
  seriesName: string;
  bibleVersion: number;
  accentColor?: string;
  emoji?: string;
}) {
  const pathname = usePathname();
  const tabs = [
    { href: `/series/${seriesId}`, label: "Series Bible", icon: BookOpen, exact: true },
    { href: `/series/${seriesId}/episodes`, label: "Episode", icon: Film },
    { href: `/series/${seriesId}/characters`, label: "Karakter 3D", icon: Users },
    { href: `/series/${seriesId}/sets`, label: "Set 3D", icon: Boxes },
    { href: `/series/${seriesId}/bulk`, label: "Massal", icon: Layers },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="h-0.5 w-full" style={{ backgroundColor: accentColor }} aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <Link
          href="/series"
          className="inline-flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-[#46505a] hover:text-foreground"
          aria-label="Kembali ke daftar series"
        >
          <ArrowLeft className="size-3.5" />
        </Link>
        <span className="text-base leading-none" aria-hidden="true">{emoji}</span>
        <h1 className="min-w-0 truncate text-[15px] font-semibold">{seriesName}</h1>
        <Badge variant="outline" style={{ borderColor: `${accentColor}66`, color: accentColor }}>
          Bible v{bibleVersion}
        </Badge>
      </div>

      <div className="flex gap-1 overflow-x-auto border-t border-border px-1.5 [scrollbar-width:thin]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex shrink-0 items-center gap-1.5 px-2.5 py-2 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
              {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-sm bg-primary" aria-hidden="true" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
