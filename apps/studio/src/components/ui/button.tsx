import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/cn";

type Variant = "default" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md" | "icon";

const VARIANTS: Record<Variant, string> = {
  default: "bg-emerald-600 text-white hover:bg-emerald-500",
  secondary: "bg-neutral-800 text-neutral-100 hover:bg-neutral-700",
  ghost: "bg-transparent text-neutral-300 hover:bg-neutral-800",
  outline: "border border-neutral-700 bg-transparent text-neutral-200 hover:bg-neutral-800",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  icon: "h-8 w-8 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}

/** Minimal shadcn-style button. */
export const Button = ({
  variant = "default",
  size = "md",
  className,
  ...props
}: ButtonProps): ReactNode => (
  <button
    className={cn(
      "inline-flex select-none items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:pointer-events-none disabled:opacity-50",
      VARIANTS[variant],
      SIZES[size],
      className,
    )}
    {...props}
  />
);
