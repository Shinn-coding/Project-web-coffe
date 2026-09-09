"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sheet — modal surface.
 * - `side="bottom"`: bottom sheet on mobile (default)
 * - `side="right"`: right drawer (used for cart on desktop)
 * - `side="center"`: centered dialog (customization modal on md+, admin forms, confirms)
 * Backdrop: rgba(61,47,38,0.4), radius-lg on visible edge, slide 250ms ease-out.
 */
export function Sheet({
  open,
  onOpenChange,
  children,
  side = "bottom",
  className,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: "bottom" | "right" | "center";
  className?: string;
  title?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[var(--z-backdrop)] bg-[rgba(61,47,38,0.4)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        />
        <DialogPrimitive.Content
          aria-label={title}
          className={cn(
            "fixed z-[var(--z-sheet)] flex flex-col bg-white shadow-lg outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:ease-out data-[state=open]:duration-250 data-[state=open]:[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
            side === "bottom" &&
              "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[var(--radius-lg)] data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            side === "right" &&
              "inset-y-0 right-0 w-full max-w-[420px] rounded-l-[var(--radius-lg)] data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
            side === "center" &&
              "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-[480px] rounded-[var(--radius-lg)] data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            className
          )}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Close button — top-right of a sheet */
export function SheetClose({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Close
      aria-label="Tutup"
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 transition-colors cursor-pointer",
        className
      )}
    >
      <X className="h-5 w-5" />
    </DialogPrimitive.Close>
  );
}

export { DialogPrimitive };