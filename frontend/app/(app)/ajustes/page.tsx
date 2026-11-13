import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { AdjustmentBadge } from "@/components/ui/badges";
import { PageTitle } from "@/components/ui/page-title";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { ClipboardIcon, PlusIcon } from "@/components/ui/icons";
import { inputBase, selectBase } from "@/components/ui/field";
import { backendFetch } from "@/lib/api";
import { formatData, formatQuantidade } from "@/lib/format";
import { podeAjustar, podeVerAjustes } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import type { Ajuste, Produto } from "@/lib/types";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Ajustes" };
export const dynamic = "force-dynamic";

type Parametros = Record<string, string | string[] | undefined>;

function texto(valor: string | string[] | undefined): string {
  return typeof valor === "string" ? valor.trim() : "";
}

export default async function AjustesPage({
  searchParams,
}: {
  searchParams: Promise<Parametros>;
}) {
  const params = await searchParams;
  const produtoFiltro = texto(params.produto);
  const de = texto(params.de);
  const ate = texto(params.ate);

  const sessao = await getSession();
  const perfil = sessao.status === "autenticado" ? sessao.user.perfil : null;

  const titulo = (
    <PageTitle
      sobretitulo="Início / Ajustes"
      titulo="Ajustes de inventário"
      descricao="Corrija o saldo após conferência física, avaria, perda ou vencimento."
      acao={
        podeAjustar(perfil) ? (
          <ButtonLink href="/ajustes/novo" tamanho="sm">
            <PlusIcon className="h-4 w-4" />
            Novo
          </ButtonLink>
        ) : undefined
      }
    />
  );

  if (!podeVerAjustes(perfil)) {
    return (
      <>
        {titulo}
        <SemPermissao descricao="O histórico de ajustes é restrito a administração, gestão e estoquista." />
      </>
    );
  }

  const filtros = new URLSearchParams();
  if (/^\d+$/.test(produtoFiltro)) filtros.set("produtoId", produtoFiltro);
  if (de) filtros.set("de", de);
  if (ate) filtros.set("ate", ate);
  const query = filtros.toString();
  const temFiltro = Boolean(query);

  const [ajustesRes, produtosRes] = await Promise.all([
    backendFetch<Ajuste[]>(
      `/api/estoque/ajustes${query ? `?${query}` : ""}`,
    ),
    backendFetch<Produto[]>("/api/produtos"),
  ]);

  const produtos = produtosRes.ok ? produtosRes.data : [];

  return (
    <>
      {titulo}

      <Card>
        <CardTitle>Filtrar</CardTitle>
        <form method="get" action="/ajustes" className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label
                htmlFor="filtro-ajuste-produto"
                className="block text-xs font-semibold text-navy"
              >
                Produto
              </label>
              <select
                id="filtro-ajuste-produto"
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
                htmlFor="filtro-ajuste-de"
                className="block text-xs font-semibold text-navy"
              >
                De
              </label>
              <input
                id="filtro-ajuste-de"
                type="date"
                name="de"
                defaultValue={de}
                className={cn(inputBase, "h-11 text-sm")}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="filtro-ajuste-ate"
                className="block text-xs font-semibold text-navy"
              >
                Até
              </label>
              <input
                id="filtro-ajuste-ate"
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
                href="/ajustes"
                className="inline-flex h-10 items-center justify-center rounded-full border border-line px-4 text-xs font-semibold text-navy transition-colors hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
              >
                Limpar
              </Link>
            ) : null}
          </div>
        </form>
      </Card>

      <div className="mt-4">
        {!ajustesRes.ok ? (
          <ErrorState mensagem={ajustesRes.message} />
        ) : ajustesRes.data.length === 0 ? (
          <EmptyState
            titulo={
              temFiltro
                ? "Nenhum ajuste com esses filtros"
                : "Nenhum ajuste registrado"
            }
            descricao={
              temFiltro
                ? "Tente outro produto ou intervalo de datas."
                : "Ao conferir o estoque físico, registre aqui a diferença encontrada."
            }
            icone={<ClipboardIcon className="h-6 w-6" />}
            acao={
              podeAjustar(perfil) && !temFiltro ? (
                <ButtonLink href="/ajustes/novo" className="w-full">
                  <PlusIcon className="h-4 w-4" />
                  Novo ajuste
                </ButtonLink>
              ) : temFiltro ? (
                <ButtonLink
                  href="/ajustes"
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
              {ajustesRes.data.length}{" "}
              {ajustesRes.data.length === 1
                ? "ajuste encontrado"
                : "ajustes encontrados"}
            </p>
            <Card className="divide-y divide-line p-0">
              {ajustesRes.data.map((ajuste) => {
                const diferenca = Number(ajuste.diferenca);
                return (
                  <div key={ajuste.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <AdjustmentBadge tipo={ajuste.tipoAjuste} />
                          <span className="text-[11px] text-muted">
                            {formatData(ajuste.data)}
                          </span>
                        </div>
                        <Link
                          href={`/produtos/${ajuste.produtoId}`}
                          className="mt-1 block truncate text-sm font-semibold text-navy hover:text-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
                        >
                          {ajuste.produto?.nome ?? "Produto"}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted">
                          Sistema{" "}
                          {formatQuantidade(
                            ajuste.quantidadeSistema,
                            ajuste.produto?.unidadeMedida,
                          )}{" "}
                          → contado{" "}
                          {formatQuantidade(
                            ajuste.quantidadeContada,
                            ajuste.produto?.unidadeMedida,
                          )}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted">
                          {ajuste.motivo}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "shrink-0 text-sm font-bold",
                          diferenca > 0
                            ? "text-emerald-700"
                            : diferenca < 0
                              ? "text-rose-700"
                              : "text-muted",
                        )}
                      >
                        {diferenca > 0 ? "+" : ""}
                        {formatQuantidade(diferenca)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </Card>
          </>
        )}
      </div>
    </>
  );
}
