"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, inputBase, selectBase, textareaBase } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { CheckIcon, SpinnerIcon } from "@/components/ui/icons";
import { MOTIVOS_AJUSTE } from "@/lib/constants";
import { formatQuantidade, parseDecimal } from "@/lib/format";
import { apiFetch } from "@/lib/http";
import type { Ajuste, Produto } from "@/lib/types";
import { cn } from "@/lib/cn";

export function AjusteForm({
  produtos,
  produtoInicial,
}: {
  produtos: Produto[];
  produtoInicial: string;
}) {
  const router = useRouter();
  const [produtoId, setProdutoId] = useState(produtoInicial);
  const [contada, setContada] = useState("");
  const [motivo, setMotivo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [ajuste, setAjuste] = useState<Ajuste | null>(null);

  const produto = useMemo(
    () => produtos.find((item) => String(item.id) === produtoId),
    [produtos, produtoId],
  );

  const sistema = produto ? Number(produto.quantidadeEstoque) : null;
  const contadaNumero = parseDecimal(contada, 2);
  const diferenca =
    sistema !== null && contadaNumero !== null ? contadaNumero - sistema : null;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroGeral(null);

    const novosErros: Record<string, string> = {};
    if (!produtoId) {
      novosErros["ajuste-produto"] = "Selecione o produto.";
    }
    if (contadaNumero === null || contadaNumero < 0) {
      novosErros["ajuste-contada"] =
        "Informe a quantidade contada (0 ou mais).";
    }
    if (!motivo.trim()) {
      novosErros["ajuste-motivo"] = "Informe o motivo do ajuste.";
    }
    if (observacoes.length > 1000) {
      novosErros["ajuste-observacoes"] = "Use no máximo 1.000 caracteres.";
    }

    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) {
      document.getElementById(Object.keys(novosErros)[0])?.focus();
      return;
    }

    setEnviando(true);
    const resultado = await apiFetch<Ajuste>("/estoque/ajustes", {
      method: "POST",
      body: JSON.stringify({
        produtoId: Number(produtoId),
        quantidadeContada: contadaNumero,
        motivo: motivo.trim(),
        observacoes: observacoes.trim() || null,
      }),
    });
    setEnviando(false);

    if (!resultado.ok) {
      setErroGeral(resultado.message);
      return;
    }

    setAjuste(resultado.data);
    router.refresh();
  }

  if (ajuste) {
    const diferencaFinal = Number(ajuste.diferenca);
    return (
      <div className="space-y-4">
        <Card className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <CheckIcon className="h-6 w-6" />
          </div>
          <h2 className="mt-3 text-lg font-semibold text-navy">
            Ajuste registrado
          </h2>
          <p className="mt-1 text-sm text-muted">
            {ajuste.produto?.nome ?? produto?.nome ?? "Produto"}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Sistema
              </p>
              <p className="mt-0.5 text-sm font-bold text-navy">
                {formatQuantidade(ajuste.quantidadeSistema)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Contado
              </p>
              <p className="mt-0.5 text-sm font-bold text-navy">
                {formatQuantidade(ajuste.quantidadeContada)}
              </p>
            </div>
            <div
              className={cn(
                "rounded-xl p-2.5",
                diferencaFinal > 0
                  ? "bg-emerald-50"
                  : diferencaFinal < 0
                    ? "bg-rose-50"
                    : "bg-slate-50",
              )}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Diferença
              </p>
              <p
                className={cn(
                  "mt-0.5 text-sm font-bold",
                  diferencaFinal > 0
                    ? "text-emerald-700"
                    : diferencaFinal < 0
                      ? "text-rose-700"
                      : "text-muted",
                )}
              >
                {diferencaFinal > 0 ? "+" : ""}
                {formatQuantidade(diferencaFinal)}
              </p>
            </div>
          </div>

          {diferencaFinal === 0 ? (
            <InlineAlert tom="info" className="mt-4 text-left">
              A diferença foi zero: o ajuste fica registrado para auditoria e o
              saldo permanece o mesmo.
            </InlineAlert>
          ) : (
            <p className="mt-4 text-xs text-muted">
              O saldo do produto foi atualizado para{" "}
              {formatQuantidade(
                ajuste.quantidadeContada,
                produto?.unidadeMedida,
              )}
              .
            </p>
          )}
        </Card>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variante="secundario"
            onClick={() => {
              setAjuste(null);
              setContada("");
              setMotivo("");
              setObservacoes("");
            }}
          >
            Novo ajuste
          </Button>
          <Link
            href={`/produtos/${ajuste.produtoId}`}
            className="inline-flex h-12 items-center justify-center rounded-full bg-plum px-5 text-sm font-semibold text-white transition-colors hover:bg-plum/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40 focus-visible:ring-offset-2"
          >
            Ver produto
          </Link>
        </div>
        <Link
          href="/ajustes"
          className="block text-center text-xs font-semibold text-plum"
        >
          Ver histórico de ajustes
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {erroGeral ? <InlineAlert tom="erro">{erroGeral}</InlineAlert> : null}

      <Card>
        <CardTitle>Produto</CardTitle>
        <div className="mt-3">
          <Field
            label="Produto conferido"
            htmlFor="ajuste-produto"
            required
            error={erros["ajuste-produto"]}
            hint={
              produto
                ? `Saldo no sistema: ${formatQuantidade(
                    produto.quantidadeEstoque,
                    produto.unidadeMedida,
                  )}`
                : undefined
            }
          >
            <div className="relative">
              <select
                id="ajuste-produto"
                data-testid="ajuste-produto"
                value={produtoId}
                onChange={(evento) => setProdutoId(evento.target.value)}
                disabled={enviando}
                aria-invalid={Boolean(erros["ajuste-produto"]) || undefined}
                aria-describedby={
                  erros["ajuste-produto"]
                    ? "ajuste-produto-error"
                    : produto
                      ? "ajuste-produto-hint"
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
        </div>
      </Card>

      <Card>
        <CardTitle>Contagem</CardTitle>
        <div className="mt-3 space-y-4">
          <Field
            label="Quantidade contada"
            htmlFor="ajuste-contada"
            required
            error={erros["ajuste-contada"]}
            hint="Quantidade física encontrada na conferência."
          >
            <div className="relative">
              <input
                id="ajuste-contada"
                data-testid="ajuste-contada"
                type="text"
                inputMode="decimal"
                value={contada}
                onChange={(evento) => setContada(evento.target.value)}
                placeholder="0"
                disabled={enviando}
                aria-invalid={Boolean(erros["ajuste-contada"]) || undefined}
                aria-describedby={
                  erros["ajuste-contada"]
                    ? "ajuste-contada-error"
                    : "ajuste-contada-hint"
                }
                className={cn(inputBase, "pr-20")}
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase text-muted">
                {produto?.unidadeMedida.toLowerCase() ?? "un"}
              </span>
            </div>
          </Field>

          {produto && sistema !== null ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-line p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                  Sistema
                </p>
                <p className="mt-0.5 text-sm font-bold text-navy">
                  {formatQuantidade(sistema)}
                </p>
              </div>
              <div className="rounded-xl border border-line p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                  Contada
                </p>
                <p className="mt-0.5 text-sm font-bold text-navy">
                  {contadaNumero === null ? "—" : formatQuantidade(contadaNumero)}
                </p>
              </div>
              <div
                className={cn(
                  "rounded-xl border p-2.5",
                  diferenca === null
                    ? "border-line"
                    : diferenca > 0
                      ? "border-emerald-200 bg-emerald-50"
                      : diferenca < 0
                        ? "border-rose-200 bg-rose-50"
                        : "border-line bg-slate-50",
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                  Diferença
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-sm font-bold",
                    diferenca === null
                      ? "text-muted"
                      : diferenca > 0
                        ? "text-emerald-700"
                        : diferenca < 0
                          ? "text-rose-700"
                          : "text-muted",
                  )}
                >
                  {diferenca === null
                    ? "—"
                    : `${diferenca > 0 ? "+" : ""}${formatQuantidade(diferenca)}`}
                </p>
              </div>
            </div>
          ) : null}

          {diferenca === 0 ? (
            <InlineAlert tom="info">
              A diferença é zero. O ajuste será registrado para auditoria, sem
              alterar o saldo.
            </InlineAlert>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardTitle>Justificativa</CardTitle>
        <div className="mt-3 space-y-4">
          <Field
            label="Motivo"
            htmlFor="ajuste-motivo"
            required
            error={erros["ajuste-motivo"]}
            hint="Ex.: conferência física, avaria, vencimento."
          >
            <input
              id="ajuste-motivo"
              data-testid="ajuste-motivo"
              type="text"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              list="motivos-ajuste"
              maxLength={500}
              disabled={enviando}
              placeholder="Descreva o motivo"
              aria-invalid={Boolean(erros["ajuste-motivo"]) || undefined}
              aria-describedby={
                erros["ajuste-motivo"]
                  ? "ajuste-motivo-error"
                  : "ajuste-motivo-hint"
              }
              className={inputBase}
            />
            <datalist id="motivos-ajuste">
              {MOTIVOS_AJUSTE.map((sugestao) => (
                <option key={sugestao} value={sugestao} />
              ))}
            </datalist>
          </Field>

          <Field
            label="Observações"
            htmlFor="ajuste-observacoes"
            error={erros["ajuste-observacoes"]}
            hint="Opcional. Até 1.000 caracteres."
          >
            <textarea
              id="ajuste-observacoes"
              value={observacoes}
              onChange={(evento) => setObservacoes(evento.target.value)}
              maxLength={1000}
              rows={3}
              disabled={enviando}
              aria-invalid={Boolean(erros["ajuste-observacoes"]) || undefined}
              aria-describedby={
                erros["ajuste-observacoes"]
                  ? "ajuste-observacoes-error"
                  : "ajuste-observacoes-hint"
              }
              className={textareaBase}
            />
          </Field>
        </div>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href="/ajustes"
          className="inline-flex h-12 items-center justify-center rounded-full border border-line px-5 text-sm font-semibold text-navy transition-colors hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
        >
          Cancelar
        </Link>
        <Button
          type="submit"
          tamanho="lg"
          disabled={enviando}
          data-testid="ajuste-salvar"
        >
          {enviando ? (
            <SpinnerIcon className="h-5 w-5 animate-spin" />
          ) : null}
          {enviando ? "Registrando…" : "Registrar ajuste"}
        </Button>
      </div>
    </form>
  );
}
