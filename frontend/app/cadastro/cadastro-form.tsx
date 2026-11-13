"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, inputBase } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { SpinnerIcon } from "@/components/ui/icons";
import {
  EMAIL_MAX_CARACTERES,
  emailValido,
  NOME_MAX_CARACTERES,
  NOME_USUARIO_MAX_CARACTERES,
  NOME_USUARIO_MIN_CARACTERES,
  nomeUsuarioValido,
  nomeValido,
  normalizarEmail,
  validarSenha,
} from "@/lib/auth";
import { apiFetch } from "@/lib/http";

type Campo = "nome" | "nomeUsuario" | "email" | "senha" | "confirmarSenha";
type Erros = Partial<Record<Campo, string>>;

export function CadastroForm({ avisoInicial }: { avisoInicial: string | null }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(avisoInicial);
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

    const dados = {
      nome: nome.trim(),
      nomeUsuario: nomeUsuario.trim(),
      email: normalizarEmail(email),
      senha,
    };

    const novosErros: Erros = {};
    if (!nomeValido(dados.nome)) {
      novosErros.nome = `Informe seu nome (${NOME_MAX_CARACTERES} caracteres no máximo).`;
    }
    if (!nomeUsuarioValido(dados.nomeUsuario)) {
      novosErros.nomeUsuario = `Use de ${NOME_USUARIO_MIN_CARACTERES} a ${NOME_USUARIO_MAX_CARACTERES} caracteres: letras sem acento, números, ponto, sublinhado ou hífen.`;
    }
    if (!emailValido(dados.email)) {
      novosErros.email = "Informe um e-mail válido.";
    }
    const erroSenha = validarSenha(senha);
    if (erroSenha) {
      novosErros.senha = erroSenha;
    }
    if (!confirmarSenha) {
      novosErros.confirmarSenha = "Confirme a senha.";
    } else if (confirmarSenha !== senha) {
      novosErros.confirmarSenha = "As senhas não coincidem.";
    }

    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setEnviando(true);
    const resultado = await apiFetch<{
      status?: string;
      message?: string;
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(dados),
    }, { redirecionar401: false });
    setEnviando(false);

    if (!resultado.ok) {
      if (resultado.status === 429) {
        // Cadastro em cooldown/limite também segue a resposta genérica: não
        // revela existência da conta e leva à etapa de verificação com o mesmo
        // cooldown visual.
        router.replace(
          `/verificar-email?email=${encodeURIComponent(dados.email)}&enviado=1`,
        );
        return;
      }
      setErroGeral(resultado.message);
      return;
    }

    // O backend responde de forma genérica para não revelar se a conta já
    // existia. A próxima tela mantém a mesma postura.
    router.replace(
      `/verificar-email?email=${encodeURIComponent(dados.email)}&enviado=1`,
    );
  }

  return (
    <form onSubmit={enviar} noValidate className="mt-4">
      {erroGeral ? (
        <InlineAlert tom="erro" className="mb-4">
          {erroGeral}
        </InlineAlert>
      ) : null}

      <div className="space-y-4">
        <Field label="Nome" htmlFor="cadastro-nome" required error={erros.nome}>
          <input
            id="cadastro-nome"
            name="nome"
            data-testid="cadastro-nome"
            type="text"
            value={nome}
            onChange={(evento) => {
              setNome(evento.target.value);
              limparErro("nome");
            }}
            autoComplete="name"
            maxLength={NOME_MAX_CARACTERES}
            disabled={enviando}
            aria-invalid={Boolean(erros.nome) || undefined}
            aria-describedby={erros.nome ? "cadastro-nome-error" : undefined}
            className={inputBase}
          />
        </Field>

        <Field
          label="Nome de usuário"
          htmlFor="cadastro-usuario"
          required
          hint={`${NOME_USUARIO_MIN_CARACTERES} a ${NOME_USUARIO_MAX_CARACTERES} caracteres: letras sem acento, números, ponto, sublinhado ou hífen.`}
          error={erros.nomeUsuario}
        >
          <input
            id="cadastro-usuario"
            name="nomeUsuario"
            data-testid="cadastro-usuario"
            type="text"
            value={nomeUsuario}
            onChange={(evento) => {
              setNomeUsuario(evento.target.value);
              limparErro("nomeUsuario");
            }}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            minLength={NOME_USUARIO_MIN_CARACTERES}
            maxLength={NOME_USUARIO_MAX_CARACTERES}
            pattern="[A-Za-z0-9._-]{3,50}"
            disabled={enviando}
            aria-invalid={Boolean(erros.nomeUsuario) || undefined}
            aria-describedby={
              erros.nomeUsuario
                ? "cadastro-usuario-error"
                : "cadastro-usuario-hint"
            }
            className={inputBase}
          />
        </Field>

        <Field label="E-mail" htmlFor="cadastro-email" required error={erros.email}>
          <input
            id="cadastro-email"
            name="email"
            data-testid="cadastro-email"
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
            aria-describedby={erros.email ? "cadastro-email-error" : undefined}
            className={inputBase}
          />
        </Field>

        <Field
          label="Senha"
          htmlFor="cadastro-senha"
          required
          hint="Pelo menos 12 caracteres."
          error={erros.senha}
        >
          <PasswordInput
            id="cadastro-senha"
            name="senha"
            dataTestId="cadastro-senha"
            value={senha}
            onChange={(valor) => {
              setSenha(valor);
              limparErro("senha");
            }}
            autoComplete="new-password"
            disabled={enviando}
            invalid={Boolean(erros.senha)}
            ariaDescribedBy={
              erros.senha ? "cadastro-senha-error" : "cadastro-senha-hint"
            }
          />
        </Field>

        <Field
          label="Confirmar senha"
          htmlFor="cadastro-confirmar"
          required
          error={erros.confirmarSenha}
        >
          <PasswordInput
            id="cadastro-confirmar"
            name="confirmarSenha"
            dataTestId="cadastro-confirmar-senha"
            value={confirmarSenha}
            onChange={(valor) => {
              setConfirmarSenha(valor);
              limparErro("confirmarSenha");
            }}
            autoComplete="new-password"
            disabled={enviando}
            invalid={Boolean(erros.confirmarSenha)}
            ariaDescribedBy={
              erros.confirmarSenha ? "cadastro-confirmar-error" : undefined
            }
          />
        </Field>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Sua conta terá acesso de administração ao próprio negócio. A verificação
        do e-mail é obrigatória antes do primeiro acesso.
      </p>

      <Button
        type="submit"
        data-testid="cadastro-submit"
        disabled={enviando}
        tamanho="lg"
        className="mt-5 w-full"
      >
        {enviando ? (
          <SpinnerIcon className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : null}
        {enviando ? "Enviando cadastro…" : "Criar conta"}
      </Button>
    </form>
  );
}
