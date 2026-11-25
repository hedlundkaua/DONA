import type { Metadata } from "next";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, inputBase, selectBase } from "@/components/ui/field";
import { ChartIcon, PlusIcon } from "@/components/ui/icons";
import { PageTitle } from "@/components/ui/page-title";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { VendaCard } from "@/components/vendas/venda-card";
import { backendFetch } from "@/lib/api";
import { podeCriarVenda } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import type { PaginaVendas, StatusPagamentoVenda } from "@/lib/types";

export const metadata: Metadata = { title: "Vendas" };
export const dynamic = "force-dynamic";

const LIMITE = 20;

type ParamsBusca = Promise<{
  statusPagamento?: string | string[];
  de?: string | string[];
  ate?: string | string[];
  page?: string | string[];
}>;

function primeiro(valor: string | string[] | undefined): string {
  return typeof valor === "string" ? valor : "";
}

function dataValida(valor: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

function paginaValida(valor: string): number {
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero > 0 ? numero : 1;
}

export default async function VendasPage({
  searchParams,
}: {
  searchParams: ParamsBusca;
}) {
  const sessao = await getSession();
  const perfil = sessao.status === "autenticado" ? sessao.user.perfil : null;
  const podeCriar = podeCriarVenda(perfil);

  const filtros = await searchParams;
  const statusBruto = primeiro(filtros.statusPagamento);
  const status: StatusPagamentoVenda | "" =
    statusBruto === "PAGO" || statusBruto === "A_PRAZO" ? statusBruto : "";
  const deBruto = primeiro(filtros.de);
  const ateBruto = primeiro(filtros.ate);
  const de = dataValida(deBruto) ? deBruto : "";
  const ate = dataValida(ateBruto) ? ateBruto : "";
  const pagina = paginaValida(primeiro(filtros.page));

  const parametros = new URLSearchParams();
  if (status) parametros.set("statusPagamento", status);
  if (de) parametros.set("de", de);
  if (ate) parametros.set("ate", ate);
  parametros.set("page", String(pagina));
  parametros.set("limit", String(LIMITE));

  const vendasRes = await backendFetch<PaginaVendas>(
    `/api/vendas?${parametros.toString()}`,
  );

  const titulo = (
    <PageTitle
      sobretitulo="Vendas / Histórico"
      titulo="Vendas"
      descricao="Acompanhe as vendas do negócio e registre novos pedidos."
      acao={
        podeCriar ? (
          <ButtonLink href="/vendas/nova" tamanho="sm">
            <PlusIcon className="h-4 w-4" />
            Nova
          </ButtonLink>
        ) : undefined
      }
    />
  );

  if (!vendasRes.ok) {
    return (
      <>
        {titulo}
        <ErrorState mensagem={vendasRes.message} />
      </>
    );
  }

  const paginaAtual = vendasRes.data.page;
  const total = vendasRes.data.total;
  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE));
  const temFiltro = Boolean(status || de || ate);

  function hrefPagina(numero: number): string {
    const proximos = new URLSearchParams();
    if (status) proximos.set("statusPagamento", status);
    if (de) proximos.set("de", de);
    if (ate) proximos.set("ate", ate);
    proximos.set("page", String(numero));
    proximos.set("limit", String(LIMITE));
    return `/vendas?${proximos.toString()}`;
  }

  return (
    <>
      {titulo}

      <form
        action="/vendas"
        method="get"
        className="mb-4 space-y-3 rounded-2xl border border-line bg-white p-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pagamento" htmlFor="vendas-status" className="col-span-2 sm:col-span-1">
            <select
              id="vendas-status"
              name="statusPagamento"
              defaultValue={status}
              data-testid="vendas-filtro-status"
              className={selectBase}
            >
              <option value="">Todos</option>
              <option value="PAGO">Pago</option>
              <option value="A_PRAZO">A prazo</option>
            </select>
          </Field>
          <div className="col-span-2 grid grid-cols-2 gap-3 sm:col-span-1">
            <Field label="De" htmlFor="vendas-de">
              <input
                id="vendas-de"
                name="de"
                type="date"
                defaultValue={de}
                data-testid="vendas-filtro-de"
                className={inputBase}
              />
            </Field>
            <Field label="Até" htmlFor="vendas-ate">
              <input
                id="vendas-ate"
                name="ate"
                type="date"
                defaultValue={ate}
                data-testid="vendas-filtro-ate"
                className={inputBase}
              />
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            type="submit"
            variante="secundario"
            tamanho="sm"
            data-testid="vendas-filtrar"
          >
            Filtrar
          </Button>
          {temFiltro ? (
            <Link
              href="/vendas"
              className="rounded-full px-3 py-2 text-xs font-semibold text-plum hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
            >
              Limpar filtros
            </Link>
          ) : null}
        </div>
      </form>

      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted">
          {total === 1 ? "1 venda" : `${total} vendas`}
          {temFiltro ? " com os filtros atuais" : ""}
        </p>
        {total > 0 ? (
          <p className="text-[11px] text-muted">
            Página {paginaAtual} de {totalPaginas}
          </p>
        ) : null}
      </div>

      {vendasRes.data.items.length === 0 ? (
        <EmptyState
          titulo={temFiltro ? "Nenhuma venda encontrada" : "Nenhuma venda registrada"}
          descricao={
            temFiltro
              ? "Tente outro período ou condição de pagamento."
              : "As vendas registradas aparecem aqui com cliente, data e total."
          }
          icone={<ChartIcon className="h-6 w-6" />}
          acao={
            temFiltro ? (
              <ButtonLink href="/vendas" variante="secundario" className="w-full">
                Limpar filtros
              </ButtonLink>
            ) : podeCriar ? (
              <ButtonLink href="/vendas/nova" className="w-full">
                <PlusIcon className="h-4 w-4" />
                Registrar venda
              </ButtonLink>
            ) : (
              <ButtonLink href="/" variante="secundario" className="w-full">
                Voltar ao painel
              </ButtonLink>
            )
          }
        />
      ) : (
        <div className="space-y-2">
          {vendasRes.data.items.map((venda) => (
            <VendaCard
              key={venda.id}
              href={`/vendas/${venda.id}`}
              testId={`venda-${venda.id}`}
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
      )}

      {total > LIMITE ? (
        <nav
          className="mt-4 flex items-center justify-between gap-2"
          aria-label="Paginação de vendas"
        >
          {paginaAtual > 1 ? (
            <ButtonLink
              href={hrefPagina(paginaAtual - 1)}
              variante="secundario"
              tamanho="sm"
            >
              Anterior
            </ButtonLink>
          ) : (
            <span aria-hidden="true" />
          )}
          <span className="text-xs font-semibold text-muted">
            {paginaAtual} / {totalPaginas}
          </span>
          {paginaAtual < totalPaginas ? (
            <ButtonLink
              href={hrefPagina(paginaAtual + 1)}
              variante="secundario"
              tamanho="sm"
            >
              Próxima
            </ButtonLink>
          ) : (
            <span aria-hidden="true" />
          )}
        </nav>
      ) : null}

      {vendasRes.data.items.length > 0 ? (
        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
          Vendas registradas não podem ser alteradas ou canceladas nesta versão.
        </p>
      ) : null}
    </>
  );
}
