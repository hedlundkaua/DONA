import Link from "next/link";
import { PagamentoBadge } from "@/components/ui/badges";
import { Card } from "@/components/ui/card";
import { ChevronRightIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatData, formatMoeda } from "@/lib/format";

export interface VendaResumo {
  id: number;
  clienteNome: string;
  dataPedido: string;
  total: string;
  pago: boolean;
  vencimento?: string | null;
}

/**
 * Card de venda usado no histórico e no painel. Recebe os dados já carregados
 * e não faz chamadas de API.
 */
export function VendaCard({
  venda,
  href,
  testId,
  className,
}: {
  venda: VendaResumo;
  href?: string;
  testId?: string;
  className?: string;
}) {
  const corpo = (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-navy">
            {venda.clienteNome}
          </p>
          <PagamentoBadge pago={venda.pago} />
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {formatData(venda.dataPedido)}
          {!venda.pago && venda.vencimento
            ? ` · vence ${formatData(venda.vencimento)}`
            : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-plum">{formatMoeda(venda.total)}</p>
      </div>
      {href ? <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" /> : null}
    </div>
  );

  return (
    <Card className={cn("p-0", className)}>
      {href ? (
        <Link
          href={href}
          data-testid={testId}
          className="block rounded-2xl px-4 py-3.5 transition-colors hover:bg-pink-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pink/40"
        >
          {corpo}
        </Link>
      ) : (
        <div data-testid={testId} className="px-4 py-3.5">{corpo}</div>
      )}
    </Card>
  );
}
