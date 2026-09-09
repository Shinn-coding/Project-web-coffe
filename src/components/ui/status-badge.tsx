import * as React from "react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, STATUS_COLOR, type StatusKey } from "@/lib/format";

/** Status badge — colored dot + label, never color alone (color-blind safe). */
export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const key = status as StatusKey;
  const label = STATUS_LABEL[key] ?? status;
  const color = STATUS_COLOR[key] ?? "var(--muted)";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        className
      )}
      style={{ backgroundColor: color + "1a" }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}