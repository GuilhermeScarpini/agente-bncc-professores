import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
  outline: "border border-border bg-card text-foreground hover:bg-accent",
  ghost: "text-foreground hover:bg-accent",
  soft: "bg-primary-soft text-primary hover:bg-primary-soft/70",
  destructive: "bg-destructive text-white shadow-sm hover:bg-destructive/90",
  "destructive-ghost": "text-destructive hover:bg-destructive-soft",
} as const;

const SIZES = {
  sm: "h-8 gap-1.5 px-3 text-sm",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-11 gap-2 px-5 text-base",
  icon: "size-10",
  "icon-sm": "size-8",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

interface VariantOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** Classes do botão — também usadas em <Link> que deve parecer um botão. */
export function buttonVariants({ variant = "primary", size = "md", className }: VariantOptions = {}): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-semibold transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, Omit<VariantOptions, "className"> {
  /** Mostra um indicador de carregamento e desabilita o botão. */
  loading?: boolean;
}

export function Button({
  variant,
  size,
  loading = false,
  className,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const iconOnly = size === "icon" || size === "icon-sm";
  return (
    <button
      type={type}
      className={buttonVariants({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
      {loading && iconOnly ? null : children}
    </button>
  );
}
