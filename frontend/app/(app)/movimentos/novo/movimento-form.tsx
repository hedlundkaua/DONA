"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, inputBase, selectBase, textareaBase } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { CheckIcon, SpinnerIcon } from "@/components/ui/icons";
import { formatQuantidade, parseDecimal } from "@/lib/format";
import { apiFetch } from "@/lib/http";
import type {
  MovimentacaoCriada,
  Produto,
  TipoMovimento,
} from "@/lib/types";
import { cn } from "@/lib/cn";

export function MovimentoForm({
  produtos,
  produtoInicial,
  tipoInicial,
  vendedor,
}: {
  produtos: Produto[];
  produtoInicial: string;
  tipoInicial: TipoMovimento;
  vendedor: boolean;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoMovimento>(tipoInicial);
  const [produtoId, setProdutoId] = useState(produtoInicial);
  const [quantidade, setQuantidade] = useState("");
  const [documento, setDocumento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState<MovimentacaoCriada | null>(null);

  const produto = useMemo(
    () => produtos.find((item) => String(item.id) === produtoId),
    [produtos, produtoId],
  );

  const quantidadeNumero = parseDecimal(quantidade, 2);
  const saldo = produto ? Number(produto.quantidadeEstoque) : 0;
  const saldoDepois =
    produto && quantidadeNumero !== null
      ? tipo === "ENTRADA"
        ? saldo + quantidadeNumero
        : saldo - quantidadeNumero
      : null;
  const insuficiente =
    tipo === "SAIDA" &&
    quantidadeNumero !== null &&
    quantidadeNumero > saldo;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroGeral(null);

    const novosErros: Record<string, string> = {};
    if (!produtoId) {
      novosErros["movimento-produto"] = "Selecione o produto.";
    }
    if (
      quantidadeNumero === null ||
      !Number.isFinite(quantidadeNumero) ||
      quantidadeNumero <= 0
    ) {
      novosErros["movimento-quantidade"] =
        "Informe uma quantidade maior que zero.";
    }
    if (tipo === "SAIDA" && quantidadeNumero !== null && quantidadeNumero > saldo) {
      novosErros["movimento-quantidade"] =
        "A saída não pode ser maior que o saldo atual.";
    }
    if (documento.length > 100) {
      novosErros["movimento-documento"] =
        "Use no máximo 100 caracteres.";
    }
    if (observacoes.length > 1000) {
      novosErros["movimento-observacoes"] =
        "Use no máximo 1.000 caracteres.";
    }

    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) {
      document.getElementById(Object.keys(novosErros)[0])?.focus();
      return;
    }

    setEnviando(true);
    const resultado = await apiFetch<MovimentacaoCriada>(
      "/estoque/movimentacoes",
      {
        method: "POST",
        body: JSON.stringify({
          produtoId: Number(produtoId),
          tipoMovimento: tipo,
          quantidade: quantidadeNumero,
          documentoOrigem: documento.trim() || null,
          observacoes: observacoes.trim() || null,
        }),
      },
    );
    setEnviando(false);

    if (!resultado.ok) {
      setErroGeral(resultado.message);
      return;
    }

    setSucesso(resultado.data);
    router.refresh();
  }

  function nova() {
    setSucesso(null);
    setQuantidade("");
    setDocumento("");
    setObservacoes("");
    setErros({});
    setErroGeral(null);
  }

  if (sucesso) {
    return (
      <div className="space-y-4">
        <Card className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <CheckIcon className="h-6 w-6" />
          </div>
          <h2 className="mt-3 text-lg font-semibold text-navy">
            {tipo === "ENTRADA" ? "Entrada registrada" : "Saída registrada"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {produto?.nome ?? "Produto"} ·{" "}
            {formatQuantidade(
              sucesso.movimentacao.quantidade,
              produto?.unidadeMedida,
            )}
          </p>
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted">
            Saldo atual
          </p>
          <p className="text-3xl font-bold text-navy">
            {formatQuantidade(sucesso.saldoAtual, produto?.unidadeMedida)}
          </p>

          {sucesso.alertaEstoqueBaixo ? (
            <InlineAlert tom="atencao" className="mt-4 text-left">
              O saldo ficou igual ou abaixo do mínimo. Considere repor este
              produto.
            </InlineAlert>
          ) : null}
        </Card>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" onClick={nova} variante="secundario">
            Nova movimentação
          </Button>
          <Link
            href={`/produtos/${sucesso.movimentacao.produtoId}`}
            className="inline-flex h-12 items-center justify-center rounded-full bg-plum px-5 text-sm font-semibold text-white transition-colors hover:bg-plum/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40 focus-visible:ring-offset-2"
          >
            Ver produto
          </Link>
        </div>
        <Link
          href="/movimentos"
          className="block text-center text-xs font-semibold text-plum"
        >
          Ver histórico de movimentações
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {erroGeral ? <InlineAlert tom="erro">{erroGeral}</InlineAlert> : null}

      <Card>
        <fieldset>
          <legend className="text-base font-semibold text-navy">
            Tipo de movimento
          </legend>
          <p className="mt-1 text-xs text-muted">
            {vendedor
              ? "Seu perfil pode registrar apenas saídas."
              : "Entrada soma ao saldo; saída subtrai."}
          </p>

          <div
            className={cn(
              "mt-3 grid gap-2",
              vendedor ? "grid-cols-1" : "grid-cols-2",
            )}
          >
            {!vendedor ? (
              <label
                className={cn(
                  "flex h-12 cursor-pointer items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors focus-within:ring-2 focus-within:ring-pink/40",
                  tipo === "ENTRADA"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                    : "border-line bg-white text-navy hover:bg-pink-50",
                )}
              >
                <input
                  type="radio"
                  name="tipoMovimento"
                  value="ENTRADA"
                  checked={tipo === "ENTRADA"}
                  onChange={() => setTipo("ENTRADA")}
                  disabled={enviando}
                  className="sr-only"
                  data-testid="movimento-tipo-entrada"
                />
                Entrada
              </label>
            ) : null}

            <label
              className={cn(
                "flex h-12 cursor-pointer items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors focus-within:ring-2 focus-within:ring-pink/40",
                tipo === "SAIDA"
                  ? "border-rose-600 bg-rose-50 text-rose-800"
                  : "border-line bg-white text-navy hover:bg-pink-50",
              )}
            >
              <input
                type="radio"
                name="tipoMovimento"
                value="SAIDA"
                checked={tipo === "SAIDA"}
                onChange={() => setTipo("SAIDA")}
                disabled={enviando}
                className="sr-only"
                data-testid="movimento-tipo-saida"
              />
              Saída
            </label>
          </div>
        </fieldset>
      </Card>

      <Card>
        <CardTitle>Produto e quantidade</CardTitle>
        <div className="mt-3 space-y-4">
          <Field
            label="Produto"
            htmlFor="movimento-produto"
            required
            error={erros["movimento-produto"]}
            hint={
              produto
                ? `Saldo atual: ${formatQuantidade(
                    produto.quantidadeEstoque,
                    produto.unidadeMedida,
                  )}`
                : undefined
            }
          >
            <div className="relative">
              <select
                id="movimento-produto"
                data-testid="movimento-produto"
                value={produtoId}
                onChange={(evento) => setProdutoId(evento.target.value)}
                disabled={enviando}
                aria-invalid={Boolean(erros["movimento-produto"]) || undefined}
                aria-describedby={
                  erros["movimento-produto"]
                    ? "movimento-produto-error"
                    : produto
                      ? "movimento-produto-hint"
                      : undefined
                }
                className={cn(selectBase, !produtoId && "text-muted")}
              >
                <option value="">Selecione o produto…</option>
                {produtos.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.nome} — {formatQuantidade(item.quantidadeEstoque)}{" "}
                    {item.unidadeMedida.toLowerCase()}
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
            label="Quantidade"
            htmlFor="movimento-quantidade"
            required
            error={erros["movimento-quantidade"]}
            hint="Use até duas casas decimais (ex.: 2,5)."
          >
            <div className="relative">
              <input
                id="movimento-quantidade"
                data-testid="movimento-quantidade"
                type="text"
                inputMode="decimal"
                value={quantidade}
                onChange={(evento) => setQuantidade(evento.target.value)}
                placeholder="0"
                disabled={enviando}
                aria-invalid={Boolean(erros["movimento-quantidade"]) || undefined}
                aria-describedby={
                  erros["movimento-quantidade"]
                    ? "movimento-quantidade-error"
                    : "movimento-quantidade-hint"
                }
                className={cn(
                  inputBase,
                  "pr-20",
                  insuficiente && "border-danger focus:border-danger",
                )}
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase text-muted">
                {produto?.unidadeMedida.toLowerCase() ?? "un"}
              </span>
            </div>
          </Field>

          {produto && saldoDepois !== null && quantidadeNumero !== null ? (
            <div
              className={cn(
                "rounded-xl border px-3.5 py-3 text-sm",
                insuficiente
                  ? "border-danger/30 bg-danger/5 text-danger"
                  : "border-line bg-pink-50/60 text-navy",
              )}
            >
              <span className="font-semibold">Saldo após: </span>
              {formatQuantidade(saldoDepois, produto.unidadeMedida)}
              {insuficiente ? " — saldo insuficiente." : ""}
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardTitle>Complementos</CardTitle>
        <div className="mt-3 space-y-4">
          <Field
            label="Documento de origem"
            htmlFor="movimento-documento"
            error={erros["movimento-documento"]}
            hint="Opcional: nota fiscal, pedido ou OS."
          >
            <input
              id="movimento-documento"
              type="text"
              value={documento}
              onChange={(evento) => setDocumento(evento.target.value)}
              maxLength={100}
              disabled={enviando}
              placeholder="ex.: NF 1234"
              aria-invalid={Boolean(erros["movimento-documento"]) || undefined}
              aria-describedby={
                erros["movimento-documento"]
                  ? "movimento-documento-error"
                  : "movimento-documento-hint"
              }
              className={inputBase}
            />
          </Field>

          <Field
            label="Observações"
            htmlFor="movimento-observacoes"
            error={erros["movimento-observacoes"]}
            hint="Opcional. Até 1.000 caracteres."
          >
            <textarea
              id="movimento-observacoes"
              value={observacoes}
              onChange={(evento) => setObservacoes(evento.target.value)}
              maxLength={1000}
              rows={3}
              disabled={enviando}
              aria-invalid={Boolean(erros["movimento-observacoes"]) || undefined}
              aria-describedby={
                erros["movimento-observacoes"]
                  ? "movimento-observacoes-error"
                  : "movimento-observacoes-hint"
              }
              className={textareaBase}
            />
          </Field>
        </div>
      </Card>

      <p className="px-1 text-xs leading-relaxed text-muted">
        Perda, avaria ou correção de contagem?{" "}
        <Link href="/ajustes/novo" className="font-semibold text-plum underline-offset-2 hover:underline">
          Use um ajuste de inventário
        </Link>
        .
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href="/movimentos"
          className="inline-flex h-12 items-center justify-center rounded-full border border-line px-5 text-sm font-semibold text-navy transition-colors hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
        >
          Cancelar
        </Link>
        <Button
          type="submit"
          tamanho="lg"
          disabled={enviando || insuficiente}
          data-testid="movimento-salvar"
        >
          {enviando ? (
            <SpinnerIcon className="h-5 w-5 animate-spin" />
          ) : null}
          {enviando
            ? "Registrando…"
            : tipo === "ENTRADA"
              ? "Registrar entrada"
              : "Registrar saída"}
        </Button>
      </div>
    </form>
  );
}
