"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, inputBase } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { SpinnerIcon } from "@/components/ui/icons";
import { EMAIL_MAX_CARACTERES } from "@/lib/auth";
import { apiFetch } from "@/lib/http";
import type { SessionUser } from "@/lib/session";

export function LoginForm({
  destino,
  avisoInicial,
}: {
  destino: string;
  avisoInicial: string | null;
}) {
  const router = useRouter();
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(avisoInicial);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    if (!identificador.trim() || !senha) {
      setErro("Informe usuário ou e-mail e a senha.");
      return;
    }

    setEnviando(true);
    const resultado = await apiFetch<{ user: SessionUser }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          identifier: identificador.trim(),
          password: senha,
        }),
      },
      { redirecionar401: false },
    );
    setEnviando(false);

    if (!resultado.ok) {
      setErro(resultado.message);
      return;
    }

    router.replace(destino);
    router.refresh();
  }

  return (
    <form onSubmit={enviar} noValidate className="mt-4">
      {erro ? (
        <InlineAlert tom="erro" className="mb-4">
          {erro}
        </InlineAlert>
      ) : null}

      <div className="space-y-4">
        <Field label="Usuário ou e-mail" htmlFor="login-identifier" required>
          <input
            id="login-identifier"
            name="identifier"
            data-testid="login-email"
            type="text"
            value={identificador}
            onChange={(evento) => setIdentificador(evento.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="ex.: maria ou maria@dona.org"
            maxLength={EMAIL_MAX_CARACTERES}
            disabled={enviando}
            aria-invalid={Boolean(erro) || undefined}
            className={inputBase}
          />
        </Field>

        <Field label="Senha" htmlFor="login-password" required>
          <PasswordInput
            id="login-password"
            name="password"
            dataTestId="login-password"
            value={senha}
            onChange={setSenha}
            autoComplete="current-password"
            placeholder="Sua senha"
            disabled={enviando}
            invalid={Boolean(erro)}
          />
        </Field>
      </div>

      <Button
        type="submit"
        data-testid="login-submit"
        disabled={enviando}
        tamanho="lg"
        className="mt-5 w-full"
      >
        {enviando ? (
          <SpinnerIcon className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : null}
        {enviando ? "Entrando…" : "Entrar"}
      </Button>

      <div className="mt-4 flex flex-col items-center gap-2 text-sm">
        <Link
          href="/esqueci-senha"
          className="font-semibold text-plum underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
          data-testid="login-forgot"
        >
          Esqueci minha senha
        </Link>
        <p className="text-muted">
          Ainda não tem conta?{" "}
          <Link
            href="/cadastro"
            className="font-semibold text-plum underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
            data-testid="login-register"
          >
            Criar conta
          </Link>
        </p>
      </div>
    </form>
  );
}
