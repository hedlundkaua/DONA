import type { Produto } from "./types";

export function faltaEstoque(produto: Pick<Produto, "estoqueMinimo" | "quantidadeEstoque">): number {
  return Math.max(0, Number(produto.estoqueMinimo) - Number(produto.quantidadeEstoque));
}

export function produtosParaReposicao(produtos: Produto[]): Produto[] {
  return produtos
    .filter((produto) => produto.ativo && Number(produto.quantidadeEstoque) < Number(produto.estoqueMinimo))
    .sort((a, b) => faltaEstoque(b) - faltaEstoque(a) || a.nome.localeCompare(b.nome, "pt-BR"));
}
