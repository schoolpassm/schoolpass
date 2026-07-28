import { InputHTMLAttributes, SelectHTMLAttributes, forwardRef, LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-surface-border bg-white px-3 text-sm text-ink-900",
        "placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-surface-border bg-white px-3 text-sm text-ink-900",
        "focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400",
        className
      )}
      {...props}
    />
  )
);
Select.displayName = "Select";

export function FieldLabel({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-xs font-medium text-ink-500", className)} {...props} />;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}
