import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-line bg-white p-4 shadow-[0_6px_24px_rgba(16,35,92,0.05)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn("text-base font-semibold text-navy", className)}>
      {children}
    </h2>
  );
}

export function HeroCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-pink-100 bg-gradient-to-br from-pink-100 via-pink-50 to-white p-4",
        className,
      )}
    >
      {children}
    </section>
  );
}
