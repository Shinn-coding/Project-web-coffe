"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToasts, ToastHost } from "@/components/ui/toast";

export default function ChangePasswordPage() {
  const pushToast = useToasts((s) => s.push);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const errors: typeof fieldErrors = {};
    if (!currentPassword) errors.currentPassword = "Password lama wajib diisi";
    if (!newPassword) errors.newPassword = "Password baru wajib diisi";
    else if (newPassword.length < 8)
      errors.newPassword = "Password baru minimal 8 karakter";
    if (confirmPassword !== newPassword)
      errors.confirmPassword = "Konfirmasi password tidak sesuai";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Gagal mengubah password");
      }

      pushToast("Password berhasil diubah", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal mengubah password";
      setError(message);
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-lg font-semibold">Ganti Password</h1>
      <p className="mt-1 text-sm text-muted">
        Ubah password akun admin Anda.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="currentPassword" className="text-sm font-medium">
            Password Lama
          </label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            error={!!fieldErrors.currentPassword}
            placeholder="Masukkan password lama"
          />
          {fieldErrors.currentPassword && (
            <p role="alert" className="text-sm text-red-600">
              {fieldErrors.currentPassword}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="newPassword" className="text-sm font-medium">
            Password Baru
          </label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={!!fieldErrors.newPassword}
            placeholder="Minimal 8 karakter"
          />
          {fieldErrors.newPassword && (
            <p role="alert" className="text-sm text-red-600">
              {fieldErrors.newPassword}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            Konfirmasi Password Baru
          </label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={!!fieldErrors.confirmPassword}
            placeholder="Ulangi password baru"
          />
          {fieldErrors.confirmPassword && (
            <p role="alert" className="text-sm text-red-600">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> Menyimpan...
            </span>
          ) : (
            "Simpan Password"
          )}
        </Button>
      </form>

      <ToastHost />
    </div>
  );
}