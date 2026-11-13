import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { TagIcon } from "@/components/ui/icons";
import { ProdutoForm } from "@/components/produtos/produto-form";
import { backendFetch } from "@/lib/api";
import { podeGerirCatalogo } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import type { Categoria } from "@/lib/types";

export const metadata: Metadata = { title: "Novo produto" };
export const dynamic = "force-dynamic";

export default async function NovoProdutoPage() {
  const sessao = await getSession();
  const perfil = sessao.status === "autenticado" ? sessao.user.perfil : null;

  const titulo = (
    <PageTitle
      sobretitulo="Produtos / Novo"
      titulo="Cadastrar produto"
      descricao="Informe identificação, preços e o limite mínimo de estoque."
    />
  );

  if (!podeGerirCatalogo(perfil)) {
    return (
      <>
        {titulo}
        <SemPermissao descricao="Apenas administração e gestão podem cadastrar produtos." />
      </>
    );
  }

  const categoriasRes = await backendFetch<Categoria[]>(
    "/api/categorias?ativo=true",
  );

  if (!categoriasRes.ok) {
    return (
      <>
        {titulo}
        <ErrorState mensagem={categoriasRes.message} />
      </>
    );
  }

  if (categoriasRes.data.length === 0) {
    return (
      <>
        {titulo}
        <EmptyState
          titulo="Crie uma categoria primeiro"
          descricao="Todo produto precisa estar vinculado a uma categoria ativa."
          icone={<TagIcon className="h-6 w-6" />}
          acao={
            <ButtonLink href="/categorias" className="w-full">
              Ir para categorias
            </ButtonLink>
          }
        />
      </>
    );
  }

  return (
    <>
      {titulo}
      <ProdutoForm modo="criar" categorias={categoriasRes.data} />
    </>
  );
}
