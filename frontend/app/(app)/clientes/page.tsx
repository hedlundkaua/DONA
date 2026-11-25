import type { Metadata } from "next";
import Link from "next/link";
import { ClienteCard } from "@/components/clientes/cliente-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { inputBase, selectBase } from "@/components/ui/field";
import { ClientsIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { PageTitle } from "@/components/ui/page-title";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import { backendFetch } from "@/lib/api";
import { podeGerirClientes, podeVerClientes } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import type { Cliente } from "@/lib/types";

export const metadata: Metadata = { title: "Clientes" };
export const dynamic = "force-dynamic";

type ParamsBusca = Promise<{
  q?: string | string[];
  ativo?: string | string[];
}>;

function primeiro(valor: string | string[] | undefined): string {
  return typeof valor === "string" ? valor : "";
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: ParamsBusca;
}) {
  const sessao = await getSession();
  const perfil = sessao.status === "autenticado" ? sessao.user.perfil : null;
  const podeVer = podeVerClientes(perfil);
  const podeGerir = podeGerirClientes(perfil);

  const filtros = await searchParams;
  const q = primeiro(filtros.q).trim();
  const ativoFiltro = primeiro(filtros.ativo);
  const ativo = ativoFiltro === "true" || ativoFiltro === "false" ? ativoFiltro : "";

  const titulo = (
    <PageTitle
      sobretitulo="Vendas / Clientes"
      titulo="Clientes"
      descricao="Consulte os contatos e mantenha os cadastros prontos para as próximas vendas."
      acao={
        podeGerir ? (
          <ButtonLink href="/clientes/novo" tamanho="sm">
            <PlusIcon className="h-4 w-4" />
            Novo
          </ButtonLink>
        ) : undefined
      }
    />
  );

  if (!podeVer) {
    return (
      <>
        {titulo}
        <SemPermissao descricao="Apenas administração, gestão e vendedoras podem consultar clientes." />
      </>
    );
  }

  const parametros = new URLSearchParams();
  if (q) parametros.set("q", q);
  if (ativo) parametros.set("ativo", ativo);
  const consulta = parametros.size > 0 ? `?${parametros.toString()}` : "";

  const clientesRes = await backendFetch<Cliente[]>(`/api/clientes${consulta}`);

  if (!clientesRes.ok) {
    if (clientesRes.status === 403) {
      return (
        <>
          {titulo}
          <SemPermissao descricao="Seu perfil não pode consultar clientes." />
        </>
      );
    }
    return (
      <>
        {titulo}
        <ErrorState mensagem={clientesRes.message} />
      </>
    );
  }

  const clientes = clientesRes.data;
  const temFiltro = Boolean(q || ativo);
  const limiteAtingido = clientes.length === 100;

  return (
    <>
      {titulo}

      <form
        action="/clientes"
        method="get"
        className="mb-4 space-y-3 rounded-2xl border border-line bg-white p-3"
      >
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar por nome ou WhatsApp"
              aria-label="Buscar clientes"
              className={cn(inputBase, "pl-9")}
              data-testid="clientes-busca"
            />
          </div>
          <Button
            type="submit"
            variante="secundario"
            className="shrink-0 px-4"
            data-testid="clientes-filtrar"
          >
            Filtrar
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="clientes-ativo" className="sr-only">
            Situação do cliente
          </label>
          <select
            id="clientes-ativo"
            name="ativo"
            defaultValue={ativo}
            className={cn(selectBase, "h-10 flex-1 text-sm")}
          >
            <option value="">Todos os clientes</option>
            <option value="true">Somente ativos</option>
            <option value="false">Somente inativos</option>
          </select>
          {temFiltro ? (
            <Link
              href="/clientes"
              className="shrink-0 rounded-full px-3 py-2 text-xs font-semibold text-plum hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
            >
              Limpar
            </Link>
          ) : null}
        </div>
      </form>

      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted">
          {clientes.length === 1 ? "1 cliente" : `${clientes.length} clientes`}
          {q ? ` para “${q}”` : ""}
        </p>
        {limiteAtingido ? (
          <p className="text-right text-[11px] text-amber-700">
            Exibindo até 100; refine a busca.
          </p>
        ) : null}
      </div>

      {clientes.length === 0 ? (
        <EmptyState
          titulo={temFiltro ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          descricao={
            temFiltro
              ? "Tente outro nome, telefone ou situação."
              : "Cadastre o primeiro contato para usar nas vendas do negócio."
          }
          icone={<ClientsIcon className="h-6 w-6" />}
          acao={
            temFiltro ? (
              <ButtonLink href="/clientes" variante="secundario" className="w-full">
                Limpar filtros
              </ButtonLink>
            ) : podeGerir ? (
              <ButtonLink href="/clientes/novo" className="w-full">
                <PlusIcon className="h-4 w-4" />
                Cadastrar cliente
              </ButtonLink>
            ) : (
              <ButtonLink href="/vendas" variante="secundario" className="w-full">
                Ver vendas
              </ButtonLink>
            )
          }
        />
      ) : (
        <div className="space-y-2">
          {clientes.map((cliente) => (
            <ClienteCard
              key={cliente.id}
              cliente={cliente}
              href={podeGerir ? `/clientes/${cliente.id}/editar` : undefined}
              testId={`cliente-${cliente.id}`}
            />
          ))}
        </div>
      )}
    </>
  );
}
