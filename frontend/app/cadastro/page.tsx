import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthShell } from "@/components/auth/auth-shell";
import { getSession } from "@/lib/session";
import { CadastroForm } from "./cadastro-form";

export const metadata: Metadata = { title: "Criar conta" };
export const dynamic = "force-dynamic";

export default async function CadastroPage() {
  const sessao = await getSession();
  if (sessao.status === "autenticado") redirect("/");

  return (
    <AuthShell
      rodape={
        <p>
          Já tem conta?{" "}
          <Link
            href="/login"
            className="font-semibold text-plum underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
            data-testid="cadastro-login-link"
          >
            Entrar
          </Link>
        </p>
      }
    >
      <AuthCard
        titulo="Criar conta"
        descricao="Crie o acesso do seu negócio e receba um código de verificação no e-mail informado."
      >
        <CadastroForm
          avisoInicial={
            sessao.status === "indisponivel" ? sessao.mensagem : null
          }
        />
      </AuthCard>
    </AuthShell>
  );
}
