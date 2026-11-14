import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthShell } from "@/components/auth/auth-shell";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const bruto = typeof params.next === "string" ? params.next : "/";
  const destino = bruto.startsWith("/") && !bruto.startsWith("//") ? bruto : "/";

  const sessao = await getSession();
  if (sessao.status === "autenticado") redirect(destino);

  return (
    <AuthShell
      rodape={
        <p>
          Ainda não verificou o e-mail?{" "}
          <Link
            href="/verificar-email"
            className="font-semibold text-plum underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
            data-testid="login-verify-email"
          >
            Reenviar instruções
          </Link>
        </p>
      }
    >
      <AuthCard
        titulo="Entrar na conta"
        descricao="Use seu e-mail e a sua senha. Contas antigas também podem entrar com o usuário."
      >
        <LoginForm
          destino={destino}
          avisoInicial={
            sessao.status === "indisponivel" ? sessao.mensagem : null
          }
        />
      </AuthCard>
    </AuthShell>
  );
}
