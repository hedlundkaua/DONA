import { cache } from "react";
import { cookies } from "next/headers";
import { backendUrl } from "./api";
import { SESSION_COOKIE_NAMES } from "./cookies";

export interface SessionUser {
  id: number;
  nome: string;
  nomeUsuario: string;
  email: string;
  perfil: string;
  ativo: boolean;
}

export type Sessao =
  | {
      status: "autenticado";
      user: SessionUser;
      csrfToken: string;
      csrfMaxAgeSeconds?: number;
      expiresAt?: string;
    }
  | { status: "anonimo" }
  | { status: "indisponivel"; mensagem: string };

export interface CookieSessao {
  nome: (typeof SESSION_COOKIE_NAMES)[number];
  valor: string;
}

/** Lê o cookie de sessão do backend sem validar (para encaminhar ao backend). */
export async function lerCookieSessao(): Promise<CookieSessao | null> {
  const store = await cookies();
  for (const nome of SESSION_COOKIE_NAMES) {
    const valor = store.get(nome)?.value;
    if (valor) return { nome, valor };
  }
  return null;
}

/**
 * Valida a sessão diretamente no backend (`GET /api/auth/session`).
 * O cache do React deduplica a chamada entre layout e página na mesma requisição.
 */
export const getSession = cache(async (): Promise<Sessao> => {
  const cookie = await lerCookieSessao();
  if (!cookie) return { status: "anonimo" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const resposta = await fetch(`${backendUrl()}/api/auth/session`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: `${cookie.nome}=${cookie.valor}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (resposta.status === 401) return { status: "anonimo" };

    const corpo = (await resposta.json().catch(() => null)) as
      | {
          success?: boolean;
          data?: {
            user?: SessionUser;
            csrfToken?: string;
            csrfMaxAgeSeconds?: unknown;
            expiresAt?: unknown;
            session?: { expiresAt?: unknown } | null;
          };
          error?: string;
        }
      | null;

    if (!resposta.ok || !corpo?.success || !corpo.data?.user) {
      return {
        status: "indisponivel",
        mensagem:
          corpo?.error ??
          "Não foi possível validar sua sessão no servidor de dados.",
      };
    }

    return {
      status: "autenticado",
      user: corpo.data.user,
      csrfToken: corpo.data.csrfToken ?? "",
      csrfMaxAgeSeconds:
        typeof corpo.data.csrfMaxAgeSeconds === "number" &&
        Number.isFinite(corpo.data.csrfMaxAgeSeconds) &&
        corpo.data.csrfMaxAgeSeconds > 0
          ? Math.floor(corpo.data.csrfMaxAgeSeconds)
          : undefined,
      expiresAt:
        typeof corpo.data.expiresAt === "string"
          ? corpo.data.expiresAt
          : typeof corpo.data.session?.expiresAt === "string"
            ? corpo.data.session.expiresAt
            : undefined,
    };
  } catch {
    return {
      status: "indisponivel",
      mensagem:
        "O servidor de dados não respondeu. Confirme se o backend está em execução.",
    };
  } finally {
    clearTimeout(timeout);
  }
});
