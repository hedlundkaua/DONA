import type { Metadata } from "next";
import Link from "next/link";
import { ClienteForm } from "@/components/clientes/cliente-form";
import { PageTitle } from "@/components/ui/page-title";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { backendFetch } from "@/lib/api";
import { podeGerirClientes } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import type { Cliente } from "@/lib/types";

export const metadata: Metadata = { title: "Editar cliente" };
export const dynamic = "force-dynamic";

export default async function EditarClientePage({
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
        <PageTitle
          sobretitulo="Vendas / Clientes / Editar"
          titulo="Cliente inválido"
          descricao="O identificador informado não é válido."
        />
        <EmptyState
          titulo="Cliente não encontrado"
          descricao="Volte para a lista e escolha um cliente."
          acao={
            <Link
              href="/clientes"
              className="inline-flex h-11 items-center justify-center rounded-full bg-plum px-5 text-sm font-semibold text-white"
            >
              Ver clientes
            </Link>
          }
        />
      </>
    );
  }

  if (!podeGerirClientes(perfil)) {
    return (
      <>
        <PageTitle
          sobretitulo="Vendas / Clientes / Editar"
          titulo="Editar cliente"
        />
        <SemPermissao descricao="Apenas administração e gestão podem editar clientes." />
      </>
    );
  }

  const clienteRes = await backendFetch<Cliente>(`/api/clientes/${id}`);

  if (!clienteRes.ok) {
    return (
      <>
        <PageTitle
          sobretitulo="Vendas / Clientes / Editar"
          titulo="Editar cliente"
        />
        {clienteRes.status === 404 ? (
          <EmptyState
            titulo="Cliente não encontrado"
            descricao="Ele pode ter sido removido ou o endereço está incorreto."
            acao={
              <Link
                href="/clientes"
                className="inline-flex h-11 items-center justify-center rounded-full bg-plum px-5 text-sm font-semibold text-white"
              >
                Ver clientes
              </Link>
            }
          />
        ) : (
          <ErrorState mensagem={clienteRes.message} />
        )}
      </>
    );
  }

  const cliente = clienteRes.data;

  return (
    <>
      <PageTitle
        sobretitulo="Vendas / Clientes / Editar"
        titulo="Editar cliente"
        descricao={cliente.nome}
      />
      <ClienteForm modo="editar" cliente={cliente} />
    </>
  );
}
