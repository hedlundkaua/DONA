import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/api";
import { lerCookieSessao } from "@/lib/session";

export const dynamic = "force-dynamic";

/** GET /api/auth/me — devolve o usuário da sessão validada pelo backend. */
export async function GET() {
  const sessao = await lerCookieSessao();
  if (!sessao) {
    return NextResponse.json(
      { success: false, error: "Autenticação necessária." },
      { status: 401 },
    );
  }

  try {
    const resposta = await fetch(`${backendUrl()}/api/auth/session`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: `${sessao.nome}=${sessao.valor}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    const dados = await resposta.json().catch(() => null);
    return NextResponse.json(dados ?? { success: false, error: "Resposta inválida." }, {
      status: resposta.status,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Servidor de dados indisponível." },
      { status: 502 },
    );
  }
}
