"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputBase } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { SpinnerIcon } from "@/components/ui/icons";
import {
  NOME_EMPRESA_MAX_CARACTERES,
  NOME_MAX_CARACTERES,
  nomeEmpresaValido,
  nomeValido,
} from "@/lib/auth";
import { apiFetch } from "@/lib/http";
import { rotuloPerfil } from "@/lib/permissions";
import type { ContaUsuario } from "@/lib/types";

type Campo = "nome" | "nomeUsuario" | "nomeEmpresa";
type Erros = Partial<Record<Campo, string>>;

const NOME_USUARIO_REGEX = /^[a-zA-Z0-9._-]{3,50}$/;

export function DadosContaForm({
  conta,
  podeEditarEmpresa,
}: {
  conta: ContaUsuario;
  podeEditarEmpresa: boolean;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(conta.nome);
  const [nomeUsuario, setNomeUsuario] = useState(conta.nomeUsuario);
  const [nomeEmpresa, setNomeEmpresa] = useState(conta.nomeEmpresa ?? "");
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function limparErro(campo: Campo) {
    setErros((atuais) => {
      if (!atuais[campo]) return atuais;
      const proximos = { ...atuais };
      delete proximos[campo];
      return proximos;
    });
    setSucesso(null);
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroGeral(null);
    setSucesso(null);

    const novosErros: Erros = {};
    if (!nomeValido(nome)) {
      novosErros.nome = `Informe seu nome (${NOME_MAX_CARACTERES} caracteres no máximo).`;
    }
    if (!NOME_USUARIO_REGEX.test(nomeUsuario.trim())) {
      novosErros.nomeUsuario =
        "Use de 3 a 50 caracteres: letras, números, ponto, hífen ou sublinhado.";
    }
    if (podeEditarEmpresa && !nomeEmpresaValido(nomeEmpresa)) {
      novosErros.nomeEmpresa = `Informe o nome da empresa (até ${NOME_EMPRESA_MAX_CARACTERES} caracteres).`;
    }

    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) {
      const primeiro = Object.keys(novosErros)[0];
      const ids: Record<Campo, string> = { nome: "dados-nome", nomeUsuario: "dados-usuario", nomeEmpresa: "dados-empresa" };
      document.getElementById(ids[primeiro as Campo])?.focus();
      return;
    }

    setSalvando(true);
    const corpo: Record<string, string> = {
      nome: nome.trim(),
      nomeUsuario: nomeUsuario.trim().toLowerCase(),
    };
    if (podeEditarEmpresa) corpo.nomeEmpresa = nomeEmpresa.trim();

    const resultado = await apiFetch<ContaUsuario>("/conta", {
      method: "PATCH",
      body: JSON.stringify(corpo),
    });
    setSalvando(false);

    if (!resultado.ok) {
      setErroGeral(resultado.message);
      return;
    }

    setSucesso("Dados atualizados.");
    setNome(resultado.data.nome);
    setNomeUsuario(resultado.data.nomeUsuario);
    if (podeEditarEmpresa) {
      setNomeEmpresa(resultado.data.nomeEmpresa ?? "");
    }
    router.refresh();
  }

  return (
    <form onSubmit={salvar} noValidate className="space-y-4" aria-busy={salvando}>
      {erroGeral ? <InlineAlert tom="erro">{erroGeral}</InlineAlert> : null}
      {sucesso ? <InlineAlert tom="sucesso">{sucesso}</InlineAlert> : null}

      <div className="space-y-4">
        <Field label="Nome" htmlFor="dados-nome" required error={erros.nome}>
          <input
            id="dados-nome"
            name="nome"
            data-testid="dados-nome"
            type="text"
            value={nome}
            onChange={(evento) => {
              setNome(evento.target.value);
              limparErro("nome");
            }}
            autoComplete="name"
            maxLength={NOME_MAX_CARACTERES}
            disabled={salvando}
            aria-invalid={Boolean(erros.nome) || undefined}
            aria-describedby={erros.nome ? "dados-nome-error" : undefined}
            className={inputBase}
          />
        </Field>

        <Field
          label="Nome de usuário"
          htmlFor="dados-usuario"
          required
          hint="Também pode ser usado para entrar no sistema."
          error={erros.nomeUsuario}
        >
          <input
            id="dados-usuario"
            name="nomeUsuario"
            data-testid="dados-usuario"
            type="text"
            value={nomeUsuario}
            onChange={(evento) => {
              setNomeUsuario(evento.target.value);
              limparErro("nomeUsuario");
            }}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={50}
            disabled={salvando}
            aria-invalid={Boolean(erros.nomeUsuario) || undefined}
            aria-describedby={
              erros.nomeUsuario ? "dados-usuario-error" : "dados-usuario-hint"
            }
            className={inputBase}
          />
        </Field>

        {podeEditarEmpresa ? (
          <Field
            label="Nome da empresa"
            htmlFor="dados-empresa"
            required
            hint="Aparece abaixo do logo DONA para toda a equipe."
            error={erros.nomeEmpresa}
          >
            <input
              id="dados-empresa"
              name="nomeEmpresa"
              data-testid="dados-empresa"
              type="text"
              value={nomeEmpresa}
              onChange={(evento) => {
                setNomeEmpresa(evento.target.value);
                limparErro("nomeEmpresa");
              }}
              autoComplete="organization"
              maxLength={NOME_EMPRESA_MAX_CARACTERES}
              disabled={salvando}
              aria-invalid={Boolean(erros.nomeEmpresa) || undefined}
              aria-describedby={
                erros.nomeEmpresa ? "dados-empresa-error" : "dados-empresa-hint"
              }
              className={inputBase}
            />
          </Field>
        ) : null}

        <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-slate-50/60 px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
              E-mail
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-navy">
              {conta.email}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Perfil
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-navy">
              {rotuloPerfil(conta.perfil)}
            </p>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        data-testid="dados-submit"
        disabled={salvando}
        tamanho="lg"
        className="w-full"
      >
        {salvando ? <SpinnerIcon className="h-5 w-5 animate-spin" /> : null}
        {salvando ? "Salvando…" : "Salvar dados"}
      </Button>
    </form>
  );
}
