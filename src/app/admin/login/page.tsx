"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coffee, Moon } from "lucide-react";
import { ADMIN_IDLE_MINUTES } from "@/lib/idle-timeout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export default function AdminLoginPage() {
  const router = useRouter();
  const [idleReason] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("reason") === "idle"
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Login gagal");
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-[var(--radius-lg)] border border-border bg-surface p-6 flex flex-col gap-4"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-fg">
            <Coffee className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-ink">Kopi Senja — Admin</h1>
            <p className="text-sm text-muted">Masuk untuk mengelola pesanan</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="username" className="text-sm font-medium text-on-surface">Username</label>
          <Input
            id="username"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(null); }}
            autoComplete="username"
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-on-surface">Password</label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            autoComplete="current-password"
          />
        </div>

        {idleReason && (
          <p
            className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-surface-2 px-3 py-2 text-sm text-muted"
            role="status"
          >
            <Moon className="h-4 w-4 shrink-0" aria-hidden="true" />
            Sesi berakhir setelah {ADMIN_IDLE_MINUTES} menit tanpa aktivitas & tanpa pesanan masuk — silakan masuk lagi.
          </p>
        )}

        {error && (
          <p className="rounded-[var(--radius-sm)] bg-status-error/10 border border-status-error/30 px-3 py-2 text-sm text-status-error" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={submitting || !username || !password} size="lg">
          {submitting && <Spinner size={16} />}
          {submitting ? "Masuk…" : "Masuk"}
        </Button>

        <p className="text-xs text-muted text-center">
          Demo: <code className="rounded bg-surface-2 px-1.5 py-0.5">admin</code> /{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5">admin123</code>
        </p>
      </form>
    </main>
  );
}