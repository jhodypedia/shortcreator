"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, BookOpen, Boxes, Film, Layers, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FloatingTabList } from "@/components/ui/studio-primitives";

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
    { href: `/series/${seriesId}`, label: "Panduan", icon: BookOpen, exact: true },
    { href: `/series/${seriesId}/episodes`, label: "Episode", icon: Film },
    { href: `/series/${seriesId}/characters`, label: "Karakter", icon: Users },
    { href: `/series/${seriesId}/sets`, label: "Set", icon: Boxes },
    { href: `/series/${seriesId}/bulk`, label: "Massal", icon: Layers },
  ];

  return (
    <div className="studio-card sticky top-2 z-30 overflow-hidden">
      <div className="h-0.5 w-full" style={{ backgroundColor: accentColor }} aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <Link
          href="/series"
          className="focus-ring inline-flex size-11 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          aria-label="Kembali ke daftar series"
        >
          <ArrowLeft className="size-3.5" />
        </Link>
        <span className="text-base leading-none" aria-hidden="true">{emoji}</span>
        <h1 className="min-w-0 truncate !text-lg !font-semibold">{seriesName}</h1>
        <Badge variant="outline" style={{ borderColor: `${accentColor}66`, color: accentColor }}>
          Bible v{bibleVersion}
        </Badge>
      </div>

      <div className="sticky top-0 z-30 border-t border-border bg-card/95 p-2 backdrop-blur-xl"><FloatingTabList items={tabs.map((tab) => ({ value: tab.label, label: tab.label }))} value={tabs.find((tab) => tab.exact ? pathname === tab.href : pathname.startsWith(tab.href))?.label ?? "Ringkasan"} onValueChange={(label) => { const tab = tabs.find((item) => item.label === label); if (tab) window.location.href = tab.href; }}/></div>
    </div>
  );
}
