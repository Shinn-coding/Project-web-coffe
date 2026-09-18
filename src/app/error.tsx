"use client";

import { Coffee, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Coffee className="h-8 w-8" aria-hidden="true" />
      </span>
      <h2 className="text-xl font-bold text-ink">Terjadi kesalahan</h2>
      <p className="max-w-sm text-sm text-muted">
        Waduh, ada yang tidak beres di sisi kami. Silakan coba muat ulang halaman ini.
      </p>
      {error.digest && (
        <p className="text-xs text-muted/70">Kode error: {error.digest}</p>
      )}
      <Button onClick={() => reset()}>
        <RefreshCw className="h-4 w-4" aria-hidden="true" /> Muat Ulang
      </Button>
    </main>
  );
}
