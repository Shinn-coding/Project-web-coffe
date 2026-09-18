import { Coffee, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Coffee className="h-8 w-8" aria-hidden="true" />
      </span>
      <h2 className="text-xl font-bold text-ink">Halaman tidak ditemukan</h2>
      <p className="max-w-sm text-sm text-muted">
        Halaman yang kamu cari tidak ada atau sudah dipindahkan.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primary px-4 py-2 text-sm font-medium text-primary-fg shadow-sm hover:bg-primary-hover transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kembali ke Beranda
      </Link>
    </main>
  );
}
