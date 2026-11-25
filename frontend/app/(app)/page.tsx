import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle, HeroCard } from "@/components/ui/card";
import { StockBadge, TypeBadge } from "@/components/ui/badges";
import { PageTitle } from "@/components/ui/page-title";
import { EmptyState, ErrorState, InlineAlert } from "@/components/ui/states";
import {
  BoxIcon,
  ChevronRightIcon,
  ClipboardIcon,
  MovementsIcon,
  PlusIcon,
  WalletIcon,
} from "@/components/ui/icons";
import { VendaCard } from "@/components/vendas/venda-card";
import { backendFetch } from "@/lib/api";
import { produtosParaReposicao } from "@/lib/estoque";
import {
  formatDataHora,
  formatQuantidade,
  hojeISO,
  statusEstoque,
} from "@/lib/format";
import {
  apenasSaidas,
  podeAjustar,
  podeCriarVenda,
  podeGerirCatalogo,
  podeMovimentar,
  podeVerFinanceiro,
} from "@/lib/permissions";
import { getSession } from "@/lib/session";
import type { Movimentacao, PaginaVendas, Produto } from "@/lib/types";

export const metadata: Metadata = { title: "Painel" };
export const dynamic = "force-dynamic";

export default async function PainelPage() {
  const sessao = await getSession();
  const perfil = sessao.status === "autenticado" ? sessao.user.perfil : null;
  const nome = sessao.status === "autenticado" ? sessao.user.nome : null;

  const [produtosRes, movimentacoesRes, vendasRes, aPrazoRes, pagasRes] =
    await Promise.all([
      backendFetch<Produto[]>("/api/produtos?ativo=true"),
      backendFetch<Movimentacao[]>(
        `/api/estoque/movimentacoes?de=${hojeISO()}`,
      ),
      backendFetch<PaginaVendas>("/api/vendas?limit=4"),
      backendFetch<PaginaVendas>(
        "/api/vendas?statusPagamento=A_PRAZO&limit=1",
      ),
      backendFetch<PaginaVendas>("/api/vendas?statusPagamento=PAGO&limit=1"),
    ]);

  const podeCriar = podeGerirCatalogo(perfil);
  const podeMexer = podeMovimentar(perfil);
  const podeCorrigir = podeAjustar(perfil);
  const soSaida = apenasSaidas(perfil);
  const podeVender = podeCriarVenda(perfil);
  const podeFinanceiro = podeVerFinanceiro(perfil);

  const titulo = (
    <PageTitle
      sobretitulo="Início / Painel"
      titulo={nome ? `Olá, ${nome.split(" ")[0]}` : "Resumo do negócio"}
      descricao="Visão rápida das vendas, dos produtos e do movimento de hoje."
      acao={
        podeVender ? (
          <ButtonLink href="/vendas/nova" tamanho="sm">
            <PlusIcon className="h-4 w-4" />
            Venda
          </ButtonLink>
        ) : undefined
      }
    />
  );

  if (!produtosRes.ok) {
    return (
      <>
        {titulo}
        <ErrorState mensagem={produtosRes.message} />
      </>
    );
  }

  const produtos = produtosRes.data;
  const baixos = produtosParaReposicao(produtos);
  const esgotados = produtos.filter(
    (produto) => Number(produto.quantidadeEstoque) <= 0,
  );
  const movimentacoes = movimentacoesRes.ok ? movimentacoesRes.data : null;
  const totalVendas = vendasRes.ok ? vendasRes.data.total : null;
  const totalPagas = pagasRes.ok ? pagasRes.data.total : null;
  const totalAPrazo = aPrazoRes.ok ? aPrazoRes.data.total : null;
  const vendasRecentes = vendasRes.ok ? vendasRes.data.items : null;
  const erroVendas = vendasRes.ok ? null : vendasRes.message;

  return (
    <>
      {titulo}

      <HeroCard>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/70 bg-white/85 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Produtos ativos
            </p>
            <p className="mt-1 text-3xl font-bold leading-none text-navy">
              {produtos.length}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              cadastrados e disponíveis
            </p>
          </div>
          <Link href="/produtos/reposicao" data-testid="painel-estoque-baixo" className="block rounded-xl border border-white/70 bg-white/85 p-3 transition-colors hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40">
            <p className="text-[11px] font-bold uppercase tracking-wide text-plum">
              Abaixo do mínimo
            </p>
            <p className="mt-1 text-3xl font-bold leading-none text-plum">
              {baixos.length}
            </p>
            <p className="mt-1 text-[11px] text-muted">Ver lista de reposição →</p>
          </Link>
        </div>
      </HeroCard>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Card className="p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Esgotados
          </p>
          <p className="mt-1 text-2xl font-bold leading-none text-danger">
            {esgotados.length}
          </p>
          <p className="mt-1 text-[11px] text-muted">saldo zerado</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Movimentações hoje
          </p>
          <p className="mt-1 text-2xl font-bold leading-none text-navy">
            {movimentacoes ? movimentacoes.length : "—"}
          </p>
          <p className="mt-1 text-[11px] text-muted">entradas e saídas</p>
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Card className="p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Vendas
          </p>
          <p className="mt-1 text-xl font-bold leading-none text-navy">
            {totalVendas ?? "—"}
          </p>
          <p className="mt-1 text-[10px] leading-tight text-muted">
            registradas
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Pagas
          </p>
          <p className="mt-1 text-xl font-bold leading-none text-emerald-700">
            {totalPagas ?? "—"}
          </p>
          <p className="mt-1 text-[10px] leading-tight text-muted">
            declaradas
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
            A prazo
          </p>
          <p className="mt-1 text-xl font-bold leading-none text-amber-700">
            {totalAPrazo ?? "—"}
          </p>
          <p className="mt-1 text-[10px] leading-tight text-muted">
            com vencimento
          </p>
        </Card>
      </div>

      {podeMexer || podeCriar ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {podeMexer && !soSaida ? (
            <ButtonLink
              href="/movimentos/novo?tipo=ENTRADA"
              variante="primario"
              className="w-full"
            >
              <PlusIcon className="h-4 w-4" />
              Entrada
            </ButtonLink>
          ) : null}
          {podeMexer ? (
            <ButtonLink
              href="/movimentos/novo?tipo=SAIDA"
              variante="secundario"
              className="w-full"
            >
              <MovementsIcon className="h-4 w-4" />
              Saída
            </ButtonLink>
          ) : null}
          {podeCorrigir ? (
            <ButtonLink
              href="/ajustes/novo"
              variante="secundario"
              className="w-full"
            >
              <ClipboardIcon className="h-4 w-4" />
              Ajuste
            </ButtonLink>
          ) : null}
          {podeCriar ? (
            <ButtonLink
              href="/produtos/novo"
              variante="secundario"
              className="w-full"
            >
              <BoxIcon className="h-4 w-4" />
              Produto
            </ButtonLink>
          ) : null}
        </div>
      ) : null}

      {podeFinanceiro ? (
        <Card className="mt-4 p-0">
          <div className="flex items-center gap-3 px-4 pt-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink">
              <WalletIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <CardTitle>Financeiro</CardTitle>
              <p className="mt-0.5 text-xs text-muted">
                Parcelas, caixa e relatórios de vendas.
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 divide-x divide-line border-t border-line">
            {[
              { href: "/financeiro?aba=parcelas", rotulo: "Parcelas" },
              { href: "/financeiro?aba=caixa", rotulo: "Caixa" },
              { href: "/financeiro?aba=vendas", rotulo: "Relatórios" },
            ].map(({ href, rotulo }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-center gap-1 px-2 py-3 text-xs font-semibold text-plum transition-colors hover:bg-pink-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pink/40"
              >
                {rotulo}
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="mt-5">
        <div className="mb-2 flex items-end justify-between gap-3">
          <CardTitle>Vendas recentes</CardTitle>
          <Link
            href="/vendas"
            className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-semibold text-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
          >
            Ver vendas
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </div>

        {vendasRecentes ? (
          vendasRecentes.length > 0 ? (
            <div className="space-y-2">
              {vendasRecentes.map((venda) => (
                <VendaCard
                  key={venda.id}
                  href={`/vendas/${venda.id}`}
                  testId={`painel-venda-${venda.id}`}
                  venda={{
                    id: venda.id,
                    clienteNome: venda.cliente?.nome ?? "Cliente",
                    dataPedido: venda.dataPedido,
                    total: venda.total,
                    pago: venda.statusPagamento === "PAGO",
                    vencimento: venda.vencimento,
                  }}
                />
              ))}
            </div>
          ) : (
            <Card className="text-center">
              <p className="text-sm font-semibold text-navy">
                Nenhuma venda registrada
              </p>
              <p className="mt-1 text-xs text-muted">
                As vendas confirmadas aparecem aqui com cliente, data e total.
              </p>
              {podeVender ? (
                <ButtonLink
                  href="/vendas/nova"
                  variante="secundario"
                  tamanho="sm"
                  className="mt-3"
                >
                  <PlusIcon className="h-4 w-4" />
                  Registrar venda
                </ButtonLink>
              ) : null}
            </Card>
          )
        ) : (
          <InlineAlert tom="atencao">{erroVendas}</InlineAlert>
        )}
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-end justify-between gap-3">
          <CardTitle>Repor agora</CardTitle>
          <Link
            href="/produtos/reposicao"
            className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-semibold text-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
          >
            Ver lista completa
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </div>

        {baixos.length === 0 ? (
          <Card className="text-center">
            <p className="text-sm font-semibold text-navy">
              Tudo abastecido por aqui
            </p>
            <p className="mt-1 text-xs text-muted">
              Nenhum produto ativo está abaixo do estoque mínimo.
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-line p-0">
            {baixos.slice(0, 5).map((produto) => (
              <Link
                key={produto.id}
                href={`/produtos/${produto.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-pink-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pink/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy">
                    {produto.nome}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatQuantidade(
                      produto.quantidadeEstoque,
                      produto.unidadeMedida,
                    )}{" "}
                    · mínimo{" "}
                    {formatQuantidade(
                      produto.estoqueMinimo,
                      produto.unidadeMedida,
                    )}
                  </p>
                </div>
                <StockBadge nivel={statusEstoque(produto)} />
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            ))}
          </Card>
        )}
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-end justify-between gap-3">
          <CardTitle>Movimentações de hoje</CardTitle>
          <Link
            href="/movimentos"
            className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-semibold text-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
          >
            Ver todas
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </div>

        {movimentacoesRes.ok ? (
          movimentacoes && movimentacoes.length > 0 ? (
            <Card className="divide-y divide-line p-0">
              {movimentacoes.slice(0, 4).map((movimentacao) => (
                <div
                  key={movimentacao.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy">
                      {movimentacao.produto?.nome ?? "Produto"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDataHora(movimentacao.dataHora)} ·{" "}
                      {formatQuantidade(
                        movimentacao.quantidade,
                        movimentacao.produto?.unidadeMedida,
                      )}
                    </p>
                  </div>
                  <TypeBadge tipo={movimentacao.tipoMovimento} />
                </div>
              ))}
            </Card>
          ) : (
            <Card className="text-center">
              <p className="text-sm font-semibold text-navy">
                Nenhuma movimentação hoje
              </p>
              <p className="mt-1 text-xs text-muted">
                Entradas e saídas registradas aparecem aqui.
              </p>
            </Card>
          )
        ) : (
          <InlineAlert tom="atencao">{movimentacoesRes.message}</InlineAlert>
        )}
      </div>

      {produtos.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            titulo="Comece pelo primeiro produto"
            descricao="Cadastre os itens do negócio para acompanhar saldo, mínimo e reposição."
            icone={<BoxIcon className="h-6 w-6" />}
            acao={
              podeCriar ? (
                <ButtonLink href="/produtos/novo" className="w-full">
                  <PlusIcon className="h-4 w-4" />
                  Cadastrar produto
                </ButtonLink>
              ) : (
                <ButtonLink href="/produtos" variante="secundario" className="w-full">
                  Ver produtos
                </ButtonLink>
              )
            }
          />
        </div>
      ) : null}
    </>
  );
}
