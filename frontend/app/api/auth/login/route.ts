import { NextRequest, NextResponse } from "next/server";
import { backendUrl } from "@/lib/api";
import {
  CSRF_COOKIE,
  maxAgeCsrfDaSessao,
  maxAgeSessao,
} from "@/lib/cookies";
import { copiarSetCookie } from "@/lib/server-cookies";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login
 * Encaminha as credenciais ao backend, repassa o cookie de sessão e guarda
 * o token CSRF em cookie httpOnly (o proxy o injeta nas mutações).
 */
export async function POST(req: NextRequest) {
  let corpo: string;
  try {
    corpo = await req.text();
  } catch {
    return NextResponse.json(
      { success: false, error: "Requisição inválida." },
      { status: 400 },
    );
  }

  // Usado apenas como fallback se o backend ainda não devolver a validade
  // efetiva da sessão. O corpo encaminhado permanece exatamente o original.
  let lembrarDeMim = false;
  try {
    const entrada = JSON.parse(corpo) as { lembrarDeMim?: unknown } | null;
    lembrarDeMim = entrada?.lembrarDeMim === true;
  } catch {
    // O backend valida o JSON; aqui só não há fallback booleano.
  }

  try {
    const resposta = await fetch(`${backendUrl()}/api/auth/login`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: corpo,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    const texto = await resposta.text();
    let dados: {
      success?: boolean;
      data?: {
        user?: unknown;
        csrfToken?: string;
        csrfMaxAgeSeconds?: unknown;
        expiresAt?: unknown;
        session?: { expiresAt?: unknown } | null;
      };
      error?: string;
    } | null = null;
    try {
      dados = texto ? JSON.parse(texto) : null;
    } catch {
      dados = null;
    }

    if (!resposta.ok || !dados?.success) {
      return NextResponse.json(
        dados ?? {
          success: false,
          error: "O servidor de autenticação retornou uma resposta inválida.",
        },
        { status: resposta.status || 502 },
      );
    }

    const maxAge = maxAgeCsrfDaSessao(
      dados.data,
      maxAgeSessao(lembrarDeMim),
    );
    const saida = NextResponse.json({
      success: true,
      data: {
        user: dados.data?.user,
        csrfMaxAgeSeconds: maxAge,
        expiresAt:
          dados.data?.expiresAt ?? dados.data?.session?.expiresAt ?? null,
      },
    });

    if (typeof dados.data?.csrfToken === "string" && dados.data.csrfToken) {
      saida.cookies.set(CSRF_COOKIE, dados.data.csrfToken, {
        httpOnly: true,
        sameSite: "lax",
        secure:
          req.nextUrl.protocol === "https:" ||
          req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https",
        path: "/",
        maxAge,
      });
    }

    // Importante: repassar os cookies do backend por último. `cookies.set`
    // reescreve o header `set-cookie`; se fosse depois, apagaria a sessão.
    copiarSetCookie(resposta, saida);

    return saida;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:
          "Não foi possível conectar ao servidor de autenticação. Confirme se o backend está em execução.",
      },
      { status: 502 },
    );
  }
}
