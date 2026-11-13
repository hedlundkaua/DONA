import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageTitle({
  sobretitulo,
  titulo,
  descricao,
  acao,
  className,
}: {
  sobretitulo: string;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5", className)}>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-pink">
        {sobretitulo}
      </p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-navy">
            {titulo}
          </h1>
        </div>
        {acao ? <div className="shrink-0 pt-1">{acao}</div> : null}
      </div>
      {descricao ? (
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{descricao}</p>
      ) : null}
      <div className="mt-3 h-1 w-14 rounded-full bg-pink" aria-hidden="true" />
    </div>
  );
}
