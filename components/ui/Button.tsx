import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT: Record<Variant, string> = {
  primary: "bg-primary-500 text-white hover:bg-primary-600 focus-visible:ring-primary-300",
  secondary: "bg-white text-ink-700 border border-surface-border hover:bg-surface-muted focus-visible:ring-primary-200",
  ghost: "bg-transparent text-ink-700 hover:bg-surface-muted focus-visible:ring-primary-200",
  danger: "bg-status-danger text-white hover:opacity-90 focus-visible:ring-red-200",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          "disabled:opacity-50 disabled:pointer-events-none",
          VARIANT[variant],
          SIZE[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
