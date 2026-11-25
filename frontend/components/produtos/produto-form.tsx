"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, inputBase, selectBase, textareaBase } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { SpinnerIcon } from "@/components/ui/icons";
import { UNIDADES_MEDIDA } from "@/lib/constants";
import { parseDecimal } from "@/lib/format";
import { apiFetch } from "@/lib/http";
import type { Categoria, Produto } from "@/lib/types";
import { cn } from "@/lib/cn";

function paraCampo(valor: string | undefined, casas = 2): string {
  if (valor === undefined || valor === null || valor === "") return "";
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "";
  return numero.toFixed(casas).replace(".", ",");
}

export function ProdutoForm({
  modo,
  categorias,
  produto,
}: {
  modo: "criar" | "editar";
  categorias: Categoria[];
  produto?: Produto;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(produto?.nome ?? "");
  const [categoriaId, setCategoriaId] = useState(
    produto ? String(produto.categoriaId) : "",
  );
  const [unidade, setUnidade] = useState(produto?.unidadeMedida ?? "UNIDADE");
  const [precoCusto, setPrecoCusto] = useState(
    paraCampo(produto?.precoCusto),
  );
  const [precoVenda, setPrecoVenda] = useState(
    paraCampo(produto?.precoVenda),
  );
  const [quantidade, setQuantidade] = useState("0");
  const [estoqueMinimo, setEstoqueMinimo] = useState(
    paraCampo(produto?.estoqueMinimo),
  );
  const [validade, setValidade] = useState(
    produto?.dataValidade ? produto.dataValidade.slice(0, 10) : "",
  );
  const [observacoes, setObservacoes] = useState(produto?.observacoes ?? "");

  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function descricao(id: string, dica?: string) {
    if (erros[id]) return `${id}-error`;
    return dica ? `${id}-hint` : undefined;
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroGeral(null);

    const novosErros: Record<string, string> = {};
    const custo = parseDecimal(precoCusto, 2);
    const venda = parseDecimal(precoVenda, 2);
    const minimo = parseDecimal(estoqueMinimo, 2);
    const quantidadeInicial = parseDecimal(quantidade, 2);

    if (!nome.trim()) {
      novosErros["produto-nome"] = "Informe o nome do produto.";
    } else if (nome.trim().length > 255) {
      novosErros["produto-nome"] = "O nome deve ter no máximo 255 caracteres.";
    }

    if (!categoriaId) {
      novosErros["produto-categoria"] = "Selecione uma categoria.";
    }

    if (custo === null || custo < 0) {
      novosErros["produto-custo"] = "Informe um custo válido (ex.: 12,50).";
    }
    if (venda === null || venda < 0) {
      novosErros["produto-venda"] = "Informe um preço de venda válido.";
    }
    if (
      custo !== null &&
      venda !== null &&
      custo >= 0 &&
      venda >= 0 &&
      venda < custo
    ) {
      novosErros["produto-venda"] =
        "O preço de venda deve ser maior ou igual ao custo.";
    }

    if (minimo === null || minimo < 0) {
      novosErros["produto-minimo"] =
        "Informe o estoque mínimo (0 ou mais).";
    }

    if (modo === "criar" && (quantidadeInicial === null || quantidadeInicial < 0)) {
      novosErros["produto-quantidade"] =
        "Informe uma quantidade inicial válida.";
    }

    if (observacoes.length > 1000) {
      novosErros["produto-observacoes"] =
        "Use no máximo 1.000 caracteres.";
    }

    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) {
      document.getElementById(Object.keys(novosErros)[0])?.focus();
      return;
    }

    const corpo: Record<string, unknown> = {
      nome: nome.trim(),
      categoriaId: Number(categoriaId),
      unidadeMedida: unidade,
      precoCusto: custo,
      precoVenda: venda,
      estoqueMinimo: minimo,
      dataValidade: validade || null,
      observacoes: observacoes.trim() || null,
    };
    if (modo === "criar") corpo.quantidadeEstoque = quantidadeInicial;

    setSalvando(true);
    const resultado = await apiFetch<Produto>(
      modo === "criar" ? "/produtos" : `/produtos/${produto?.id}`,
      {
        method: modo === "criar" ? "POST" : "PATCH",
        body: JSON.stringify(corpo),
      },
    );
    setSalvando(false);

    if (!resultado.ok) {
      if (resultado.message.toLowerCase().includes("preço de venda")) {
        setErros((atual) => ({
          ...atual,
          "produto-venda": resultado.message,
        }));
        document.getElementById("produto-venda")?.focus();
        return;
      }
      setErroGeral(resultado.message);
      return;
    }

    const destino =
      modo === "criar" ? `/produtos/${resultado.data.id}` : `/produtos/${produto?.id}`;
    router.push(destino);
    router.refresh();
  }

  return (
    <form onSubmit={salvar} noValidate className="space-y-4">
      {erroGeral ? <InlineAlert tom="erro">{erroGeral}</InlineAlert> : null}

      <Card>
        <CardTitle>Identificação</CardTitle>
        <div className="mt-3 space-y-4">
          <Field
            label="Nome do produto"
            htmlFor="produto-nome"
            required
            error={erros["produto-nome"]}
            hint="Como o item é conhecido no negócio."
          >
            <input
              id="produto-nome"
              data-testid="produto-nome"
              name="nome"
              type="text"
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              placeholder="ex.: Pastel de carne"
              maxLength={255}
              autoComplete="off"
              disabled={salvando}
              aria-invalid={Boolean(erros["produto-nome"]) || undefined}
              aria-describedby={descricao("produto-nome", "dica")}
              className={inputBase}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Categoria"
              htmlFor="produto-categoria"
              required
              error={erros["produto-categoria"]}
              hint="Somente categorias ativas aceitam produtos ativos."
            >
              <div className="relative">
                <select
                  id="produto-categoria"
                  data-testid="produto-categoria"
                  name="categoriaId"
                  value={categoriaId}
                  onChange={(evento) => setCategoriaId(evento.target.value)}
                  disabled={salvando}
                  aria-invalid={Boolean(erros["produto-categoria"]) || undefined}
                  aria-describedby={descricao("produto-categoria", "dica")}
                  className={cn(selectBase, !categoriaId && "text-muted")}
                >
                  <option value="">Selecione…</option>
                  {categorias.map((categoria) => (
                    <option key={categoria.id} value={String(categoria.id)}>
                      {categoria.nome}
                      {categoria.ativo ? "" : " (inativa)"}
                    </option>
                  ))}
                </select>
                <span
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                >
                  ▾
                </span>
              </div>
            </Field>

            <Field
              label="Unidade de medida"
              htmlFor="produto-unidade"
              hint="Usada nos saldos e nas movimentações."
            >
              <div className="relative">
                <select
                  id="produto-unidade"
                  name="unidadeMedida"
                  value={unidade}
                  onChange={(evento) => setUnidade(evento.target.value)}
                  disabled={salvando}
                  className={selectBase}
                >
                  {UNIDADES_MEDIDA.map((opcao) => (
                    <option key={opcao} value={opcao}>
                      {opcao}
                    </option>
                  ))}
                </select>
                <span
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                >
                  ▾
                </span>
              </div>
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Preços</CardTitle>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field
            label="Preço de custo"
            htmlFor="produto-custo"
            required
            error={erros["produto-custo"]}
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
                R$
              </span>
              <input
                id="produto-custo"
                name="precoCusto"
                type="text"
                inputMode="decimal"
                value={precoCusto}
                onChange={(evento) => setPrecoCusto(evento.target.value)}
                placeholder="0,00"
                disabled={salvando}
                aria-invalid={Boolean(erros["produto-custo"]) || undefined}
                aria-describedby={descricao("produto-custo")}
                className={cn(inputBase, "pl-10")}
              />
            </div>
          </Field>

          <Field
            label="Preço de venda"
            htmlFor="produto-venda"
            required
            error={erros["produto-venda"]}
            hint="Deve ser maior ou igual ao custo."
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
                R$
              </span>
              <input
                id="produto-venda"
                name="precoVenda"
                type="text"
                inputMode="decimal"
                value={precoVenda}
                onChange={(evento) => setPrecoVenda(evento.target.value)}
                placeholder="0,00"
                disabled={salvando}
                aria-invalid={Boolean(erros["produto-venda"]) || undefined}
                aria-describedby={descricao("produto-venda", "dica")}
                className={cn(inputBase, "pl-10")}
              />
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>Estoque</CardTitle>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {modo === "criar" ? (
            <Field
              label="Quantidade inicial"
              htmlFor="produto-quantidade"
              error={erros["produto-quantidade"]}
              hint="Saldo de abertura. Depois use movimentos ou ajustes."
            >
              <div className="relative">
                <input
                  id="produto-quantidade"
                  name="quantidadeEstoque"
                  type="text"
                  inputMode="decimal"
                  value={quantidade}
                  onChange={(evento) => setQuantidade(evento.target.value)}
                  placeholder="0"
                  disabled={salvando}
                  aria-invalid={Boolean(erros["produto-quantidade"]) || undefined}
                  aria-describedby={descricao("produto-quantidade", "dica")}
                  className={cn(inputBase, "pr-20")}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase text-muted">
                  {unidade.toLowerCase()}
                </span>
              </div>
            </Field>
          ) : (
            <div className="rounded-xl border border-line bg-slate-50 p-3.5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Saldo atual
              </p>
              <p className="mt-1 text-2xl font-bold leading-none text-navy">
                {paraCampo(produto?.quantidadeEstoque) || "0"}{" "}
                <span className="text-sm font-semibold uppercase text-muted">
                  {unidade.toLowerCase()}
                </span>
              </p>
              <p className="mt-1.5 text-[11px] leading-snug text-muted">
                O saldo só muda por movimentação ou ajuste de estoque.
              </p>
            </div>
          )}

          <Field
            label="Estoque mínimo"
            htmlFor="produto-minimo"
            required
            error={erros["produto-minimo"]}
            hint="Abaixo deste valor o produto entra em alerta."
          >
            <div className="relative">
              <input
                id="produto-minimo"
                name="estoqueMinimo"
                type="text"
                inputMode="decimal"
                value={estoqueMinimo}
                onChange={(evento) => setEstoqueMinimo(evento.target.value)}
                placeholder="0"
                disabled={salvando}
                aria-invalid={Boolean(erros["produto-minimo"]) || undefined}
                aria-describedby={descricao("produto-minimo", "dica")}
                className={cn(inputBase, "pr-20")}
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase text-muted">
                {unidade.toLowerCase()}
              </span>
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>Complementos</CardTitle>
        <div className="mt-3 space-y-4">
          <Field
            label="Data de validade"
            htmlFor="produto-validade"
            hint="Opcional. Use para itens perecíveis."
          >
            <input
              id="produto-validade"
              name="dataValidade"
              type="date"
              value={validade}
              onChange={(evento) => setValidade(evento.target.value)}
              disabled={salvando}
              className={inputBase}
            />
          </Field>

          <Field
            label="Observações"
            htmlFor="produto-observacoes"
            error={erros["produto-observacoes"]}
            hint="Opcional. Até 1.000 caracteres."
          >
            <textarea
              id="produto-observacoes"
              name="observacoes"
              value={observacoes}
              onChange={(evento) => setObservacoes(evento.target.value)}
              maxLength={1000}
              rows={3}
              disabled={salvando}
              aria-invalid={Boolean(erros["produto-observacoes"]) || undefined}
              aria-describedby={descricao("produto-observacoes", "dica")}
              className={textareaBase}
            />
          </Field>
        </div>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href={produto ? `/produtos/${produto.id}` : "/produtos"}
          className="inline-flex h-12 items-center justify-center rounded-full border border-line px-5 text-sm font-semibold text-navy transition-colors hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
        >
          Cancelar
        </Link>
        <Button
          type="submit"
          data-testid="produto-salvar"
          disabled={salvando}
          tamanho="lg"
        >
          {salvando ? (
            <SpinnerIcon className="h-5 w-5 animate-spin" />
          ) : null}
          {salvando ? "Salvando…" : "Salvar produto"}
        </Button>
      </div>
    </form>
  );
}
