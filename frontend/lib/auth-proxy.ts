import { NextRequest, NextResponse } from "next/server";
import { backendUrl } from "@/lib/api";

const ERRO_GENERICO =
  "Não foi possível concluir a solicitação. Tente novamente mais tarde.";

/**
 * Pass-through server-side para endpoints públicos de autenticação.
 * Não exige sessão, não repassa cookies e nunca registra corpo, OTP ou senha.
 */
export async function encaminharAuthPublico(
  req: NextRequest,
  caminho: "register" | "verify-email" | "resend-verification" | "forgot-password" | "reset-password",
) {
  let corpo: string;
  try {
    corpo = await req.text();
  } catch {
    return NextResponse.json(
      { success: false, error: "Requisição inválida." },
      { status: 400 },
    );
  }

  try {
    const resposta = await fetch(`${backendUrl()}/api/auth/${caminho}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": req.headers.get("content-type") ?? "application/json",
      },
      body: corpo,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    const texto = await resposta.text();
    let dados: { success?: boolean; data?: unknown; error?: unknown } | null = null;
    try {
      dados = texto ? JSON.parse(texto) : null;
    } catch {
      dados = null;
    }

    const retryAfter = resposta.headers.get("retry-after");
    const erro =
      typeof dados?.error === "string" && dados.error.trim()
        ? dados.error
        : ERRO_GENERICO;

    if (!resposta.ok || dados?.success === false) {
      const saida = NextResponse.json(
        { success: false, error: erro },
        { status: resposta.status || 502 },
      );
      saida.headers.set("Cache-Control", "no-store");
      if (retryAfter) saida.headers.set("Retry-After", retryAfter);
      return saida;
    }

    const saida = NextResponse.json(
      { success: true, data: dados?.data ?? null },
      { status: resposta.status },
    );
    saida.headers.set("Cache-Control", "no-store");
    if (retryAfter) saida.headers.set("Retry-After", retryAfter);
    return saida;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:
          "Não foi possível conectar ao servidor de autenticação. Tente novamente mais tarde.",
      },
      { status: 502 },
    );
  }
}
