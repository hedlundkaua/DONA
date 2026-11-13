import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/api";
import { CSRF_COOKIE } from "@/lib/cookies";
import { copiarSetCookie } from "@/lib/server-cookies";
import { lerCookieSessao } from "@/lib/session";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout — revoga a sessão no backend e limpa os cookies. */
export async function POST() {
  const store = await cookies();
  const sessao = await lerCookieSessao();
  const csrf = store.get(CSRF_COOKIE)?.value ?? "";
  const saida = NextResponse.json({
    success: true,
    data: { message: "Sessão encerrada." },
  });

  saida.cookies.set(CSRF_COOKIE, "", { path: "/", maxAge: 0 });

  if (sessao) {
    // Garante o logout no navegador mesmo se o backend recusar a revogação.
    saida.cookies.set(sessao.nome, "", { path: "/", maxAge: 0 });

    try {
      const resposta = await fetch(`${backendUrl()}/api/auth/session`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Cookie: `${sessao.nome}=${sessao.valor}`,
          "x-csrf-token": csrf,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      // Repassa por último para não perder os cookies já definidos acima.
      copiarSetCookie(resposta, saida);
    } catch {
      // Backend indisponível: os cookies locais já foram limpos.
    }
  }

  return saida;
}
