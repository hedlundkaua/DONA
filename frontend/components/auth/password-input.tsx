"use client";

import { useState } from "react";
import { inputBase } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export function PasswordInput({
  id,
  name,
  value,
  onChange,
  disabled,
  autoComplete,
  placeholder,
  dataTestId,
  invalid,
  ariaDescribedBy,
  autoFocus,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (valor: string) => void;
  disabled?: boolean;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  dataTestId?: string;
  invalid?: boolean;
  ariaDescribedBy?: string;
  autoFocus?: boolean;
}) {
  const [mostrar, setMostrar] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        data-testid={dataTestId}
        type={mostrar ? "text" : "password"}
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedBy}
        className={cn(inputBase, "pr-20")}
      />
      <button
        type="button"
        onClick={() => setMostrar((valor) => !valor)}
        aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={mostrar}
        disabled={disabled}
        data-testid={dataTestId ? `${dataTestId}-toggle` : undefined}
        className="absolute inset-y-0 right-1.5 my-auto h-9 rounded-full px-3 text-xs font-semibold text-plum transition-colors hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40 disabled:opacity-50"
      >
        {mostrar ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}
