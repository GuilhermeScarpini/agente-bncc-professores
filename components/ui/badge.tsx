import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  default: "bg-primary-soft text-primary",
  secondary: "bg-secondary text-secondary-foreground",
  teacher: "bg-amber-100 text-amber-800",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  destructive: "bg-destructive-soft text-destructive",
} as const;

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof VARIANTS;
}

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold [&_svg]:size-3",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
