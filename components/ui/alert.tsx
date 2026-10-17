import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  error: { icon: CircleAlert, classes: "border-destructive/25 bg-destructive-soft text-destructive" },
  success: { icon: CircleCheck, classes: "border-success/25 bg-success-soft text-success" },
  warning: { icon: TriangleAlert, classes: "border-warning/25 bg-warning-soft text-warning" },
  info: { icon: Info, classes: "border-primary/20 bg-primary-soft text-primary" },
} as const;

interface AlertProps {
  variant?: keyof typeof VARIANTS;
  title?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function Alert({ variant = "info", title, className, children }: AlertProps) {
  const { icon: Icon, classes } = VARIANTS[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("flex gap-2.5 rounded-lg border px-3 py-2.5 text-sm", classes, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-foreground/85">{children}</div> : null}
      </div>
    </div>
  );
}
