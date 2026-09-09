"use client";

import { create } from "zustand";
import { CheckCircle2, AlertCircle } from "lucide-react";

export interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

interface ToastStore {
  toasts: Toast[];
  push: (message: string, type?: "success" | "error") => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (message, type = "success") => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    // error toasts persist, success auto-dismiss after 3s
    if (type === "success") {
      setTimeout(() => get().dismiss(id), 3000);
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function ToastHost() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[var(--z-toast)] flex flex-col items-center gap-2 sm:left-auto sm:right-4 sm:translate-x-0 sm:items-end">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="flex items-center gap-2 rounded-[var(--radius-md)] bg-ink text-white px-4 py-3 text-sm shadow-lg animate-in fade-in-0 slide-in-from-bottom-2"
        >
          {t.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-accent" />
          ) : (
            <AlertCircle className="h-4 w-4 text-[oklch(0.720_0.150_25)]" />
          )}
          {t.message}
          <button
            aria-label="Tutup"
            onClick={() => dismiss(t.id)}
            className="ml-1 opacity-70 hover:opacity-100 cursor-pointer"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}