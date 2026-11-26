"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-md border border-border bg-card">
        <AlertTriangle className="size-4 text-destructive" />
      </span>
      <div className="space-y-1">
        <h2 className="text-[15px] font-semibold">Terjadi kesalahan</h2>
        <p className="max-w-md text-[12px] text-muted-foreground">
          {error.message || "Halaman gagal dimuat."}
        </p>
      </div>
      <Button onClick={reset}>
        <RefreshCw className="size-3.5" /> Coba Lagi
      </Button>
    </div>
  );
}
