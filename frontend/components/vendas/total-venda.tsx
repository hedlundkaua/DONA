import { BagIcon } from "@/components/ui/icons";
import { formatMoeda } from "@/lib/format";

/**
 * Bloco de total do pedido. O total oficial vem do backend; este componente
 * apenas apresenta o valor recebido pela tela.
 */
export function TotalVenda({
  total,
  quantidadeItens,
}: {
  total: string;
  quantidadeItens?: number;
}) {
  return (
    <section className="flex items-center gap-3 rounded-2xl border border-pink-100 bg-pink-50 p-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-pink">
        <BagIcon className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-navy">Total do pedido</p>
        <p className="mt-0.5 text-2xl font-bold leading-none text-plum">
          {formatMoeda(total)}
        </p>
        {typeof quantidadeItens === "number" ? (
          <p className="mt-1 text-xs text-muted">
            {quantidadeItens === 1
              ? "1 item"
              : `${quantidadeItens} itens`}
          </p>
        ) : null}
      </div>
    </section>
  );
}
