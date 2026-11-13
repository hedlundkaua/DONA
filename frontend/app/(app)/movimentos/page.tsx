import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { TypeBadge } from "@/components/ui/badges";
import { PageTitle } from "@/components/ui/page-title";
import { EmptyState, ErrorState, InlineAlert } from "@/components/ui/states";
import { MovementsIcon, PlusIcon } from "@/components/ui/icons";
import { inputBase, selectBase } from "@/components/ui/field";
import { backendFetch } from "@/lib/api";
import {
  apenasSaidas,
  podeMovimentar,
} from "@/lib/permissions";
import { getSession } from "@/lib/session";
import {
  formatDataHora,
  formatQuantidade,
} from "@/lib/format";
import type { Movimentacao, Produto } from "@/lib/types";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Movimentos" };
export const dynamic = "force-dynamic";

type Parametros = Record<string, string | string[] | undefined>;

function texto(valor: string | string[] | undefined): string {
  return typeof valor === "string" ? valor.trim() : "";
}

export default async function MovimentosPage({
  searchParams,
}: {
  searchParams: Promise<Parametros>;
}) {
  const params = await searchParams;
  const produtoFiltro = texto(params.produto);
  const tipoFiltro = texto(params.tipo);
  const de = texto(params.de);
  const ate = texto(params.ate);

  const sessao = await getSession();
  const perfil = sessao.status === "autenticado" ? sessao.user.perfil : null;
  const podeCriar = podeMovimentar(perfil);

  const filtros = new URLSearchParams();
  if (/^\d+$/.test(produtoFiltro)) filtros.set("produtoId", produtoFiltro);
  if (tipoFiltro === "ENTRADA" || tipoFiltro === "SAIDA") {
    filtros.set("tipo", tipoFiltro);
  }
  if (de) filtros.set("de", de);
  if (ate) filtros.set("ate", ate);
  const query = filtros.toString();

  const [movimentacoesRes, produtosRes] = await Promise.all([
    backendFetch<Movimentacao[]>(
      `/api/estoque/movimentacoes${query ? `?${query}` : ""}`,
    ),
    backendFetch<Produto[]>("/api/produtos"),
  ]);

  const temFiltro = Boolean(query);
  const produtos = produtosRes.ok ? produtosRes.data : [];

  return (
    <>
      <PageTitle
        sobretitulo="Início / Movimentos"
        titulo="Movimentos"
        descricao="Histórico de entradas e saídas do estoque, com data e responsável."
        acao={
          podeCriar ? (
            <ButtonLink href="/movimentos/novo" tamanho="sm">
              <PlusIcon className="h-4 w-4" />
              Novo
            </ButtonLink>
          ) : undefined
        }
      />

      <Card>
        <CardTitle>Filtrar</CardTitle>
        <form method="get" action="/movimentos" className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="filtro-produto"
                className="block text-xs font-semibold text-navy"
              >
                Produto
              </label>
              <select
                id="filtro-produto"
                name="produto"
                defaultValue={produtoFiltro}
                className={cn(selectBase, "h-11 text-sm")}
              >
                <option value="">Todos os produtos</option>
                {produtos.map((produto) => (
                  <option key={produto.id} value={String(produto.id)}>
                    {produto.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="filtro-tipo"
                className="block text-xs font-semibold text-navy"
              >
                Tipo
              </label>
              <select
                id="filtro-tipo"
                name="tipo"
                defaultValue={tipoFiltro}
                className={cn(selectBase, "h-11 text-sm")}
              >
                <option value="">Entradas e saídas</option>
                <option value="ENTRADA">Entradas</option>
                <option value="SAIDA">Saídas</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="filtro-de"
                className="block text-xs font-semibold text-navy"
              >
                De
              </label>
              <input
                id="filtro-de"
                type="date"
                name="de"
                defaultValue={de}
                className={cn(inputBase, "h-11 text-sm")}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="filtro-ate"
                className="block text-xs font-semibold text-navy"
              >
                Até
              </label>
              <input
                id="filtro-ate"
                type="date"
                name="ate"
                defaultValue={ate}
                className={cn(inputBase, "h-11 text-sm")}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-full bg-plum px-5 text-sm font-semibold text-white transition-colors hover:bg-plum/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40 focus-visible:ring-offset-2"
            >
              Aplicar filtros
            </button>
            {temFiltro ? (
              <Link
                href="/movimentos"
                className="inline-flex h-10 items-center justify-center rounded-full border border-line px-4 text-xs font-semibold text-navy transition-colors hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
              >
                Limpar
              </Link>
            ) : null}
          </div>
        </form>
      </Card>

      {podeCriar && apenasSaidas(perfil) ? (
        <InlineAlert tom="info" className="mt-3">
          Seu perfil registra apenas saídas de estoque. Fale com a gestão para
          entradas e ajustes.
        </InlineAlert>
      ) : null}

      <div className="mt-4">
        {!movimentacoesRes.ok ? (
          <ErrorState mensagem={movimentacoesRes.message} />
        ) : movimentacoesRes.data.length === 0 ? (
          <EmptyState
            titulo={
              temFiltro
                ? "Nenhuma movimentação com esses filtros"
                : "Nenhuma movimentação registrada"
            }
            descricao={
              temFiltro
                ? "Tente outro produto, tipo ou intervalo de datas."
                : "Registre entradas e saídas para acompanhar o saldo dos produtos."
            }
            icone={<MovementsIcon className="h-6 w-6" />}
            acao={
              podeCriar && !temFiltro ? (
                <ButtonLink href="/movimentos/novo" className="w-full">
                  <PlusIcon className="h-4 w-4" />
                  Nova movimentação
                </ButtonLink>
              ) : temFiltro ? (
                <ButtonLink
                  href="/movimentos"
                  variante="secundario"
                  className="w-full"
                >
                  Limpar filtros
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <>
            <p className="mb-2 px-1 text-xs font-medium text-muted" role="status">
              {movimentacoesRes.data.length}{" "}
              {movimentacoesRes.data.length === 1
                ? "movimentação encontrada"
                : "movimentações encontradas"}
            </p>
            <Card className="divide-y divide-line p-0">
              {movimentacoesRes.data.map((movimentacao) => (
                <div
                  key={movimentacao.id}
                  className="flex items-start gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <TypeBadge tipo={movimentacao.tipoMovimento} />
                      <span className="text-[11px] text-muted">
                        {formatDataHora(movimentacao.dataHora)}
                      </span>
                    </div>
                    <Link
                      href={`/produtos/${movimentacao.produtoId}`}
                      className="mt-1 block truncate text-sm font-semibold text-navy hover:text-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
                    >
                      {movimentacao.produto?.nome ?? "Produto"}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatQuantidade(
                        movimentacao.quantidade,
                        movimentacao.produto?.unidadeMedida,
                      )}
                      {movimentacao.documentoOrigem
                        ? ` · ${movimentacao.documentoOrigem}`
                        : ""}
                    </p>
                    {movimentacao.observacoes ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted">
                        {movimentacao.observacoes}
                      </p>
                    ) : null}
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-sm font-bold",
                      movimentacao.tipoMovimento === "ENTRADA"
                        ? "text-emerald-700"
                        : "text-rose-700",
                    )}
                  >
                    {movimentacao.tipoMovimento === "ENTRADA" ? "+" : "−"}
                    {formatQuantidade(movimentacao.quantidade)}
                  </p>
                </div>
              ))}
            </Card>
          </>
        )}
      </div>
    </>
  );
}
