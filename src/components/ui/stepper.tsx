"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Quantity stepper — 44px touch targets, min 1, max 9 */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 9,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-surface-2 p-1",
        className
      )}
    >
      <button
        type="button"
        aria-label="Kurangi"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-surface disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-[2ch] text-center text-base font-semibold" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label="Tambah"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-surface disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}