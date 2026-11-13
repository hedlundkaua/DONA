import type { NivelEstoque } from "@/lib/types";
import { cn } from "@/lib/cn";

export function PagamentoBadge({ pago }: { pago: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        pago
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700",
      )}
    >
      {pago ? "Pago" : "A prazo"}
    </span>
  );
}

export function StatusBadge({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        ativo
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-500",
      )}
    >
      {ativo ? "Ativo" : "Inativo"}
    </span>
  );
}

const rotulos: Record<NivelEstoque, string> = {
  normal: "Normal",
  baixo: "Abaixo do mínimo",
  critico: "Esgotado",
};

const estilos: Record<NivelEstoque, string> = {
  normal: "border-emerald-200 bg-emerald-50 text-emerald-700",
  baixo: "border-amber-200 bg-amber-50 text-amber-700",
  critico: "border-red-200 bg-red-50 text-red-700",
};

export function StockBadge({
  nivel,
  className,
}: {
  nivel: NivelEstoque;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold",
        estilos[nivel],
        className,
      )}
    >
      {rotulos[nivel]}
    </span>
  );
}

export function TypeBadge({ tipo }: { tipo: "ENTRADA" | "SAIDA" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        tipo === "ENTRADA"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700",
      )}
    >
      {tipo === "ENTRADA" ? "Entrada" : "Saída"}
    </span>
  );
}

export function AdjustmentBadge({ tipo }: { tipo: "AUMENTO" | "REDUCAO" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        tipo === "AUMENTO"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700",
      )}
    >
      {tipo === "AUMENTO" ? "Aumento" : "Redução"}
    </span>
  );
}
