"use client";

import { inputBase } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { OTP_DIGITOS, normalizarCodigo } from "@/lib/auth";

export function OtpInput({
  id,
  name,
  value,
  onChange,
  disabled,
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
  dataTestId?: string;
  invalid?: boolean;
  ariaDescribedBy?: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      id={id}
      name={name}
      data-testid={dataTestId}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="one-time-code"
      value={value}
      onChange={(evento) => onChange(normalizarCodigo(evento.target.value))}
      maxLength={OTP_DIGITOS}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-invalid={invalid || undefined}
      aria-describedby={ariaDescribedBy}
      spellCheck={false}
      placeholder="000000"
      className={cn(
        inputBase,
        "text-center text-lg font-semibold tracking-[0.42em] placeholder:tracking-[0.42em]",
      )}
    />
  );
}
