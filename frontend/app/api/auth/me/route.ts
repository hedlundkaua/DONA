import { NextRequest, NextResponse } from "next/server";
import { backendUrl } from "@/lib/api";
import {
  CSRF_COOKIE,
  maxAgeCsrfDaSessao,
  SESSION_MAX_AGE_PADRAO,
} from "@/lib/cookies";
import { lerCookieSessao } from "@/lib/session";

export const dynamic = "force-dynamic";

type DadosSessao = {
  success?: boolean;
  data?: {
    user?: unknown;
    csrfToken?: string;
    csrfMaxAgeSeconds?: unknown;
    expiresAt?: unknown;
    session?: { expiresAt?: unknown } | null;
  };
  error?: unknown;
};

function requisicaoSegura(req: NextRequest): boolean {
  return (
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https"
  );
}

/**
 * GET /api/auth/me — devolve o usuário da sessão validada pelo backend e
 * ressincroniza o cookie CSRF com a validade efetiva da sessão. É chamado no
 * carregamento do shell autenticado para que uma sessão "lembrar de mim"
 * continue podendo fazer mutações depois do TTL padrão de 12h.
 */
export async function GET(req: NextRequest) {
  const sessao = await lerCookieSessao();
  if (!sessao) {
    const saida = NextResponse.json(
      { success: false, error: "Autenticação necessária." },
      { status: 401 },
    );
    saida.cookies.set(CSRF_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: requisicaoSegura(req),
      path: "/",
      maxAge: 0,
    });
    return saida;
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

    const dados = (await resposta.json().catch(() => null)) as
      | DadosSessao
      | null;
    const saida = NextResponse.json(
      dados ?? { success: false, error: "Resposta inválida." },
      { status: resposta.status },
    );
    saida.headers.set("Cache-Control", "no-store");

    if (resposta.status === 401) {
      saida.cookies.set(CSRF_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: requisicaoSegura(req),
        path: "/",
        maxAge: 0,
      });
      // A sessão expirou ou foi revogada: remove também o cookie opaco para
      // que o navegador não continue passando pela verificação do proxy.
      saida.cookies.set(sessao.nome, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: requisicaoSegura(req),
        path: "/",
        maxAge: 0,
      });
      return saida;
    }

    const token = dados?.data?.csrfToken;
    if (resposta.ok && dados?.success && typeof token === "string" && token) {
      const maxAge = maxAgeCsrfDaSessao(
        dados.data,
        SESSION_MAX_AGE_PADRAO,
      );
      saida.cookies.set(CSRF_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: requisicaoSegura(req),
        path: "/",
        maxAge,
      });
    }

    return saida;
  } catch {
    return NextResponse.json(
      { success: false, error: "Servidor de dados indisponível." },
      { status: 502 },
    );
  }
}
