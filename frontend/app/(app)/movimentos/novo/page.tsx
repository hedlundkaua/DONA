import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/ui/page-title";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { ButtonLink } from "@/components/ui/button";
import { BoxIcon, PlusIcon } from "@/components/ui/icons";
import { backendFetch } from "@/lib/api";
import {
  apenasSaidas,
  podeGerirCatalogo,
  podeMovimentar,
} from "@/lib/permissions";
import { getSession } from "@/lib/session";
import type { Produto } from "@/lib/types";
import { MovimentoForm } from "./movimento-form";

export const metadata: Metadata = { title: "Nova movimentação" };
export const dynamic = "force-dynamic";

export default async function NovaMovimentacaoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sessao = await getSession();
  const perfil = sessao.status === "autenticado" ? sessao.user.perfil : null;

  const titulo = (
    <PageTitle
      sobretitulo="Movimentos / Novo"
      titulo="Nova movimentação"
      descricao="Registre uma entrada (compra, devolução) ou saída (venda, consumo)."
    />
  );

  if (!podeMovimentar(perfil)) {
    return (
      <>
        {titulo}
        <SemPermissao descricao="Seu perfil não pode registrar movimentações de estoque." />
      </>
    );
  }

  const produtosRes = await backendFetch<Produto[]>("/api/produtos?ativo=true");

  if (!produtosRes.ok) {
    return (
      <>
        {titulo}
        <ErrorState mensagem={produtosRes.message} />
      </>
    );
  }

  const produtos = produtosRes.data.filter((produto) => produto.ativo);

  if (produtos.length === 0) {
    return (
      <>
        {titulo}
        <EmptyState
          titulo="Nenhum produto ativo"
          descricao="Cadastre ou reative um produto antes de movimentar o estoque."
          icone={<BoxIcon className="h-6 w-6" />}
          acao={
            podeGerirCatalogo(perfil) ? (
              <ButtonLink href="/produtos/novo" className="w-full">
                <PlusIcon className="h-4 w-4" />
                Cadastrar produto
              </ButtonLink>
            ) : (
              <Link
                href="/produtos"
                className="inline-flex h-11 items-center justify-center rounded-full border border-line px-5 text-sm font-semibold text-navy"
              >
                Ver produtos
              </Link>
            )
          }
        />
      </>
    );
  }

  const produtoParam =
    typeof params.produto === "string" ? params.produto : "";
  const produtoInicial = produtos.some(
    (produto) => String(produto.id) === produtoParam,
  )
    ? produtoParam
    : "";

  const tipoParam = typeof params.tipo === "string" ? params.tipo : "";
  const tipoInicial =
    apenasSaidas(perfil) || tipoParam !== "ENTRADA" ? "SAIDA" : "ENTRADA";

  return (
    <>
      {titulo}
      <MovimentoForm
        produtos={produtos}
        produtoInicial={produtoInicial}
        tipoInicial={tipoInicial}
        vendedor={apenasSaidas(perfil)}
      />
    </>
  );
}
