"use client";

import { useState, type FormEvent } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { SpinnerIcon } from "@/components/ui/icons";
import { validarSenha } from "@/lib/auth";
import { apiFetch } from "@/lib/http";

type Campo = "senhaAtual" | "novaSenha" | "confirmarSenha";
type Erros = Partial<Record<Campo, string>>;

export function AlterarSenhaForm() {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
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

    const novosErros: Erros = {};
    if (!senhaAtual) {
      novosErros.senhaAtual = "Informe a senha atual.";
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
      "/auth/password",
      {
        method: "POST",
        body: JSON.stringify({
          currentPassword: senhaAtual,
          newPassword: novaSenha,
        }),
      },
      { redirecionar401: false },
    );
    setEnviando(false);

    if (!resultado.ok) {
      setErroGeral(resultado.message);
      return;
    }

    // O backend revoga todas as sessões, inclusive a atual. Limpa os cookies
    // locais para que o navegador não reutilize CSRF/sessão antigos.
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setSucesso(true);
  }

  if (sucesso) {
    return (
      <div className="mt-4">
        <InlineAlert tom="sucesso">
          Senha alterada. Entre novamente com a nova senha.
        </InlineAlert>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Por segurança, todas as sessões anteriores foram encerradas.
        </p>
        <ButtonLink
          href="/login"
          tamanho="lg"
          className="mt-4 w-full"
          data-testid="senha-ir-login"
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
          label="Senha atual"
          htmlFor="senha-atual"
          required
          error={erros.senhaAtual}
        >
          <PasswordInput
            id="senha-atual"
            name="senhaAtual"
            dataTestId="senha-atual"
            value={senhaAtual}
            onChange={(valor) => {
              setSenhaAtual(valor);
              limparErro("senhaAtual");
            }}
            autoComplete="current-password"
            disabled={enviando}
            invalid={Boolean(erros.senhaAtual)}
            ariaDescribedBy={
              erros.senhaAtual ? "senha-atual-error" : undefined
            }
          />
        </Field>

        <Field
          label="Nova senha"
          htmlFor="senha-nova"
          required
          hint="Pelo menos 8 caracteres. Evite senhas comuns."
          error={erros.novaSenha}
        >
          <PasswordInput
            id="senha-nova"
            name="novaSenha"
            dataTestId="senha-nova"
            value={novaSenha}
            onChange={(valor) => {
              setNovaSenha(valor);
              limparErro("novaSenha");
            }}
            autoComplete="new-password"
            disabled={enviando}
            invalid={Boolean(erros.novaSenha)}
            ariaDescribedBy={
              erros.novaSenha ? "senha-nova-error" : "senha-nova-hint"
            }
          />
        </Field>

        <Field
          label="Confirmar nova senha"
          htmlFor="senha-confirmar"
          required
          error={erros.confirmarSenha}
        >
          <PasswordInput
            id="senha-confirmar"
            name="confirmarSenha"
            dataTestId="senha-confirmar"
            value={confirmarSenha}
            onChange={(valor) => {
              setConfirmarSenha(valor);
              limparErro("confirmarSenha");
            }}
            autoComplete="new-password"
            disabled={enviando}
            invalid={Boolean(erros.confirmarSenha)}
            ariaDescribedBy={
              erros.confirmarSenha ? "senha-confirmar-error" : undefined
            }
          />
        </Field>
      </div>

      <Button
        type="submit"
        data-testid="senha-submit"
        disabled={enviando}
        tamanho="lg"
        className="mt-5 w-full"
      >
        {enviando ? (
          <SpinnerIcon className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : null}
        {enviando ? "Alterando senha…" : "Alterar senha"}
      </Button>
    </form>
  );
}
