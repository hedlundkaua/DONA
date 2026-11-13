"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge, StockBadge } from "@/components/ui/badges";
import { EmptyState, InlineAlert } from "@/components/ui/states";
import {
  BoxIcon,
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
} from "@/components/ui/icons";
import { selectBase } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  formatMoeda,
  formatQuantidade,
  statusEstoque,
} from "@/lib/format";
import type { Categoria, Produto } from "@/lib/types";

type StatusFiltro = "todos" | "baixos" | "inativos";

const filtros: Array<{ valor: StatusFiltro; rotulo: string }> = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "baixos", rotulo: "Estoque baixo" },
  { valor: "inativos", rotulo: "Inativos" },
];

export function ProdutosLista({
  produtos,
  categorias,
  podeCriar,
  podeVerCusto,
  avisoCategorias,
}: {
  produtos: Produto[];
  categorias: Categoria[];
  podeCriar: boolean;
  podeVerCusto: boolean;
  avisoCategorias: string | null;
}) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [status, setStatus] = useState<StatusFiltro>("todos");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos
      .filter((produto) => {
        if (termo) {
          const alvo = `${produto.nome} ${produto.categoria?.nome ?? ""}`.toLowerCase();
          if (!alvo.includes(termo)) return false;
        }
        if (categoria !== "todas" && String(produto.categoriaId) !== categoria) {
          return false;
        }
        if (status === "baixos") {
          return produto.ativo && statusEstoque(produto) !== "normal";
        }
        if (status === "inativos") return !produto.ativo;
        return true;
      })
      .sort((a, b) => {
        if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
        return a.nome.localeCompare(b.nome, "pt-BR");
      });
  }, [produtos, busca, categoria, status]);

  if (produtos.length === 0) {
    return (
      <EmptyState
        titulo="Nenhum produto cadastrado"
        descricao="Cadastre o primeiro item para começar a controlar entradas, saídas e estoque mínimo."
        icone={<BoxIcon className="h-6 w-6" />}
        acao={
          podeCriar ? (
            <ButtonLink href="/produtos/novo" className="w-full">
              <PlusIcon className="h-4 w-4" />
              Cadastrar produto
            </ButtonLink>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Buscar por nome ou categoria"
          aria-label="Buscar produtos"
          className="h-12 w-full rounded-full border border-line bg-white pl-11 pr-4 text-[15px] text-navy placeholder:text-muted/60 focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink/25"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filtros.map((filtro) => (
          <button
            key={filtro.valor}
            type="button"
            aria-pressed={status === filtro.valor}
            onClick={() => setStatus(filtro.valor)}
            className={cn(
              "h-9 rounded-full border px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40",
              status === filtro.valor
                ? "border-plum bg-plum text-white"
                : "border-line bg-white text-navy hover:bg-pink-50",
            )}
          >
            {filtro.rotulo}
          </button>
        ))}

        {categorias.length > 0 ? (
          <div className="ml-auto min-w-40">
            <label htmlFor="filtro-categoria" className="sr-only">
              Filtrar por categoria
            </label>
            <select
              id="filtro-categoria"
              value={categoria}
              onChange={(evento) => setCategoria(evento.target.value)}
              className={cn(selectBase, "h-9 rounded-full text-xs font-semibold")}
            >
              <option value="todas">Todas as categorias</option>
              {categorias.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.nome}
                  {item.ativo ? "" : " (inativa)"}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {avisoCategorias ? (
        <InlineAlert tom="atencao">{avisoCategorias}</InlineAlert>
      ) : null}

      <p className="px-1 text-xs font-medium text-muted" role="status">
        {filtrados.length}{" "}
        {filtrados.length === 1 ? "produto encontrado" : "produtos encontrados"}
      </p>

      {filtrados.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm font-semibold text-navy">
            Nenhum produto com esses filtros
          </p>
          <p className="mt-1 text-xs text-muted">
            Ajuste a busca ou volte para “Todos”.
          </p>
          <button
            type="button"
            onClick={() => {
              setBusca("");
              setCategoria("todas");
              setStatus("todos");
            }}
            className="mt-3 inline-flex h-9 items-center justify-center rounded-full border border-line px-4 text-xs font-semibold text-navy transition-colors hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
          >
            Limpar filtros
          </button>
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {filtrados.map((produto) => {
            const nivel = statusEstoque(produto);
            return (
              <li key={produto.id}>
                <Link
                  href={`/produtos/${produto.id}`}
                  className={cn(
                    "block rounded-2xl border border-line bg-white p-4 shadow-[0_4px_16px_rgba(16,35,92,0.04)] transition-colors hover:border-pink/40 hover:bg-pink-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40",
                    !produto.ativo && "bg-slate-50/70",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold leading-tight text-navy">
                        {produto.nome}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted">
                        {produto.categoria?.nome ?? "Sem categoria"}
                        {podeVerCusto && produto.precoCusto
                          ? ` · custo ${formatMoeda(produto.precoCusto)}`
                          : ""}{" "}
                        · venda {formatMoeda(produto.precoVenda)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {!produto.ativo ? <StatusBadge ativo={false} /> : null}
                      <ChevronRightIcon className="h-4 w-4 text-muted" />
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-2xl font-bold leading-none text-navy">
                        {formatQuantidade(
                          produto.quantidadeEstoque,
                          produto.unidadeMedida,
                        )}
                      </p>
                      <p className="mt-1 text-[11px] text-muted">
                        mínimo{" "}
                        {formatQuantidade(
                          produto.estoqueMinimo,
                          produto.unidadeMedida,
                        )}
                      </p>
                    </div>
                    {produto.ativo ? <StockBadge nivel={nivel} /> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
