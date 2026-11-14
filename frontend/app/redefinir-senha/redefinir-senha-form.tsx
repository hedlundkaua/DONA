"use client";

import Link from "next/link";
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
  mensagemEspera,
  normalizarEmail,
  OTP_MAX_TENTATIVAS,
  OTP_VALIDADE_MINUTOS,
  validarSenha,
} from "@/lib/auth";
import { apiFetch } from "@/lib/http";

type Campo = "email" | "codigo" | "novaSenha" | "confirmarSenha";
type Erros = Partial<Record<Campo, string>>;

export function RedefinirSenhaForm({ emailInicial }: { emailInicial: string }) {
  const [email, setEmail] = useState(emailInicial);
  const [codigo, setCodigo] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function limparErro(campo: Campo) {
    setErros((atuais) => {
      if (!atuais[campo]) return atuais;
      const proximos = { ...atuais };
      delete proximos[campo];
      return proximos;
    });
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroGeral(null);

    const emailNormalizado = normalizarEmail(email);
    const novosErros: Erros = {};

    if (!emailValido(emailNormalizado)) {
      novosErros.email = "Informe um e-mail válido.";
    }
    if (!codigoValido(codigo)) {
      novosErros.codigo = "Digite os 6 dígitos do código.";
    }
    const erroSenha = validarSenha(novaSenha);
    if (erroSenha) {
      novosErros.novaSenha = erroSenha;
    }
    if (!confirmarSenha) {
      novosErros.confirmarSenha = "Confirme a nova senha.";
    } else if (confirmarSenha !== novaSenha) {
      novosErros.confirmarSenha = "As senhas não coincidem.";
    }

    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setEnviando(true);
    const resultado = await apiFetch<{ message?: string }>(
      "/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({
          email: emailNormalizado,
          codigo,
          novaSenha,
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
      resultado.data?.message || "Senha alterada. Faça login novamente.",
    );
  }

  if (sucesso) {
    return (
      <div className="mt-4">
        <InlineAlert tom="sucesso">{sucesso}</InlineAlert>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Por segurança, todas as sessões anteriores foram encerradas.
        </p>
        <ButtonLink
          href="/login"
          tamanho="lg"
          className="mt-4 w-full"
          data-testid="redefinir-ir-login"
        >
          Ir para o login
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate className="mt-4" aria-busy={enviando}>
      {erroGeral ? (
        <InlineAlert tom="erro" className="mb-4">
          {erroGeral}
        </InlineAlert>
      ) : null}

      <div className="space-y-4">
        <Field
          label="E-mail"
          htmlFor="redefinir-email"
          required
          error={erros.email}
        >
          <input
            id="redefinir-email"
            name="email"
            data-testid="redefinir-email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(evento) => {
              setEmail(evento.target.value);
              limparErro("email");
            }}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={EMAIL_MAX_CARACTERES}
            disabled={enviando}
            aria-invalid={Boolean(erros.email) || undefined}
            aria-describedby={
              erros.email ? "redefinir-email-error" : undefined
            }
            className={inputBase}
          />
        </Field>

        <Field
          label="Código recebido"
          htmlFor="redefinir-codigo"
          required
          hint={`${OTP_VALIDADE_MINUTOS} minutos de validade; até ${OTP_MAX_TENTATIVAS} tentativas. Confira também as pastas Spam e Lixo eletrônico.`}
          error={erros.codigo}
        >
          <OtpInput
            id="redefinir-codigo"
            name="codigo"
            dataTestId="redefinir-codigo"
            value={codigo}
            onChange={(valor) => {
              setCodigo(valor);
              limparErro("codigo");
            }}
            disabled={enviando}
            invalid={Boolean(erros.codigo)}
            ariaDescribedBy={
              erros.codigo ? "redefinir-codigo-error" : "redefinir-codigo-hint"
            }
          />
        </Field>

        <Field
          label="Nova senha"
          htmlFor="redefinir-senha"
          required
          hint="Pelo menos 8 caracteres. Evite senhas comuns."
          error={erros.novaSenha}
        >
          <PasswordInput
            id="redefinir-senha"
            name="novaSenha"
            dataTestId="redefinir-senha"
            value={novaSenha}
            onChange={(valor) => {
              setNovaSenha(valor);
              limparErro("novaSenha");
            }}
            autoComplete="new-password"
            disabled={enviando}
            invalid={Boolean(erros.novaSenha)}
            ariaDescribedBy={
              erros.novaSenha ? "redefinir-senha-error" : "redefinir-senha-hint"
            }
          />
        </Field>

        <Field
          label="Confirmar nova senha"
          htmlFor="redefinir-confirmar"
          required
          error={erros.confirmarSenha}
        >
          <PasswordInput
            id="redefinir-confirmar"
            name="confirmarSenha"
            dataTestId="redefinir-confirmar-senha"
            value={confirmarSenha}
            onChange={(valor) => {
              setConfirmarSenha(valor);
              limparErro("confirmarSenha");
            }}
            autoComplete="new-password"
            disabled={enviando}
            invalid={Boolean(erros.confirmarSenha)}
            ariaDescribedBy={
              erros.confirmarSenha ? "redefinir-confirmar-error" : undefined
            }
          />
        </Field>
      </div>

      <Button
        type="submit"
        data-testid="redefinir-submit"
        disabled={enviando}
        tamanho="lg"
        className="mt-5 w-full"
      >
        {enviando ? (
          <SpinnerIcon className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : null}
        {enviando ? "Alterando senha…" : "Redefinir senha"}
      </Button>

      <p className="mt-4 text-center text-xs leading-relaxed text-muted">
        O código expirou?{" "}
        <Link
          href="/esqueci-senha"
          className="font-semibold text-plum underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
          data-testid="redefinir-novo-codigo"
        >
          Solicitar outro código
        </Link>
      </p>
    </form>
  );
}
