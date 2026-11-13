import type { Metadata } from "next";
import { ClienteForm } from "@/components/clientes/cliente-form";
import { PageTitle } from "@/components/ui/page-title";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { podeGerirClientes } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Novo cliente" };
export const dynamic = "force-dynamic";

export default async function NovoClientePage() {
  const sessao = await getSession();
  const perfil = sessao.status === "autenticado" ? sessao.user.perfil : null;

  if (!podeGerirClientes(perfil)) {
    return (
      <>
        <PageTitle
          sobretitulo="Vendas / Clientes / Novo"
          titulo="Novo cliente"
        />
        <SemPermissao descricao="Apenas administração e gestão podem cadastrar clientes." />
      </>
    );
  }

  return (
    <>
      <PageTitle
        sobretitulo="Vendas / Clientes / Novo"
        titulo="Novo cliente"
        descricao="Cadastre o contato para usar nas próximas vendas."
      />
      <ClienteForm modo="criar" />
    </>
  );
}
