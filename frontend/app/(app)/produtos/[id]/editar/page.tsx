import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/ui/page-title";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { ProdutoForm } from "@/components/produtos/produto-form";
import { backendFetch } from "@/lib/api";
import { podeGerirCatalogo } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import type { Categoria, Produto } from "@/lib/types";

export const metadata: Metadata = { title: "Editar produto" };
export const dynamic = "force-dynamic";

export default async function EditarProdutoPage({
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
          sobretitulo="Produtos / Editar"
          titulo="Produto inválido"
          descricao="O identificador informado não é válido."
        />
        <EmptyState
          titulo="Produto não encontrado"
          descricao="Volte para a lista e escolha um produto."
          acao={
            <Link
              href="/produtos"
              className="inline-flex h-11 items-center justify-center rounded-full bg-plum px-5 text-sm font-semibold text-white"
            >
              Ver produtos
            </Link>
          }
        />
      </>
    );
  }

  if (!podeGerirCatalogo(perfil)) {
    return (
      <>
        <PageTitle
          sobretitulo="Produtos / Editar"
          titulo="Editar produto"
        />
        <SemPermissao descricao="Apenas administração e gestão podem editar produtos." />
      </>
    );
  }

  const [produtoRes, categoriasRes] = await Promise.all([
    backendFetch<Produto>(`/api/produtos/${id}`),
    backendFetch<Categoria[]>("/api/categorias"),
  ]);

  if (!produtoRes.ok) {
    return (
      <>
        <PageTitle sobretitulo="Produtos / Editar" titulo="Editar produto" />
        {produtoRes.status === 404 ? (
          <EmptyState
            titulo="Produto não encontrado"
            descricao="Ele pode ter sido removido ou o endereço está incorreto."
            acao={
              <Link
                href="/produtos"
                className="inline-flex h-11 items-center justify-center rounded-full bg-plum px-5 text-sm font-semibold text-white"
              >
                Ver produtos
              </Link>
            }
          />
        ) : (
          <ErrorState mensagem={produtoRes.message} />
        )}
      </>
    );
  }

  if (!categoriasRes.ok) {
    return (
      <>
        <PageTitle sobretitulo="Produtos / Editar" titulo="Editar produto" />
        <ErrorState mensagem={categoriasRes.message} />
      </>
    );
  }

  const produto = produtoRes.data;
  const categorias = categoriasRes.data.filter(
    (categoria) => categoria.ativo || categoria.id === produto.categoriaId,
  );

  return (
    <>
      <PageTitle
        sobretitulo="Produtos / Editar"
        titulo="Editar produto"
        descricao={produto.nome}
      />
      <ProdutoForm modo="editar" produto={produto} categorias={categorias} />
    </>
  );
}
