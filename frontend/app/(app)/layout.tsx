import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { NovidadesDialog } from "@/components/shell/novidades-dialog";
import { podeVerFinanceiro } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const sessao = await getSession();

  if (sessao.status === "anonimo") {
    redirect("/login");
  }

  const usuario = sessao.status === "autenticado" ? sessao.user : null;
  const nome = usuario?.nome ?? "Operadora";
  const aviso =
    sessao.status === "indisponivel" ? sessao.mensagem : null;

  return (
    <AppShell
      nome={nome}
      nomeEmpresa={usuario?.nomeEmpresa ?? null}
      perfil={usuario?.perfil ?? null}
      aviso={aviso}
    >
      {usuario ? (
        <NovidadesDialog
          usuarioId={usuario.id}
          podeVerFinanceiro={podeVerFinanceiro(usuario.perfil)}
        />
      ) : null}
      {children}
    </AppShell>
  );
}
