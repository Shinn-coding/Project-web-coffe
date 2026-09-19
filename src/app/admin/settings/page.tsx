"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, ImageOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToasts, ToastHost } from "@/components/ui/toast";

/** "HH:mm" → minutes since midnight */
function toMinutes(hhmm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** "08:00" → "08.00" for display */
function fmt(hhmm: string): string {
  return hhmm.replace(":", ".");
}

interface Hours {
  openHour: string | null;
  closeHour: string | null;
}

interface Identity {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  logoUrl: string;
}

export default function AdminSettingsPage() {
  const pushToast = useToasts((s) => s.push);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openHour, setOpenHour] = useState(""); // "" = off
  const [closeHour, setCloseHour] = useState("");
  const [identity, setIdentity] = useState<Identity>({ shopName: "", shopAddress: "", shopPhone: "", logoUrl: "" });
  const [error, setError] = useState("");

  // Live preview — ticks every 30s so "isOpenNow" stays accurate without a reload
  const [nowMin, setNowMin] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Gagal memuat pengaturan");
        const data = json.data as (Hours & { identity: Partial<Identity> }) | null;
        if (!alive) return;
        if (data) {
          setOpenHour(data.openHour ?? "");
          setCloseHour(data.closeHour ?? "");
          setIdentity({
            shopName: data.identity?.shopName ?? "",
            shopAddress: data.identity?.shopAddress ?? "",
            shopPhone: data.identity?.shopPhone ?? "",
            logoUrl: data.identity?.logoUrl ?? "",
          });
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Gagal memuat pengaturan");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const bannerOn = openHour !== "" && closeHour !== "";
  const isOpenNow = (() => {
    if (!bannerOn) return null;
    const open = toMinutes(openHour);
    const close = toMinutes(closeHour);
    if (open === null || close === null) return null;
    // Supports overnight ranges too (e.g. 20:00 → 02:00)
    return open <= close ? nowMin >= open && nowMin < close : nowMin >= open || nowMin < close;
  })();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if ((openHour === "") !== (closeHour === "")) {
      setError("Isi kedua jam, atau kosongkan keduanya untuk menonaktifkan banner");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openHour: openHour === "" ? null : openHour,
          closeHour: closeHour === "" ? null : closeHour,
          identity: {
            shopName: identity.shopName.trim() || null,
            shopAddress: identity.shopAddress.trim() || null,
            shopPhone: identity.shopPhone.trim() || null,
            logoUrl: identity.logoUrl.trim() || null,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal menyimpan pengaturan");
      const saved = json.data?.identity as Partial<Identity> | undefined;
      if (saved) {
        // Server memotong/cleansing nilai — sync balik state dari jawaban server
        setIdentity({
          shopName: saved.shopName ?? "",
          shopAddress: saved.shopAddress ?? "",
          shopPhone: saved.shopPhone ?? "",
          logoUrl: saved.logoUrl ?? "",
        });
      }
      pushToast("Pengaturan disimpan", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan pengaturan";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold">Pengaturan</h1>
      <p className="mt-1 text-sm text-muted">Identitas toko &amp; jam operasional.</p>

      <div className="mt-6 max-w-xl rounded-lg border border-border bg-surface p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner size={24} className="text-primary" />
            <span className="sr-only">Memuat pengaturan</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {/* ─── Identitas toko ─── */}
            <fieldset className="space-y-3" disabled={saving}>
              <legend className="text-sm font-medium">Identitas Toko</legend>
              <p className="text-xs text-muted">
                Tampil di header struk customer. Kosongkan untuk memakai nilai default.
              </p>

              <LogoUploader
                logoUrl={identity.logoUrl}
                shopName={identity.shopName}
                onChange={(logoUrl) => setIdentity((prev) => ({ ...prev, logoUrl }))}
              />

              <div className="space-y-1.5">
                <label htmlFor="shopName" className="text-sm font-medium">
                  Nama Toko
                </label>
                <Input
                  id="shopName"
                  value={identity.shopName}
                  maxLength={80}
                  onChange={(e) => setIdentity((prev) => ({ ...prev, shopName: e.target.value }))}
                  placeholder="Kopi Senja"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="shopAddress" className="text-sm font-medium">
                  Alamat
                </label>
                <Input
                  id="shopAddress"
                  value={identity.shopAddress}
                  maxLength={200}
                  onChange={(e) => setIdentity((prev) => ({ ...prev, shopAddress: e.target.value }))}
                  placeholder="Jl. Raya Kopi No. 12, Bandung"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="shopPhone" className="text-sm font-medium">
                  Telp / WhatsApp
                </label>
                <Input
                  id="shopPhone"
                  value={identity.shopPhone}
                  maxLength={40}
                  inputMode="tel"
                  onChange={(e) => setIdentity((prev) => ({ ...prev, shopPhone: e.target.value }))}
                  placeholder="0812-3456-7890"
                />
              </div>
            </fieldset>

            <p className="border-t border-border" />

            {/* ─── Status buka/tutup ─── */}
            <fieldset className="space-y-2" disabled={saving}>
              <legend className="text-sm font-medium">Status saat ini (pratinjau langsung)</legend>
              <div className="flex flex-wrap items-center gap-2">
                {isOpenNow === null ? (
                  <span className="inline-flex items-center rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted">
                    Banner nonaktif
                  </span>
                ) : isOpenNow ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700">
                    Buka — {fmt(openHour)}–{fmt(closeHour)}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-700">
                    Sedang tutup — buka pukul {fmt(openHour)}
                  </span>
                )}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="openHour" className="text-sm font-medium">
                  Jam Buka
                </label>
                <Input
                  id="openHour"
                  name="openHour"
                  type="time"
                  value={openHour}
                  onChange={(e) => setOpenHour(e.target.value)}
                  placeholder="08:00"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="closeHour" className="text-sm font-medium">
                  Jam Tutup
                </label>
                <Input
                  id="closeHour"
                  name="closeHour"
                  type="time"
                  value={closeHour}
                  onChange={(e) => setCloseHour(e.target.value)}
                  placeholder="22:00"
                />
              </div>
            </div>

            <p className="text-xs text-muted">Kosongkan kedua jam untuk menonaktifkan banner.</p>

            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}

            <Button type="submit" disabled={saving}>
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Menyimpan...
                </span>
              ) : (
                "Simpan"
              )}
            </Button>
          </form>
        )}
      </div>

      <ToastHost />
    </div>
  );
}

/** Upload logo → /api/admin/upload (endpoint sama dengan foto menu) → URL disimpan di state. */
function LogoUploader({
  logoUrl,
  shopName,
  onChange,
}: {
  logoUrl: string;
  shopName: string;
  onChange: (url: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // ponytail: legacy URLs can 404 (pre-Blob uploads) — show a fallback instead
  // of a broken image icon; reset whenever the URL changes.
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [logoUrl]);

  async function handleFile(file: File) {
    setUploadError(null);
    if (!file.type.startsWith("image/")) {
      setUploadError("File harus berupa gambar (JPG/PNG utama).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Ukuran file maksimal 5 MB");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal mengunggah logo");
      onChange(json.url as string);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Gagal mengunggah logo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium">Logo (opsional)</span>
      <p className="text-xs text-muted">
        Tampil di atas nama toko pada struk. Utamakan JPG/PNG latar putih agar terbaca di printer
        thermal hitam-putih.
      </p>

      <div className="flex items-center gap-3">
        <div className="inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border border-border bg-white">
          {logoUrl && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview sederhana; logo bisa eksternal, fixed-size img cukup
            <img
              src={logoUrl}
              alt="Pratinjau logo"
              className="h-full w-full object-contain"
              onError={() => setBroken(true)}
            />
          ) : (
            <ImageOff className="h-5 w-5 text-muted" aria-hidden="true" />
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Spinner size={16} /> : <Upload className="h-4 w-4" aria-hidden="true" />}
            {uploading ? "Mengunggah…" : "Unggah Logo"}
          </Button>
          {logoUrl && (
            <Button type="button" variant="ghost" onClick={() => onChange("")} disabled={uploading}>
              Hapus logo
            </Button>
          )}
        </div>
      </div>

      <Input
        value={logoUrl}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://… (URL gambar atau Vercel Blob)"
        aria-label="URL logo"
      />

      {uploadError && (
        <p className="text-xs text-status-error" role="alert">
          {uploadError}
        </p>
      )}
      {logoUrl && !uploading && !uploadError && (
        <p className="text-xs text-muted">Logo &ldquo;{shopName || "toko"}&rdquo; siap dicetak di struk berikutnya.</p>
      )}
    </div>
  );
}
