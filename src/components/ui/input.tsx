import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-[var(--radius-sm)] bg-white border px-3.5 text-base text-ink placeholder:text-muted/70 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary",
        "disabled:cursor-not-allowed disabled:bg-surface-2",
        error
          ? "border-[oklch(0.600_0.180_25)] focus-visible:ring-[oklch(0.600_0.180_25)]"
          : "border-border",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };