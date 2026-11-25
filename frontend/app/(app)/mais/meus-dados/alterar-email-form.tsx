"use client";

import { useState, type FormEvent } from "react";
import { OtpInput } from "@/components/auth/otp-input";
import { PasswordInput } from "@/components/auth/password-input";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, inputBase } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { SpinnerIcon } from "@/components/ui/icons";
import {
  codigoValido,
  EMAIL_MAX_CARACTERES,
  emailValido,
  normalizarEmail,
  OTP_MAX_TENTATIVAS,
  OTP_VALIDADE_MINUTOS,
} from "@/lib/auth";
import { apiFetch } from "@/lib/http";

type Etapa = "solicitar" | "confirmar" | "concluido";

export function AlterarEmailForm({ emailAtual }: { emailAtual: string }) {
  const [etapa, setEtapa] = useState<Etapa>("solicitar");
  const [email, setEmail] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [erroCodigo, setErroCodigo] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [emailPendente, setEmailPendente] = useState("");

  async function solicitar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroGeral(null);
    setErroEmail(null);
    setErroSenha(null);

    const normalizado = normalizarEmail(email);
    let invalido = false;
    if (!emailValido(normalizado)) {
      setErroEmail("Informe um e-mail válido.");
      invalido = true;
    } else if (normalizado === emailAtual.trim().toLowerCase()) {
      setErroEmail("Informe um e-mail diferente do atual.");
      invalido = true;
    }
    if (!senhaAtual) {
      setErroSenha("Confirme sua senha atual.");
      invalido = true;
    }
    if (invalido) return;

    setEnviando(true);
    const resultado = await apiFetch<{ message?: string }>("/conta/email", {
      method: "POST",
      body: JSON.stringify({ email: normalizado, senhaAtual }),
    });
    setEnviando(false);

    if (!resultado.ok) {
      setErroGeral(resultado.message);
      return;
    }

    setEmailPendente(normalizado);
    setEmail(normalizado);
    setCodigo("");
    setEtapa("confirmar");
  }

  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroGeral(null);
    setErroCodigo(null);

    if (!codigoValido(codigo)) {
      setErroCodigo("Digite os 6 dígitos do código.");
      return;
    }

    setEnviando(true);
    const resultado = await apiFetch<{ message?: string }>(
      "/conta/email/confirmar",
      {
        method: "POST",
        body: JSON.stringify({ email: emailPendente, codigo }),
      },
    );
    setEnviando(false);

    if (!resultado.ok) {
      setErroGeral(resultado.message);
      return;
    }

    setEtapa("concluido");
  }

  if (etapa === "concluido") {
    return (
      <div className="space-y-3">
        <InlineAlert tom="sucesso">
          E-mail alterado para <strong>{emailPendente}</strong>.
        </InlineAlert>
        <p className="text-xs leading-relaxed text-muted">
          Por segurança, encerramos sua sessão. Entre novamente usando o novo
          endereço.
        </p>
        <ButtonLink
          href={`/login?alterado=1&email=${encodeURIComponent(emailPendente)}`}
          tamanho="lg"
          className="w-full"
          data-testid="email-ir-login"
        >
          Entrar com o novo e-mail
        </ButtonLink>
      </div>
    );
  }

  if (etapa === "confirmar") {
    return (
      <form onSubmit={confirmar} noValidate className="space-y-4" aria-busy={enviando}>
        {erroGeral ? <InlineAlert tom="erro">{erroGeral}</InlineAlert> : null}

        <InlineAlert tom="info">
          Enviamos um código de 6 dígitos para <strong>{emailPendente}</strong>.
          Confira também as pastas Spam e Lixo eletrônico.
        </InlineAlert>

        <Field
          label="Código recebido no novo e-mail"
          htmlFor="email-codigo"
          required
          hint={`${OTP_VALIDADE_MINUTOS} minutos de validade; até ${OTP_MAX_TENTATIVAS} tentativas.`}
          error={erroCodigo ?? undefined}
        >
          <OtpInput
            id="email-codigo"
            name="codigo"
            dataTestId="email-codigo"
            value={codigo}
            onChange={(valor) => {
              setCodigo(valor);
              setErroCodigo(null);
            }}
            disabled={enviando}
            invalid={Boolean(erroCodigo)}
            autoFocus
            ariaDescribedBy={
              erroCodigo ? "email-codigo-error" : "email-codigo-hint"
            }
          />
        </Field>

        <Button
          type="submit"
          data-testid="email-confirmar"
          disabled={enviando}
          tamanho="lg"
          className="w-full"
        >
          {enviando ? <SpinnerIcon className="h-5 w-5 animate-spin" /> : null}
          {enviando ? "Confirmando…" : "Confirmar novo e-mail"}
        </Button>

        <button
          type="button"
          onClick={() => {
            setEtapa("solicitar");
            setErroGeral(null);
            setErroCodigo(null);
          }}
          disabled={enviando}
          className="w-full rounded-full px-3 py-2 text-xs font-semibold text-plum transition-colors hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40 disabled:opacity-50"
        >
          Usar outro e-mail
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={solicitar} noValidate className="space-y-4" aria-busy={enviando}>
      {erroGeral ? <InlineAlert tom="erro">{erroGeral}</InlineAlert> : null}

      <div className="rounded-xl border border-line bg-slate-50/60 px-3.5 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
          E-mail atual
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-navy">
          {emailAtual}
        </p>
      </div>

      <Field
        label="Novo e-mail"
        htmlFor="email-novo"
        required
        error={erroEmail ?? undefined}
      >
        <input
          id="email-novo"
          name="email"
          data-testid="email-novo"
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
          disabled={enviando}
          aria-invalid={Boolean(erroEmail) || undefined}
          aria-describedby={erroEmail ? "email-novo-error" : undefined}
          className={inputBase}
        />
      </Field>

      <Field
        label="Senha atual"
        htmlFor="email-senha-atual"
        required
        hint="Confirmamos sua identidade antes de enviar o código."
        error={erroSenha ?? undefined}
      >
        <PasswordInput
          id="email-senha-atual"
          name="senhaAtual"
          dataTestId="email-senha-atual"
          value={senhaAtual}
          onChange={(valor) => {
            setSenhaAtual(valor);
            setErroSenha(null);
          }}
          autoComplete="current-password"
          disabled={enviando}
          invalid={Boolean(erroSenha)}
          ariaDescribedBy={
            erroSenha ? "email-senha-atual-error" : "email-senha-atual-hint"
          }
        />
      </Field>

      <Button
        type="submit"
        data-testid="email-enviar"
        disabled={enviando}
        tamanho="lg"
        className="w-full"
      >
        {enviando ? <SpinnerIcon className="h-5 w-5 animate-spin" /> : null}
        {enviando ? "Enviando código…" : "Enviar código ao novo e-mail"}
      </Button>

      <p className="text-xs leading-relaxed text-muted">
        O e-mail só muda depois que o código enviado ao novo endereço for
        confirmado. O endereço atual continua válido até lá.
      </p>
    </form>
  );
}
