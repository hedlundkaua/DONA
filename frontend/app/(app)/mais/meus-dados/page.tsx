import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { LockIcon, UserIcon } from "@/components/ui/icons";
import { PageTitle } from "@/components/ui/page-title";
import { ErrorState } from "@/components/ui/states";
import { backendFetch } from "@/lib/api";
import { podeEditarNomeEmpresa } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import type { ContaUsuario } from "@/lib/types";
import { AlterarEmailForm } from "./alterar-email-form";
import { DadosContaForm } from "./dados-conta-form";

export const metadata: Metadata = { title: "Meus dados" };
export const dynamic = "force-dynamic";

export default async function MeusDadosPage() {
  const sessao = await getSession();
  const perfil = sessao.status === "autenticado" ? sessao.user.perfil : null;
  const contaRes = await backendFetch<ContaUsuario>("/api/conta");

  const titulo = (
    <PageTitle
      sobretitulo="Mais / Conta"
      titulo="Meus dados"
      descricao="Atualize seus dados de acesso e o nome da empresa."
    />
  );

  if (!contaRes.ok) {
    return (
      <>
        {titulo}
        <ErrorState mensagem={contaRes.message} />
      </>
    );
  }

  const conta = contaRes.data;

  return (
    <>
      {titulo}

      <div className="space-y-4">
        <Card>
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink">
              <UserIcon className="h-5 w-5" />
            </span>
            <div>
              <CardTitle>Dados da conta</CardTitle>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Nome e usuário são seus. O nome da empresa aparece abaixo do
                logo DONA para toda a equipe.
              </p>
            </div>
          </div>
          <DadosContaForm
            conta={conta}
            podeEditarEmpresa={podeEditarNomeEmpresa(perfil)}
          />
        </Card>

        <Card>
          <div className="mb-4">
            <CardTitle>E-mail de acesso</CardTitle>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Para trocar o e-mail, confirme a senha atual e o código enviado ao
              novo endereço.
            </p>
          </div>
          <AlterarEmailForm emailAtual={conta.email} />
        </Card>

        <Card className="p-0">
          <Link
            href="/mais/senha"
            data-testid="dados-alterar-senha"
            className="flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-colors hover:bg-pink-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pink/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink">
              <LockIcon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-navy">
                Alterar senha
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                Atualize sua senha de acesso. Depois, entre novamente
                com a nova senha.
              </span>
            </span>
          </Link>
        </Card>
      </div>
    </>
  );
}
