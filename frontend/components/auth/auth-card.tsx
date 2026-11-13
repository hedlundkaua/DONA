import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function AuthCard({
  titulo,
  descricao,
  children,
  className,
}: {
  titulo: string;
  descricao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-pink-100 bg-white p-5 shadow-[0_12px_40px_rgba(156,17,85,0.10)] sm:p-6",
        className,
      )}
    >
      <h2 className="text-lg font-semibold text-navy">{titulo}</h2>
      {descricao ? (
        <p className="mt-1 text-sm leading-relaxed text-muted">{descricao}</p>
      ) : null}
      {children}
    </section>
  );
}
