"use client";

import * as React from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface MenuItemImageProps {
  src: string | null;
  alt: string;
  className?: string;
}

/**
 * Menu item image with graceful fallback for missing/broken URLs.
 * Uses next/image `fill` so it must be rendered inside a positioned, sized parent.
 */
export function MenuItemImage({ src, alt, className }: MenuItemImageProps) {
  const [broken, setBroken] = React.useState(false);

  if (!src || broken) {
    return (
      <span
        className={cn(
          "inline-flex h-full w-full items-center justify-center bg-surface-2 text-muted",
          className
        )}
        aria-hidden="true"
      >
        <ImageOff className="h-5 w-5" />
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 640px) 50vw, 25vw"
      className={cn("object-cover", className)}
      onError={() => setBroken(true)}
    />
  );
}
