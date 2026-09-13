"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2, ImageOff } from "lucide-react";
import { OptionGroupBuilder, validateGroups, groupsToOptions, optionsToGroups } from "@/components/admin/option-group-builder";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { MenuItemImage } from "@/components/ui/menu-item-image";
import { useToasts, ToastHost } from "@/components/ui/toast";
import { formatRupiah } from "@/lib/format";
import type { MenuItemDto } from "@/lib/types";
import type { GroupModel } from "@/lib/option-groups";


export default function AdminMenuPage() {
  const [items, setItems] = useState<MenuItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MenuItemDto | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const pushToast = useToasts((s) => s.push);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/menu");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal memuat menu");
      setItems(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat menu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleAvailable(item: MenuItemDto) {
    setTogglingId(item.id);
    try {
      const res = await fetch(`/api/admin/menu/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !item.available }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal mengubah ketersediaan");
      setItems((prev) => prev.map((p) => (p.id === item.id ? json.data : p)));
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Gagal mengubah ketersediaan");
    } finally {
      setTogglingId(null);
    }
  }

  async function remove(item: MenuItemDto) {
    if (!confirm(`Hapus "${item.name}"?`)) return;
    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/admin/menu/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Gagal menghapus");
      }
      setItems((prev) => prev.filter((p) => p.id !== item.id));
      pushToast("Menu dihapus");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Gagal menghapus");
    } finally {
      setDeletingId(null);
    }
  }

  const categories = useMemo(
    () =>
      Array.from(new Map(items.map((i) => [i.categoryId, i.category])).entries()).map(([id, cat]) => ({ id, name: cat.name })),
    [items]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Menu</h1>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Tambah
        </Button>
      </div>

      {error && (
        <p className="rounded-[var(--radius-sm)] bg-status-error/10 border border-status-error/30 px-3 py-2 text-sm text-status-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size={24} className="text-primary" />
          <span className="sr-only">Memuat menu</span>
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
          Belum ada menu. Klik “Tambah” untuk membuat menu pertama.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border bg-surface">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              {item.imageUrl ? (
                <span className="relative inline-flex h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius-sm)]">
                  <MenuItemImage src={item.imageUrl} alt="" />
                </span>
              ) : (
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-surface-2 text-muted">
                  <ImageOff className="h-5 w-5" aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className={`font-medium text-ink truncate ${!item.available ? "line-through text-muted" : ""}`}>
                  {item.name}
                </p>
                <p className="text-xs text-muted">
                  {item.category.name} · {formatRupiah(item.price)}
                </p>
              </div>
              <Switch
                checked={item.available}
                onCheckedChange={() => toggleAvailable(item)}
                disabled={togglingId === item.id}
                aria-label={`Ubah ketersediaan ${item.name}`}
              />
              <Button variant="ghost" size="sm" onClick={() => { setEditing(item); setShowForm(true); }} aria-label={`Edit ${item.name}`}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-status-error hover:text-status-error"
                onClick={() => remove(item)}
                disabled={deletingId === item.id}
                aria-label={`Hapus ${item.name}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <MenuForm
          key={editing?.id ?? "new"}
          initial={editing}
          categories={categories}
          onClose={() => setShowForm(false)}
          onSaved={(saved) => {
            setItems((prev) => {
              const exists = prev.some((p) => p.id === saved.id);
              return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev];
            });
            setShowForm(false);
            pushToast(editing ? "Menu diperbarui" : "Menu ditambahkan");
          }}
        />
      )}

      <ToastHost />
    </div>
  );
}

function MenuForm({
  initial,
  categories,
  onClose,
  onSaved,
}: {
  initial: MenuItemDto | null;
  categories: { id: number; name: string }[];
  onClose: () => void;
  onSaved: (item: MenuItemDto) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? 0);
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [available, setAvailable] = useState(initial?.available ?? true);
  // Stored JSON parsed once into editable groups; submitted back via groupsToOptions
  const [groups, setGroups] = useState<GroupModel[]>(() =>
    optionsToGroups(initial?.customizationOptions ?? undefined)
  );
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    const priceNum = Number(price);
    if (!name.trim() || !categoryId || !Number.isFinite(priceNum) || priceNum < 0) {
      setErrMsg("Nama, kategori, dan harga wajib diisi");
      return;
    }
    const check = validateGroups(groups);
    if (!check.ok) {
      setErrMsg(check.error ?? "Grup opsi tidak valid");
      return;
    }
    const options = JSON.stringify(groupsToOptions(groups));
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        categoryId,
        price: priceNum,
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        available,
        customizationOptions: options,
      };
      const res = await fetch(initial ? `/api/admin/menu/${initial.id}` : "/api/admin/menu", {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal menyimpan");
      onSaved(json.data);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Gagal menyimpan");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)] bg-surface p-5 flex flex-col gap-3.5"
      >
        <h2 className="text-lg font-bold text-ink">{initial ? `Edit ${initial.name}` : "Tambah Menu"}</h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="m-name" className="text-sm font-medium text-on-surface">Nama</label>
          <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="m-cat" className="text-sm font-medium text-on-surface">Kategori</label>
            <select
              id="m-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="h-11 rounded-[var(--radius-sm)] border border-border bg-bg px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="m-price" className="text-sm font-medium text-on-surface">Harga (Rp)</label>
            <Input
              id="m-price"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="25000"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="m-desc" className="text-sm font-medium text-on-surface">Deskripsi (opsional)</label>
          <Input id="m-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="m-img" className="text-sm font-medium text-on-surface">Gambar URL (opsional)</label>
          <Input id="m-img" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-on-surface">Opsi Tambahan (opsional)</span>
          <p className="text-xs text-muted">Buat grup pilihan seperti Ukuran, Level Gula, atau Topping. Harga tambahan boleh 0.</p>
          <OptionGroupBuilder value={groups} onChange={setGroups} />
        </div>

        <label className="flex items-center justify-between rounded-[var(--radius-sm)] bg-bg px-3 py-2.5">
          <span className="text-sm font-medium text-on-surface">Tersedia</span>
          <Switch checked={available} onCheckedChange={setAvailable} aria-label="Tersedia" />
        </label>

        {errMsg && (
          <p className="rounded-[var(--radius-sm)] bg-status-error/10 border border-status-error/30 px-3 py-2 text-sm text-status-error" role="alert">
            {errMsg}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Batal
          </Button>
          <Button type="submit" disabled={saving} className="flex-1">
            {saving && <Spinner size={16} />}
            Simpan
          </Button>
        </div>
      </form>
    </div>
  );
}