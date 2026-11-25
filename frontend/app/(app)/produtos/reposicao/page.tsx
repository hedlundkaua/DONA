import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { StockBadge } from "@/components/ui/badges";
import { ChevronRightIcon } from "@/components/ui/icons";
import { PageTitle } from "@/components/ui/page-title";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { backendFetch } from "@/lib/api";
import { faltaEstoque, produtosParaReposicao } from "@/lib/estoque";
import { formatQuantidade, statusEstoque } from "@/lib/format";
import type { Produto } from "@/lib/types";

export const metadata: Metadata = { title: "Lista de reposição" };
export const dynamic = "force-dynamic";

export default async function ReposicaoPage() {
  const resposta = await backendFetch<Produto[]>("/api/produtos?ativo=true");
  const produtos = resposta.ok ? produtosParaReposicao(resposta.data) : [];
  return (
    <>
      <PageTitle sobretitulo="Produtos / Estoque" titulo="Lista de reposição" descricao="Produtos ativos com saldo abaixo do mínimo, ordenados pela maior quantidade em falta." />
      {!resposta.ok ? <ErrorState mensagem={resposta.message} /> : produtos.length === 0 ? (
        <EmptyState titulo="Tudo abastecido por aqui" descricao="Nenhum produto ativo está abaixo do estoque mínimo." acao={<ButtonLink href="/produtos" variante="secundario">Ver produtos</ButtonLink>} />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted" role="status">{produtos.length} {produtos.length === 1 ? "produto para repor" : "produtos para repor"}</p>
          <Card className="divide-y divide-line p-0">
            {produtos.map((produto) => (
              <Link key={produto.id} href={`/produtos/${produto.id}`} className="flex items-center gap-3 px-4 py-4 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-pink-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pink/40">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold text-navy">{produto.nome}</p>
                  <p className="mt-1 text-xs text-muted">Saldo: {formatQuantidade(produto.quantidadeEstoque, produto.unidadeMedida)} · Mínimo: {formatQuantidade(produto.estoqueMinimo, produto.unidadeMedida)}</p>
                  <p className="mt-1 text-sm font-semibold text-plum">Falta: {formatQuantidade(faltaEstoque(produto), produto.unidadeMedida)}</p>
                </div>
                <StockBadge nivel={statusEstoque(produto)} />
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            ))}
          </Card>
        </div>
      )}
    </>
  );
}
