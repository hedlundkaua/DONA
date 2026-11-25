import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
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
      {children}
    </AppShell>
  );
}
