import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import { ErrorState } from "@/components/ui/states";
import { PlusIcon } from "@/components/ui/icons";
import { backendFetch } from "@/lib/api";
import { podeGerirCatalogo, podeVerCusto } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import type { Categoria, Produto } from "@/lib/types";
import { ProdutosLista } from "./produtos-lista";

export const metadata: Metadata = { title: "Produtos" };
export const dynamic = "force-dynamic";

export default async function ProdutosPage() {
  const sessao = await getSession();
  const perfil = sessao.status === "autenticado" ? sessao.user.perfil : null;
  const podeCriar = podeGerirCatalogo(perfil);

  const [produtosRes, categoriasRes] = await Promise.all([
    backendFetch<Produto[]>("/api/produtos"),
    backendFetch<Categoria[]>("/api/categorias"),
  ]);

  const titulo = (
    <PageTitle
      sobretitulo="Início / Produtos"
      titulo="Produtos"
      descricao="Consulte saldos, preços e situação de cada item da cooperativa."
      acao={
        podeCriar ? (
          <ButtonLink href="/produtos/novo" tamanho="sm">
            <PlusIcon className="h-4 w-4" />
            Novo
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

  return (
    <>
      {titulo}
      <ProdutosLista
        produtos={produtosRes.data}
        categorias={categoriasRes.ok ? categoriasRes.data : []}
        podeCriar={podeCriar}
        podeVerCusto={podeVerCusto(perfil)}
        avisoCategorias={
          categoriasRes.ok
            ? null
            : "Não foi possível carregar as categorias para o filtro."
        }
      />
    </>
  );
}
