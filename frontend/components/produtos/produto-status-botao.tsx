"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/states";
import { SpinnerIcon } from "@/components/ui/icons";
import { apiFetch } from "@/lib/http";
import type { Produto } from "@/lib/types";

export function ProdutoStatusBotao({
  produto,
}: {
  produto: Pick<Produto, "id" | "ativo">;
}) {
  const router = useRouter();
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function alternar() {
    setErro(null);
    setProcessando(true);
    const resultado = await apiFetch<Produto>(`/produtos/${produto.id}`, {
      method: "PATCH",
      body: JSON.stringify({ ativo: !produto.ativo }),
    });
    setProcessando(false);

    if (!resultado.ok) {
      setErro(resultado.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variante={produto.ativo ? "perigo" : "secundario"}
        onClick={alternar}
        disabled={processando}
        data-testid="produto-status"
        className="w-full"
      >
        {processando ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : null}
        {processando
          ? "Atualizando…"
          : produto.ativo
            ? "Inativar produto"
            : "Reativar produto"}
      </Button>
      {erro ? <InlineAlert tom="erro">{erro}</InlineAlert> : null}
    </div>
  );
}
