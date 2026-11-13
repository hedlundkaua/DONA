import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/page-title";
import { ErrorState } from "@/components/ui/states";
import { backendFetch } from "@/lib/api";
import { podeGerirCatalogo } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import type { Categoria } from "@/lib/types";
import { CategoriasManager } from "./categorias-manager";

export const metadata: Metadata = { title: "Categorias" };
export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const sessao = await getSession();
  const perfil = sessao.status === "autenticado" ? sessao.user.perfil : null;

  const categoriasRes = await backendFetch<Categoria[]>("/api/categorias");

  return (
    <>
      <PageTitle
        sobretitulo="Início / Categorias"
        titulo="Categorias"
        descricao="Organize os produtos por grupos para facilitar a busca e o controle."
      />

      {categoriasRes.ok ? (
        <CategoriasManager
          categorias={categoriasRes.data}
          podeGerir={podeGerirCatalogo(perfil)}
        />
      ) : (
        <ErrorState mensagem={categoriasRes.message} />
      )}
    </>
  );
}
