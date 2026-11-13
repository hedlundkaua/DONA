import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusBadge, StockBadge, TypeBadge } from "@/components/ui/badges";
import { PageTitle } from "@/components/ui/page-title";
import { EmptyState, ErrorState, InlineAlert } from "@/components/ui/states";
import { ProdutoStatusBotao } from "@/components/produtos/produto-status-botao";
import {
  ChevronRightIcon,
  ClipboardIcon,
  MovementsIcon,
  PlusIcon,
} from "@/components/ui/icons";
import { backendFetch } from "@/lib/api";
import {
  formatData,
  formatDataHora,
  formatMoeda,
  formatPercentual,
  formatQuantidade,
  margemPercentual,
  statusEstoque,
} from "@/lib/format";
import {
  apenasSaidas,
  podeAjustar,
  podeGerirCatalogo,
  podeMovimentar,
  podeVerCusto,
} from "@/lib/permissions";
import { getSession } from "@/lib/session";
import type { Movimentacao, Produto } from "@/lib/types";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Produto" };
export const dynamic = "force-dynamic";

export default async function ProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessao = await getSession();
  const perfil = sessao.status === "autenticado" ? sessao.user.perfil : null;

  if (!/^\d+$/.test(id)) {
    return (
      <>
        <PageTitle sobretitulo="Produtos / Detalhe" titulo="Produto inválido" />
        <EmptyState
          titulo="Produto não encontrado"
          descricao="O identificador informado não é válido."
          acao={
            <Link
              href="/produtos"
              className="inline-flex h-11 items-center justify-center rounded-full bg-plum px-5 text-sm font-semibold text-white"
            >
              Ver produtos
            </Link>
          }
        />
      </>
    );
  }

  const [produtoRes, movimentacoesRes] = await Promise.all([
    backendFetch<Produto>(`/api/produtos/${id}`),
    backendFetch<Movimentacao[]>(
      `/api/estoque/movimentacoes?produtoId=${id}`,
    ),
  ]);

  if (!produtoRes.ok) {
    return (
      <>
        <PageTitle sobretitulo="Produtos / Detalhe" titulo="Produto" />
        {produtoRes.status === 404 ? (
          <EmptyState
            titulo="Produto não encontrado"
            descricao="Ele pode ter sido removido ou o endereço está incorreto."
            acao={
              <Link
                href="/produtos"
                className="inline-flex h-11 items-center justify-center rounded-full bg-plum px-5 text-sm font-semibold text-white"
              >
                Ver produtos
              </Link>
            }
          />
        ) : (
          <ErrorState mensagem={produtoRes.message} />
        )}
      </>
    );
  }

  const produto = produtoRes.data;
  const nivel = statusEstoque(produto);
  const saldo = Number(produto.quantidadeEstoque);
  const minimo = Number(produto.estoqueMinimo);
  const proporcao =
    minimo > 0 ? Math.min(Math.max(saldo / minimo, 0), 1) : saldo > 0 ? 1 : 0;
  const movimentacoes = movimentacoesRes.ok
    ? movimentacoesRes.data.slice(0, 5)
    : [];

  const gerir = podeGerirCatalogo(perfil);
  const movimentar = podeMovimentar(perfil) && produto.ativo;
  const ajustar = podeAjustar(perfil) && produto.ativo;
  const soSaida = apenasSaidas(perfil);

  return (
    <>
      <PageTitle
        sobretitulo="Produtos / Detalhe"
        titulo={produto.nome}
        descricao={produto.categoria?.nome ?? "Sem categoria"}
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge ativo={produto.ativo} />
        {produto.ativo ? <StockBadge nivel={nivel} /> : null}
        <span className="text-xs text-muted">
          {produto.unidadeMedida.toLowerCase()}
        </span>
      </div>

      {!produto.ativo ? (
        <InlineAlert tom="atencao" className="mt-3">
          Produto inativo: não recebe movimentações nem ajustes até ser
          reativado.
        </InlineAlert>
      ) : nivel === "critico" ? (
        <InlineAlert tom="erro" className="mt-3">
          Saldo zerado. Registre uma entrada para repor este produto.
        </InlineAlert>
      ) : nivel === "baixo" ? (
        <InlineAlert tom="atencao" className="mt-3">
          Saldo abaixo do mínimo ({formatQuantidade(minimo, produto.unidadeMedida)}
          ). Considere repor.
        </InlineAlert>
      ) : null}

      <Card className="mt-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Saldo em estoque
            </p>
            <p className="mt-1 text-4xl font-bold leading-none text-navy">
              {formatQuantidade(saldo)}
              <span className="ml-1.5 text-base font-semibold uppercase text-muted">
                {produto.unidadeMedida.toLowerCase()}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Mínimo
            </p>
            <p className="mt-1 text-lg font-semibold text-navy">
              {formatQuantidade(minimo)}
            </p>
          </div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              nivel === "critico"
                ? "bg-danger"
                : nivel === "baixo"
                  ? "bg-amber-500"
                  : "bg-emerald-500",
            )}
            style={{ width: `${proporcao * 100}%` }}
            role="img"
            aria-label={`Saldo corresponde a ${Math.round(proporcao * 100)}% do estoque mínimo`}
          />
        </div>
      </Card>

      {gerir || movimentar || ajustar ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {gerir ? (
            <ButtonLink href={`/produtos/${produto.id}/editar`} variante="secundario">
              Editar
            </ButtonLink>
          ) : null}
          {movimentar && !soSaida ? (
            <ButtonLink href={`/movimentos/novo?produto=${produto.id}&tipo=ENTRADA`}>
              <PlusIcon className="h-4 w-4" />
              Entrada
            </ButtonLink>
          ) : null}
          {movimentar ? (
            <ButtonLink
              href={`/movimentos/novo?produto=${produto.id}&tipo=SAIDA`}
              variante="secundario"
            >
              <MovementsIcon className="h-4 w-4" />
              Saída
            </ButtonLink>
          ) : null}
          {ajustar ? (
            <ButtonLink href={`/ajustes/novo?produto=${produto.id}`} variante="secundario">
              <ClipboardIcon className="h-4 w-4" />
              Ajustar
            </ButtonLink>
          ) : null}
          {gerir ? (
            <div className="col-span-2">
              <ProdutoStatusBotao produto={produto} />
            </div>
          ) : null}
        </div>
      ) : null}

      <Card className="mt-4">
        <CardTitle>Preços</CardTitle>
        <dl className="mt-3 space-y-2 text-sm">
          {podeVerCusto(perfil) && produto.precoCusto ? (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Custo</dt>
              <dd className="font-semibold text-navy">
                {formatMoeda(produto.precoCusto)}
              </dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Venda</dt>
            <dd className="font-semibold text-navy">
              {formatMoeda(produto.precoVenda)}
            </dd>
          </div>
          {podeVerCusto(perfil) && produto.precoCusto ? (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Margem sobre venda</dt>
              <dd className="font-semibold text-plum">
                {formatPercentual(
                  margemPercentual(produto.precoCusto, produto.precoVenda),
                )}
              </dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card className="mt-3">
        <CardTitle>Detalhes</CardTitle>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted">Categoria</dt>
            <dd className="text-right font-medium text-navy">
              {produto.categoria?.nome ?? "—"}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted">Validade</dt>
            <dd className="text-right font-medium text-navy">
              {formatData(produto.dataValidade)}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted">Atualizado em</dt>
            <dd className="text-right font-medium text-navy">
              {formatDataHora(produto.updatedAt)}
            </dd>
          </div>
          {produto.observacoes ? (
            <div className="border-t border-line pt-2">
              <dt className="text-muted">Observações</dt>
              <dd className="mt-1 whitespace-pre-line text-navy">
                {produto.observacoes}
              </dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <div className="mt-5">
        <div className="mb-2 flex items-end justify-between gap-3">
          <CardTitle>Últimas movimentações</CardTitle>
          <Link
            href={`/movimentos?produto=${produto.id}`}
            className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-semibold text-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
          >
            Ver todas
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </div>

        {movimentacoesRes.ok ? (
          movimentacoes.length > 0 ? (
            <Card className="divide-y divide-line p-0">
              {movimentacoes.map((movimentacao) => (
                <div
                  key={movimentacao.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy">
                      {formatQuantidade(
                        movimentacao.quantidade,
                        produto.unidadeMedida,
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDataHora(movimentacao.dataHora)}
                      {movimentacao.documentoOrigem
                        ? ` · ${movimentacao.documentoOrigem}`
                        : ""}
                    </p>
                  </div>
                  <TypeBadge tipo={movimentacao.tipoMovimento} />
                </div>
              ))}
            </Card>
          ) : (
            <Card className="text-center">
              <p className="text-sm font-semibold text-navy">
                Nenhuma movimentação ainda
              </p>
              <p className="mt-1 text-xs text-muted">
                Entradas e saídas deste produto aparecem aqui.
              </p>
            </Card>
          )
        ) : (
          <InlineAlert tom="atencao">{movimentacoesRes.message}</InlineAlert>
        )}
      </div>
    </>
  );
}
