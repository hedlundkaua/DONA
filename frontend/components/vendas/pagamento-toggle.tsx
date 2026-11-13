"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Controle segmentado “Pago?” da referência mobile. É controlado pelo pai e
 * não decide regras de vencimento; a tela final aplica a condicional.
 */
export function PagamentoToggle({
  pago,
  onChange,
  disabled,
  className,
}: {
  pago: boolean;
  onChange: (pago: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const nome = useId();
  const opcoes = [
    { valor: true, rotulo: "Sim", testId: "venda-pago-sim" },
    { valor: false, rotulo: "Não", testId: "venda-pago-nao" },
  ] as const;

  return (
    <fieldset className={cn("min-w-0", className)} disabled={disabled}>
      <legend className="mb-1.5 block text-sm font-semibold text-navy">
        Pago?
      </legend>
      <div className="grid grid-cols-2 gap-2">
        {opcoes.map(({ valor, rotulo, testId }) => {
          const selecionado = pago === valor;
          return (
            <label
              key={rotulo}
              data-testid={testId}
              className={cn(
                "flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors",
                "focus-within:ring-2 focus-within:ring-pink/40",
                selecionado
                  ? "border-pink bg-pink-50 text-plum"
                  : "border-line bg-white text-navy hover:bg-pink-50/60",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name={nome}
                checked={selecionado}
                onChange={() => onChange(valor)}
                disabled={disabled}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  selecionado ? "border-pink" : "border-line bg-white",
                )}
              >
                {selecionado ? (
                  <span className="h-2.5 w-2.5 rounded-full bg-pink" />
                ) : null}
              </span>
              {rotulo}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
