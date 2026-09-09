"use client";

import { cn } from "@/lib/utils";
import type { CategoryDto } from "@/lib/types";

export function CategoryTabs({
  categories,
  selected,
  onSelect,
}: {
  categories: CategoryDto[];
  selected: number | null; // null = Semua
  onSelect: (id: number | null) => void;
}) {
  return (
    <nav aria-label="Kategori menu" className="overflow-x-auto scrollbar-none -mx-4 px-4">
      <div className="flex gap-2 py-1 min-w-max">
        <Chip active={selected === null} label="Semua" onClick={() => onSelect(null)} />
        {categories.map((c) => (
          <Chip
            key={c.id}
            active={selected === c.id}
            label={c.name}
            onClick={() => onSelect(c.id)}
          />
        ))}
      </div>
    </nav>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-10 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-150 cursor-pointer",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        active
          ? "bg-primary text-primary-fg"
          : "bg-surface-2 text-on-surface hover:bg-primary/10 border border-transparent"
      )}
    >
      {label}
    </button>
  );
}