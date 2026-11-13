"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputBase } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { SpinnerIcon } from "@/components/ui/icons";
import {
  EMAIL_MAX_CARACTERES,
  emailValido,
  MENSAGEM_RECUPERACAO_GENERICA,
  normalizarEmail,
  OTP_REENVIO_SEGUNDOS,
} from "@/lib/auth";
import { apiFetch } from "@/lib/http";
import { RedefinirSenhaForm } from "@/app/redefinir-senha/redefinir-senha-form";

export function EsqueciSenhaForm({ emailInicial }: { emailInicial: string }) {
  const [email, setEmail] = useState(emailInicial);
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => {
      setCooldown((valor) => Math.max(0, valor - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroGeral(null);
    setErroEmail(null);
    setSucesso(false);

    const emailNormalizado = normalizarEmail(email);
    if (!emailValido(emailNormalizado)) {
      setErroEmail("Informe um e-mail válido.");
      return;
    }

    setEnviando(true);
    const resultado = await apiFetch<{ status?: string }>(
      "/auth/forgot-password",
      {
        method: "POST",
        body: JSON.stringify({ email: emailNormalizado }),
      },
      { redirecionar401: false },
    );
    setEnviando(false);

    if (!resultado.ok) {
      if (resultado.status === 429) {
        // O contrato alinhado devolve 202 genérico inclusive em cooldown/limite.
        // Se um 429 legado ainda chegar, mantemos a mesma mensagem neutra e o
        // cooldown visual fixo para não revelar conta nem confirmar envio.
        setSucesso(true);
        setCooldown(OTP_REENVIO_SEGUNDOS);
      } else {
        setErroGeral(resultado.message);
      }
      return;
    }

    // A resposta é deliberadamente genérica para não revelar se a conta existe.
    setSucesso(true);
    setCooldown(OTP_REENVIO_SEGUNDOS);
  }

  if (sucesso) {
    return (
      <div className="mt-4">
        <InlineAlert tom="sucesso" className="mb-4">
          {MENSAGEM_RECUPERACAO_GENERICA}
        </InlineAlert>
        <p className="mb-4 text-sm text-muted">
          Não encontrou o e-mail? Confira também as pastas Spam e Lixo eletrônico.
        </p>
        <RedefinirSenhaForm emailInicial={normalizarEmail(email)} />
      </div>
    );
  }

  const hrefRedefinir = emailValido(email)
    ? `/redefinir-senha?email=${encodeURIComponent(normalizarEmail(email))}`
    : "/redefinir-senha";

  return (
    <form onSubmit={enviar} noValidate className="mt-4" aria-busy={enviando}>
      {erroGeral ? (
        <InlineAlert tom="erro" className="mb-4">
          {erroGeral}
        </InlineAlert>
      ) : null}

      {sucesso ? (
        <InlineAlert tom="sucesso" className="mb-4">
          {MENSAGEM_RECUPERACAO_GENERICA}
        </InlineAlert>
      ) : null}

      <Field
        label="E-mail"
        htmlFor="esqueci-email"
        required
        error={erroEmail ?? undefined}
      >
        <input
          id="esqueci-email"
          name="email"
          data-testid="esqueci-email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(evento) => {
            setEmail(evento.target.value);
            setErroEmail(null);
            setSucesso(false);
            setCooldown(0);
          }}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={EMAIL_MAX_CARACTERES}
          disabled={enviando}
          aria-invalid={Boolean(erroEmail) || undefined}
          aria-describedby={erroEmail ? "esqueci-email-error" : undefined}
          className={inputBase}
        />
      </Field>

      <Button
        type="submit"
        data-testid="esqueci-submit"
        disabled={enviando || cooldown > 0}
        tamanho="lg"
        className="mt-5 w-full"
      >
        {enviando ? (
          <SpinnerIcon className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : null}
        {enviando
          ? "Enviando…"
          : cooldown > 0
            ? `Aguarde ${cooldown}s para reenviar`
            : sucesso
              ? "Enviar novamente"
              : "Enviar instruções"}
      </Button>

      <div className="mt-4 rounded-xl bg-pink-50 px-3.5 py-3 text-center text-sm leading-relaxed text-muted">
        {sucesso ? (
          <>
            Tenho um código de redefinição.{" "}
            <Link
              href={hrefRedefinir}
              className="font-semibold text-plum underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
              data-testid="esqueci-redefinir-link"
            >
              Redefinir senha
            </Link>
          </>
        ) : (
          "A resposta é sempre genérica para proteger a privacidade da conta."
        )}
      </div>
    </form>
  );
}
