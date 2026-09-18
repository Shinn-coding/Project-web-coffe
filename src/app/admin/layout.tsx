"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ReceiptText,
  UtensilsCrossed,
  BarChart3,
  QrCode,
  KeyRound,
  Settings2,
  LogOut,
  Coffee,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { IdleLogout } from "@/components/admin/idle-logout";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Pesanan", icon: ReceiptText },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/admin/qr", label: "QR Meja", icon: QrCode },
  { href: "/admin/reports", label: "Laporan", icon: BarChart3 },
  { href: "/admin/change-password", label: "Ganti Password", icon: KeyRound },
  { href: "/admin/settings", label: "Pengaturan", icon: Settings2 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // /admin/login renders the form itself — skip the session redirect
    if (pathname.startsWith("/admin/login")) {
      setChecking(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/session");
        if (alive) {
          if (!res.ok) router.replace("/admin/login");
          else setChecking(false);
        }
      } catch {
        if (alive) router.replace("/admin/login");
      }
    })();
    return () => {
      alive = false;
    };
  }, [router, pathname]);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <Spinner size={24} className="text-primary" />
        <span className="sr-only">Memeriksa sesi</span>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Auto-logout idle 60 menit — reset juga saat order baru masuk via SSE */}
      <IdleLogout />

      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 h-14">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-fg">
              <Coffee className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-base font-bold text-ink">Kopi Senja Admin</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-ink transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Keluar
          </button>
        </div>
      </header>

      {/* Nav tabs */}
      <nav aria-label="Navigasi admin" className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                active ? "bg-primary text-primary-fg" : "text-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>

      <main className="mx-auto max-w-5xl px-4 pb-10">{children}</main>
    </div>
  );
}