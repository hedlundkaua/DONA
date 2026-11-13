import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthShell } from "@/components/auth/auth-shell";
import { OTP_REENVIO_SEGUNDOS, normalizarEmail } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { VerificarEmailForm } from "./verificar-email-form";

export const metadata: Metadata = { title: "Verificar e-mail" };
export const dynamic = "force-dynamic";

export default async function VerificarEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const email =
    typeof params.email === "string" ? normalizarEmail(params.email) : "";
  const enviado = params.enviado === "1";

  const sessao = await getSession();
  if (sessao.status === "autenticado") redirect("/");

  return (
    <AuthShell
      rodape={
        <p>
          Já verificou?{" "}
          <Link
            href="/login"
            className="font-semibold text-plum underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
            data-testid="verificar-login-link"
          >
            Entrar
          </Link>
        </p>
      }
    >
      <AuthCard
        titulo="Verificar e-mail"
        descricao={
          email
            ? `E-mail informado: ${email}.`
            : "Digite o e-mail do cadastro e o código de 6 dígitos recebido."
        }
      >
        <VerificarEmailForm
          emailInicial={email}
          cooldownInicial={enviado ? OTP_REENVIO_SEGUNDOS : 0}
        />
      </AuthCard>
    </AuthShell>
  );
}
