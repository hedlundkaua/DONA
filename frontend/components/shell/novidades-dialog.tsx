"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

const RELEASE = "financeiro-r6";

export function NovidadesDialog({
  usuarioId,
  podeVerFinanceiro,
}: {
  usuarioId: number;
  podeVerFinanceiro: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const storageKey = `dona:novidades:${RELEASE}:usuario:${usuarioId}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    try {
      if (localStorage.getItem(storageKey) === "fechado") return;
    } catch {
      // O diálogo continua utilizável quando o navegador bloqueia o storage.
    }

    if (!dialog.open) dialog.showModal();
  }, [storageKey]);

  function marcarComoVisto() {
    try {
      localStorage.setItem(storageKey, "fechado");
    } catch {
      // Fechar o diálogo não depende da disponibilidade do storage.
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={marcarComoVisto}
      aria-labelledby="novidades-titulo"
      aria-describedby="novidades-descricao"
      className="m-auto max-h-[min(85dvh,42rem)] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-3xl border border-line bg-white p-0 text-navy shadow-2xl backdrop:bg-navy/55 backdrop:backdrop-blur-[2px]"
    >
      <form method="dialog">
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-line bg-white px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-pink">
              Atualização do sistema
            </p>
            <h2 id="novidades-titulo" className="mt-1 text-xl font-bold text-navy">
              Novidades no DONA
            </h2>
          </div>
          <button
            type="submit"
            aria-label="Fechar novidades"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-plum transition-colors hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="px-5 py-5">
          <p id="novidades-descricao" className="text-sm leading-relaxed text-muted">
            Confira o que chegou nesta versão.
          </p>
          <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-relaxed marker:text-pink">
            <li>Nome da empresa no sistema e uma nova área de Meus dados.</li>
            <li>Vendas com Dinheiro, Pix, Cartão e parcelamento.</li>
            {podeVerFinanceiro ? (
              <>
                <li>Financeiro para acompanhar recebimentos e despesas.</li>
                <li>Relatórios para consultar os resultados das vendas.</li>
              </>
            ) : null}
            <li>Lista de reposição com os produtos que precisam de estoque.</li>
          </ul>

          <Button type="submit" tamanho="lg" className="mt-6 w-full" autoFocus>
            Entendi, continuar
          </Button>
        </div>
      </form>
    </dialog>
  );
}
