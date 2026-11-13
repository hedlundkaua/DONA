import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthShell } from "@/components/auth/auth-shell";
import { normalizarEmail } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { EsqueciSenhaForm } from "./esqueci-senha-form";

export const metadata: Metadata = { title: "Esqueci minha senha" };
export const dynamic = "force-dynamic";

export default async function EsqueciSenhaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const email =
    typeof params.email === "string" ? normalizarEmail(params.email) : "";

  const sessao = await getSession();
  if (sessao.status === "autenticado") redirect("/");

  return (
    <AuthShell
      rodape={
        <p>
          Lembrou a senha?{" "}
          <Link
            href="/login"
            className="font-semibold text-plum underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
            data-testid="esqueci-login-link"
          >
            Entrar
          </Link>
        </p>
      }
    >
      <AuthCard
        titulo="Esqueci minha senha"
        descricao="Informe o e-mail da conta. Se ele existir, enviaremos um código de 6 dígitos para redefinir a senha."
      >
        <EsqueciSenhaForm emailInicial={email} />
      </AuthCard>
    </AuthShell>
  );
}
