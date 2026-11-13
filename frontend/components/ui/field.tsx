import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const inputBase =
  "h-12 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-navy placeholder:text-muted/60 transition-colors focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-muted aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20";

export const textareaBase =
  "min-h-24 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] leading-relaxed text-navy placeholder:text-muted/60 transition-colors focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink/25 disabled:cursor-not-allowed disabled:bg-slate-50 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20";

export const selectBase = cn(inputBase, "appearance-none pr-10");

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-semibold text-navy"
      >
        {label}
        {required ? (
          <span className="ml-0.5 text-pink" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FieldsetLegend({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <legend className="text-sm font-semibold text-navy">{children}</legend>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
