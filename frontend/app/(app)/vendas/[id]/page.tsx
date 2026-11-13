import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PagamentoBadge } from "@/components/ui/badges";
import { ChartIcon } from "@/components/ui/icons";
import { PageTitle } from "@/components/ui/page-title";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { TotalVenda } from "@/components/vendas/total-venda";
import { backendFetch } from "@/lib/api";
import {
  formatData,
  formatDataHora,
  formatMoeda,
  formatQuantidade,
} from "@/lib/format";
import type { Venda } from "@/lib/types";

export const metadata: Metadata = { title: "Detalhe da venda" };
export const dynamic = "force-dynamic";

export default async function DetalheVendaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!/^\d+$/.test(id)) {
    return (
      <>
        <PageTitle
          sobretitulo="Vendas / Detalhe"
          titulo="Venda inválida"
          descricao="O identificador informado não é válido."
        />
        <EmptyState
          titulo="Venda não encontrada"
          descricao="Volte ao histórico e escolha uma venda."
          icone={<ChartIcon className="h-6 w-6" />}
          acao={
            <Link
              href="/vendas"
              className="inline-flex h-11 items-center justify-center rounded-full bg-plum px-5 text-sm font-semibold text-white"
            >
              Ver vendas
            </Link>
          }
        />
      </>
    );
  }

  const vendaRes = await backendFetch<Venda>(`/api/vendas/${id}`);

  if (!vendaRes.ok) {
    return (
      <>
        <PageTitle sobretitulo="Vendas / Detalhe" titulo="Detalhe da venda" />
        {vendaRes.status === 404 ? (
          <EmptyState
            titulo="Venda não encontrada"
            descricao="Ela pode ter sido removida ou o endereço está incorreto."
            icone={<ChartIcon className="h-6 w-6" />}
            acao={
              <Link
                href="/vendas"
                className="inline-flex h-11 items-center justify-center rounded-full bg-plum px-5 text-sm font-semibold text-white"
              >
                Ver vendas
              </Link>
            }
          />
        ) : (
          <ErrorState mensagem={vendaRes.message} />
        )}
      </>
    );
  }

  const venda = vendaRes.data;
  const pago = venda.statusPagamento === "PAGO";
  const quantidadeTotal = venda.itens.reduce(
    (soma, item) => soma + item.quantidade,
    0,
  );
  const produtosPorId = new Map(
    venda.itens.map((item) => [
      item.produtoId,
      item.produto?.nome ?? item.nomeProduto,
    ]),
  );

  return (
    <>
      <PageTitle
        sobretitulo="Vendas / Detalhe"
        titulo={`Venda #${venda.id}`}
        descricao={venda.cliente?.nome ?? "Cliente não informado"}
      />

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Resumo</CardTitle>
            <p className="mt-1 text-xs text-muted">
              Registrada em {formatDataHora(venda.createdAt)}
              {venda.usuario?.nome ? ` por ${venda.usuario.nome}` : ""}.
            </p>
          </div>
          <div data-testid="venda-status">
            <PagamentoBadge pago={pago} />
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Data do pedido
            </dt>
            <dd className="mt-0.5 font-semibold text-navy">
              {formatData(venda.dataPedido)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Vencimento
            </dt>
            <dd className="mt-0.5 font-semibold text-navy">
              {pago ? "—" : formatData(venda.vencimento)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Cliente
            </dt>
            <dd className="mt-0.5 font-semibold text-navy">
              {venda.cliente?.nome ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Operadora
            </dt>
            <dd className="mt-0.5 font-semibold text-navy">
              {venda.usuario?.nome ?? "—"}
            </dd>
          </div>
        </dl>
      </Card>

      <div className="mt-4">
        <Card>
          <CardTitle>Itens</CardTitle>
          <div className="mt-3 divide-y divide-line">
            {venda.itens.map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-navy">
                    {item.produto?.nome ?? item.nomeProduto}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatQuantidade(item.quantidade, item.produto?.unidadeMedida)}
                    {" · "}
                    {formatMoeda(item.valorUnitario)} cada
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-plum">
                  {formatMoeda(item.subtotal)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-3">
        <div data-testid="venda-total">
          <TotalVenda total={venda.total} quantidadeItens={quantidadeTotal} />
        </div>
      </div>

      {venda.observacoes ? (
        <div className="mt-4">
          <Card>
            <CardTitle>Observações</CardTitle>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-navy">
              {venda.observacoes}
            </p>
          </Card>
        </div>
      ) : null}

      {venda.movimentacoes && venda.movimentacoes.length > 0 ? (
        <div className="mt-4">
          <Card>
            <CardTitle>Baixa de estoque</CardTitle>
            <p className="mt-1 text-xs text-muted">
              Movimentos gerados automaticamente ao confirmar a venda.
            </p>
            <div className="mt-3 divide-y divide-line">
              {venda.movimentacoes.map((movimento) => (
                <div
                  key={movimento.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">
                      {produtosPorId.get(movimento.produtoId) ?? "Produto"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDataHora(movimento.dataHora)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-navy">
                    −{formatQuantidade(movimento.quantidade)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      <div className="mt-4">
        <Card className="border-amber-200 bg-amber-50/60">
          <p className="text-sm font-semibold text-amber-900">
            Venda registrada
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            Esta versão não permite alterar, cancelar ou excluir vendas. O
            pagamento é apenas a condição declarada no pedido e não gera baixa
            financeira.
          </p>
        </Card>
      </div>

      <div className="mt-4 flex justify-center">
        <ButtonLink href="/vendas" variante="secundario" className="w-full sm:w-auto">
          Voltar para vendas
        </ButtonLink>
      </div>
    </>
  );
}
