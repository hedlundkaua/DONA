"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, inputBase } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/badges";
import { EmptyState, InlineAlert } from "@/components/ui/states";
import { PlusIcon, SpinnerIcon, TagIcon } from "@/components/ui/icons";
import { apiFetch } from "@/lib/http";
import type { Categoria } from "@/lib/types";
import { cn } from "@/lib/cn";

type Mensagem = { tom: "erro" | "sucesso"; texto: string } | null;

export function CategoriasManager({
  categorias,
  podeGerir,
}: {
  categorias: Categoria[];
  podeGerir: boolean;
}) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [criando, setCriando] = useState(false);
  const [mensagem, setMensagem] = useState<Mensagem>(null);

  const [edicaoId, setEdicaoId] = useState<number | null>(null);
  const [edicaoNome, setEdicaoNome] = useState("");
  const [processandoId, setProcessandoId] = useState<number | null>(null);

  async function criar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setMensagem(null);
    if (!nome.trim()) {
      setMensagem({ tom: "erro", texto: "Informe o nome da categoria." });
      return;
    }
    if (nome.trim().length > 100) {
      setMensagem({
        tom: "erro",
        texto: "O nome deve ter no máximo 100 caracteres.",
      });
      return;
    }

    setCriando(true);
    const resultado = await apiFetch<Categoria>("/categorias", {
      method: "POST",
      body: JSON.stringify({ nome: nome.trim() }),
    });
    setCriando(false);

    if (!resultado.ok) {
      setMensagem({ tom: "erro", texto: resultado.message });
      return;
    }

    setNome("");
    setMensagem({ tom: "sucesso", texto: "Categoria criada." });
    router.refresh();
  }

  function iniciarEdicao(categoria: Categoria) {
    setMensagem(null);
    setEdicaoId(categoria.id);
    setEdicaoNome(categoria.nome);
  }

  async function salvarEdicao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (edicaoId === null) return;
    setMensagem(null);

    if (!edicaoNome.trim()) {
      setMensagem({ tom: "erro", texto: "Informe o novo nome." });
      return;
    }

    setProcessandoId(edicaoId);
    const resultado = await apiFetch<Categoria>(`/categorias/${edicaoId}`, {
      method: "PATCH",
      body: JSON.stringify({ nome: edicaoNome.trim() }),
    });
    setProcessandoId(null);

    if (!resultado.ok) {
      setMensagem({ tom: "erro", texto: resultado.message });
      return;
    }

    setEdicaoId(null);
    setEdicaoNome("");
    setMensagem({ tom: "sucesso", texto: "Categoria renomeada." });
    router.refresh();
  }

  async function alternarStatus(categoria: Categoria) {
    setMensagem(null);
    setProcessandoId(categoria.id);

    const resultado = categoria.ativo
      ? await apiFetch<{ message?: string }>(`/categorias/${categoria.id}`, {
          method: "DELETE",
        })
      : await apiFetch<Categoria>(`/categorias/${categoria.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ativo: true }),
        });

    setProcessandoId(null);

    if (!resultado.ok) {
      setMensagem({ tom: "erro", texto: resultado.message });
      return;
    }

    setMensagem({
      tom: "sucesso",
      texto: categoria.ativo ? "Categoria inativada." : "Categoria reativada.",
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {mensagem ? (
        <InlineAlert tom={mensagem.tom}>{mensagem.texto}</InlineAlert>
      ) : null}

      {podeGerir ? (
        <Card>
          <CardTitle>Nova categoria</CardTitle>
          <form onSubmit={criar} noValidate className="mt-3 space-y-3">
            <Field label="Nome" htmlFor="categoria-nome" required>
              <input
                id="categoria-nome"
                data-testid="categoria-nome"
                type="text"
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                placeholder="ex.: Salgados"
                maxLength={100}
                disabled={criando}
                className={inputBase}
              />
            </Field>
            <Button
              type="submit"
              data-testid="categoria-salvar"
              disabled={criando}
              className="w-full sm:w-auto"
            >
              {criando ? (
                <SpinnerIcon className="h-4 w-4 animate-spin" />
              ) : (
                <PlusIcon className="h-4 w-4" />
              )}
              {criando ? "Criando…" : "Criar categoria"}
            </Button>
          </form>
        </Card>
      ) : null}

      {categorias.length === 0 ? (
        <EmptyState
          titulo="Nenhuma categoria cadastrada"
          descricao={
            podeGerir
              ? "Crie a primeira categoria para poder cadastrar produtos."
              : "A administração ainda não cadastrou categorias."
          }
          icone={<TagIcon className="h-6 w-6" />}
        />
      ) : (
        <Card className="divide-y divide-line p-0">
          {categorias.map((categoria) => {
            const emEdicao = edicaoId === categoria.id;
            const processando = processandoId === categoria.id;
            const quantidade = categoria._count?.produtos ?? 0;

            return (
              <div key={categoria.id} className="px-4 py-3">
                {emEdicao ? (
                  <form onSubmit={salvarEdicao} className="space-y-2">
                    <label
                      htmlFor={`categoria-edicao-${categoria.id}`}
                      className="text-xs font-semibold text-navy"
                    >
                      Novo nome
                    </label>
                    <input
                      id={`categoria-edicao-${categoria.id}`}
                      value={edicaoNome}
                      onChange={(evento) => setEdicaoNome(evento.target.value)}
                      maxLength={100}
                      disabled={processando}
                      className={cn(inputBase, "h-10 text-sm")}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        tamanho="sm"
                        disabled={processando}
                      >
                        {processando ? (
                          <SpinnerIcon className="h-4 w-4 animate-spin" />
                        ) : null}
                        Salvar
                      </Button>
                      <Button
                        type="button"
                        variante="discreto"
                        tamanho="sm"
                        onClick={() => setEdicaoId(null)}
                        disabled={processando}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-navy">
                        {categoria.nome}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {quantidade}{" "}
                        {quantidade === 1 ? "produto" : "produtos"}
                      </p>
                    </div>
                    <StatusBadge ativo={categoria.ativo} />

                    {podeGerir ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => iniciarEdicao(categoria)}
                          disabled={processando}
                          className="h-9 rounded-full px-2.5 text-xs font-semibold text-plum transition-colors hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40 disabled:opacity-50"
                        >
                          Renomear
                        </button>
                        <button
                          type="button"
                          onClick={() => alternarStatus(categoria)}
                          disabled={processando}
                          className={cn(
                            "h-9 rounded-full px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40 disabled:opacity-50",
                            categoria.ativo
                              ? "text-danger hover:bg-danger/5"
                              : "text-emerald-700 hover:bg-emerald-50",
                          )}
                        >
                          {processando
                            ? "…"
                            : categoria.ativo
                              ? "Inativar"
                              : "Reativar"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {podeGerir ? (
        <p className="px-1 text-xs leading-relaxed text-muted">
          Inativar uma categoria não apaga o histórico. Categorias com produtos
          ativos não podem ser inativadas.
        </p>
      ) : null}
    </div>
  );
}
