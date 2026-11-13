"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { OtpInput } from "@/components/auth/otp-input";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, inputBase } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { SpinnerIcon } from "@/components/ui/icons";
import {
  codigoValido,
  EMAIL_MAX_CARACTERES,
  emailValido,
  MENSAGEM_CADASTRO_GENERICA,
  MENSAGEM_REENVIO_GENERICA,
  mensagemEspera,
  normalizarEmail,
  OTP_MAX_TENTATIVAS,
  OTP_REENVIO_SEGUNDOS,
  OTP_VALIDADE_MINUTOS,
} from "@/lib/auth";
import { apiFetch } from "@/lib/http";

type Aviso = { tom: "sucesso" | "erro" | "atencao" | "info"; texto: string };

export function VerificarEmailForm({
  emailInicial,
  cooldownInicial,
}: {
  emailInicial: string;
  cooldownInicial: number;
}) {
  const [email, setEmail] = useState(emailInicial);
  const [codigo, setCodigo] = useState("");
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [erroCodigo, setErroCodigo] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [avisoReenvio, setAvisoReenvio] = useState<Aviso | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviandoReenvio, setEnviandoReenvio] = useState(false);
  const [cooldown, setCooldown] = useState(cooldownInicial);

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
    setAvisoReenvio(null);

    const emailNormalizado = normalizarEmail(email);
    let invalido = false;

    if (!emailValido(emailNormalizado)) {
      setErroEmail("Informe um e-mail válido.");
      invalido = true;
    }
    if (!codigoValido(codigo)) {
      setErroCodigo("Digite os 6 dígitos do código.");
      invalido = true;
    }
    if (invalido) return;

    setEnviando(true);
    const resultado = await apiFetch<{ status?: string; message?: string }>(
      "/auth/verify-email",
      {
        method: "POST",
        body: JSON.stringify({
          email: emailNormalizado,
          codigo,
        }),
      },
      { redirecionar401: false },
    );
    setEnviando(false);

    if (!resultado.ok) {
      setErroGeral(
        resultado.retryAfterSeconds
          ? mensagemEspera(resultado.retryAfterSeconds)
          : resultado.message,
      );
      return;
    }

    setSucesso(
      resultado.data?.message || "E-mail verificado. Faça login.",
    );
  }

  async function reenviar() {
    setErroEmail(null);
    setAvisoReenvio(null);

    const emailNormalizado = normalizarEmail(email);
    if (!emailValido(emailNormalizado)) {
      setErroEmail("Informe um e-mail válido.");
      return;
    }

    setEnviandoReenvio(true);
    const resultado = await apiFetch<{ status?: string }>(
      "/auth/resend-verification",
      {
        method: "POST",
        body: JSON.stringify({ email: emailNormalizado }),
      },
      { redirecionar401: false },
    );
    setEnviandoReenvio(false);

    if (!resultado.ok) {
      if (resultado.status === 429) {
        // Mesmo em cooldown/limite, a resposta é neutra e o cooldown visual
        // permanece fixo em 60s.
        setCooldown(OTP_REENVIO_SEGUNDOS);
        setAvisoReenvio({ tom: "info", texto: MENSAGEM_REENVIO_GENERICA });
      } else {
        setAvisoReenvio({ tom: "erro", texto: resultado.message });
      }
      return;
    }

    setCooldown(OTP_REENVIO_SEGUNDOS);
    setAvisoReenvio({ tom: "sucesso", texto: MENSAGEM_REENVIO_GENERICA });
  }

  if (sucesso) {
    return (
      <div className="mt-4">
        <InlineAlert tom="sucesso">{sucesso}</InlineAlert>
        <ButtonLink
          href="/login"
          tamanho="lg"
          className="mt-4 w-full"
          data-testid="verificar-ir-login"
        >
          Ir para o login
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate className="mt-4" aria-busy={enviando}>
      {cooldownInicial > 0 ? (
        <InlineAlert tom="info" className="mb-4">
          {MENSAGEM_CADASTRO_GENERICA}
        </InlineAlert>
      ) : null}

      {erroGeral ? (
        <InlineAlert tom="erro" className="mb-4">
          {erroGeral}
        </InlineAlert>
      ) : null}

      <div className="space-y-4">
        <Field
          label="E-mail"
          htmlFor="verificar-email"
          required
          error={erroEmail ?? undefined}
        >
          <input
            id="verificar-email"
            name="email"
            data-testid="verificar-email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(evento) => {
              setEmail(evento.target.value);
              setErroEmail(null);
            }}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={EMAIL_MAX_CARACTERES}
            disabled={enviando || enviandoReenvio}
            aria-invalid={Boolean(erroEmail) || undefined}
            aria-describedby={
              erroEmail ? "verificar-email-error" : undefined
            }
            className={inputBase}
          />
        </Field>

        <Field
          label="Código de verificação"
          htmlFor="verificar-codigo"
          required
          hint={`${OTP_VALIDADE_MINUTOS} minutos de validade; até ${OTP_MAX_TENTATIVAS} tentativas.`}
          error={erroCodigo ?? undefined}
        >
          <OtpInput
            id="verificar-codigo"
            name="codigo"
            dataTestId="verificar-codigo"
            value={codigo}
            onChange={(valor) => {
              setCodigo(valor);
              setErroCodigo(null);
            }}
            disabled={enviando || enviandoReenvio}
            invalid={Boolean(erroCodigo)}
            ariaDescribedBy={
              erroCodigo ? "verificar-codigo-error" : "verificar-codigo-hint"
            }
          />
        </Field>
      </div>

      <Button
        type="submit"
        data-testid="verificar-submit"
        disabled={enviando || enviandoReenvio}
        tamanho="lg"
        className="mt-5 w-full"
      >
        {enviando ? (
          <SpinnerIcon className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : null}
        {enviando ? "Verificando…" : "Verificar e-mail"}
      </Button>

      <div className="mt-4 rounded-xl bg-pink-50 px-3.5 py-3">
        <p className="mb-2 text-xs text-muted">
          Não encontrou o e-mail? Confira também as pastas Spam e Lixo eletrônico.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted">
            Não recebeu o código?
          </span>
          <button
            type="button"
            onClick={reenviar}
            disabled={cooldown > 0 || enviando || enviandoReenvio}
            data-testid="verificar-reenviar"
            className="rounded-full px-2 py-1 text-xs font-semibold text-plum transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40 disabled:cursor-not-allowed disabled:text-muted disabled:opacity-70"
          >
            {enviandoReenvio
              ? "Reenviando…"
              : cooldown > 0
                ? `Reenviar em ${cooldown}s`
                : "Reenviar código"}
          </button>
        </div>
        {avisoReenvio ? (
          <p
            role={avisoReenvio.tom === "erro" ? "alert" : "status"}
            className={
              avisoReenvio.tom === "erro"
                ? "mt-2 text-xs font-medium text-danger"
                : avisoReenvio.tom === "atencao"
                  ? "mt-2 text-xs font-medium text-warning"
                  : avisoReenvio.tom === "info"
                    ? "mt-2 text-xs font-medium text-muted"
                    : "mt-2 text-xs font-medium text-emerald-700"
            }
          >
            {avisoReenvio.texto}
          </p>
        ) : null}
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        O código não é exibido nesta tela nem em links. Se ele expirou, solicite
        um novo acima.{" "}
        <Link
          href="/esqueci-senha"
          className="font-semibold text-plum underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
        >
          Redefinir senha
        </Link>
      </p>
    </form>
  );
}
