import { Badge } from "@/components/ui/badge";

const STATUS_MAP: Record<
  string,
  { label: string; className: string }
> = {
  draft: { label: "Draf", className: "" },
  script: { label: "Naskah", className: "" },
  timing: { label: "Penyelarasan", className: "" },
  ready: { label: "Siap Render", className: "" },
  queued: { label: "Antre", className: "" },
  rendering: { label: "Merender", className: "" },
  review: { label: "Perlu Review", className: "" },
  done: { label: "Selesai", className: "" },
  failed: { label: "Gagal", className: "" },
  cancelled: { label: "Dibatalkan", className: "" },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? {
    label: status,
    className: "bg-secondary text-secondary-foreground",
  };
  return (
    <Badge variant="outline" className={`status-item status-${status} ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}
