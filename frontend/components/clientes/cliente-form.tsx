"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, inputBase } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { SpinnerIcon } from "@/components/ui/icons";
import { apiFetch } from "@/lib/http";
import type { Cliente } from "@/lib/types";
import { cn } from "@/lib/cn";

function telefoneDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function ClienteForm({
  modo,
  cliente,
}: {
  modo: "criar" | "editar";
  cliente?: Cliente;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(cliente?.nome ?? "");
  const [whatsapp, setWhatsapp] = useState(cliente?.whatsapp ?? "");
  const [instagram, setInstagram] = useState(cliente?.instagram ?? "");
  const [ativo, setAtivo] = useState(cliente?.ativo ?? true);

  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function descricao(id: string, dica?: string) {
    if (erros[id]) return `${id}-error`;
    return dica ? `${id}-hint` : undefined;
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroGeral(null);

    const novosErros: Record<string, string> = {};
    const nomeLimpo = nome.trim();
    const instagramLimpo = instagram.trim().replace(/^@/, "");
    const digitos = telefoneDigitos(whatsapp);

    if (nomeLimpo.length < 2) {
      novosErros["cliente-nome"] = "Informe o nome do cliente.";
    } else if (nomeLimpo.length > 150) {
      novosErros["cliente-nome"] = "O nome deve ter no máximo 150 caracteres.";
    }

    if (!whatsapp.trim()) {
      novosErros["cliente-whatsapp"] = "Informe o WhatsApp com DDD.";
    } else if (digitos.length < 10 || digitos.length > 13) {
      novosErros["cliente-whatsapp"] =
        "Informe um número brasileiro com DDD (10 ou 11 dígitos).";
    }

    if (
      instagramLimpo &&
      !/^[A-Za-z0-9._]{1,30}$/.test(instagramLimpo)
    ) {
      novosErros["cliente-instagram"] =
        "Use até 30 caracteres: letras, números, ponto ou sublinhado.";
    }

    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) {
      document.getElementById(Object.keys(novosErros)[0])?.focus();
      return;
    }

    const corpo: Record<string, unknown> = {
      nome: nomeLimpo,
      whatsapp: whatsapp.trim(),
      instagram: instagramLimpo || null,
    };
    if (modo === "editar") corpo.ativo = ativo;

    setSalvando(true);
    const resultado = await apiFetch<Cliente>(
      modo === "criar" ? "/clientes" : `/clientes/${cliente?.id}`,
      {
        method: modo === "criar" ? "POST" : "PATCH",
        body: JSON.stringify(corpo),
      },
    );
    setSalvando(false);

    if (!resultado.ok) {
      const mensagem = resultado.message;
      if (mensagem.toLowerCase().includes("whatsapp")) {
        setErros({ "cliente-whatsapp": mensagem });
        document.getElementById("cliente-whatsapp")?.focus();
        return;
      }
      if (mensagem.toLowerCase().includes("instagram")) {
        setErros({ "cliente-instagram": mensagem });
        document.getElementById("cliente-instagram")?.focus();
        return;
      }
      if (mensagem.toLowerCase().includes("nome")) {
        setErros({ "cliente-nome": mensagem });
        document.getElementById("cliente-nome")?.focus();
        return;
      }
      setErroGeral(mensagem);
      return;
    }

    router.push("/clientes");
    router.refresh();
  }

  return (
    <form onSubmit={salvar} noValidate className="space-y-4" data-testid="cliente-form">
      {erroGeral ? <InlineAlert tom="erro">{erroGeral}</InlineAlert> : null}

      <Card>
        <CardTitle>Contato</CardTitle>
        <p className="mt-1 text-xs text-muted">
          O sistema normaliza o WhatsApp brasileiro para o formato internacional
          +55.
        </p>

        <div className="mt-3 space-y-4">
          <Field
            label="Nome"
            htmlFor="cliente-nome"
            required
            error={erros["cliente-nome"]}
            hint="Nome pelo qual o cliente é conhecido."
          >
            <input
              id="cliente-nome"
              data-testid="cliente-nome"
              name="nome"
              type="text"
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              placeholder="ex.: Maria Souza"
              maxLength={150}
              autoComplete="name"
              disabled={salvando}
              aria-invalid={Boolean(erros["cliente-nome"]) || undefined}
              aria-describedby={descricao("cliente-nome", "dica")}
              className={inputBase}
            />
          </Field>

          <Field
            label="WhatsApp"
            htmlFor="cliente-whatsapp"
            required
            error={erros["cliente-whatsapp"]}
            hint="Com DDD. Pode digitar máscara, por exemplo (51) 99999-9999."
          >
            <input
              id="cliente-whatsapp"
              data-testid="cliente-whatsapp"
              name="whatsapp"
              type="tel"
              inputMode="tel"
              value={whatsapp}
              onChange={(evento) => setWhatsapp(evento.target.value)}
              placeholder="(51) 99999-9999"
              maxLength={20}
              autoComplete="tel"
              disabled={salvando}
              aria-invalid={Boolean(erros["cliente-whatsapp"]) || undefined}
              aria-describedby={descricao("cliente-whatsapp", "dica")}
              className={inputBase}
            />
          </Field>

          <Field
            label="Instagram"
            htmlFor="cliente-instagram"
            error={erros["cliente-instagram"]}
            hint="Opcional. Pode informar com ou sem @."
          >
            <input
              id="cliente-instagram"
              data-testid="cliente-instagram"
              name="instagram"
              type="text"
              value={instagram}
              onChange={(evento) => setInstagram(evento.target.value)}
              placeholder="@perfil"
              maxLength={31}
              autoComplete="off"
              disabled={salvando}
              aria-invalid={Boolean(erros["cliente-instagram"]) || undefined}
              aria-describedby={descricao("cliente-instagram", "dica")}
              className={inputBase}
            />
          </Field>
        </div>
      </Card>

      {modo === "editar" ? (
        <Card>
          <CardTitle>Situação</CardTitle>
          <label
            htmlFor="cliente-ativo"
            className={cn(
              "mt-3 flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
              ativo ? "border-emerald-200 bg-emerald-50/60" : "border-line bg-slate-50",
              salvando && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              id="cliente-ativo"
              data-testid="cliente-ativo"
              name="ativo"
              type="checkbox"
              checked={ativo}
              onChange={(evento) => setAtivo(evento.target.checked)}
              disabled={salvando}
              className="mt-0.5 h-5 w-5 shrink-0 accent-pink"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-navy">
                Cliente ativo
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                Desativar mantém o histórico de vendas, mas impede novas vendas
                para este cliente.
              </span>
            </span>
          </label>
        </Card>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button
          type="submit"
          className="w-full sm:flex-1"
          disabled={salvando}
          data-testid="cliente-salvar"
        >
          {salvando ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : null}
          {modo === "criar" ? "Cadastrar cliente" : "Salvar alterações"}
        </Button>
        <ButtonLink href="/clientes" variante="secundario" className="w-full sm:flex-1">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
