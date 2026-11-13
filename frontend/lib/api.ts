/**
 * Cliente HTTP usado apenas no servidor (Server Components e Route Handlers).
 * Nunca é importado por componentes com "use client".
 */

import { cookies } from "next/headers";
import { SESSION_COOKIE_NAMES } from "./cookies";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

export function backendUrl(): string {
  return (process.env.BACKEND_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export async function backendFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const enviarCorpo = init.body !== undefined && init.body !== null;

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (enviarCorpo && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Leitura autenticada: repassa o cookie de sessão do backend recebido pelo
  // navegador. Sem isso todas as consultas de Server Component voltam 401.
  try {
    const jar = await cookies();
    const pares = SESSION_COOKIE_NAMES.map((nome) => {
      const valor = jar.get(nome)?.value;
      return valor ? `${nome}=${valor}` : null;
    }).filter((item): item is string => Boolean(item));
    if (pares.length > 0) headers.set("Cookie", pares.join("; "));
  } catch {
    // Fora de um contexto de requisição (ex.: script) segue sem cookie.
  }

  try {
    const resposta = await fetch(`${backendUrl()}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers,
    });

    const texto = await resposta.text();
    let corpo: { success?: boolean; data?: unknown; error?: string } | null = null;
    try {
      corpo = texto ? JSON.parse(texto) : null;
    } catch {
      corpo = null;
    }

    if (!resposta.ok || corpo?.success === false) {
      return {
        ok: false,
        status: resposta.status,
        message:
          corpo?.error ??
          `O servidor de dados respondeu com o código ${resposta.status}.`,
      };
    }

    return { ok: true, data: (corpo?.data ?? corpo) as T };
  } catch {
    return {
      ok: false,
      status: 0,
      message:
        "Não foi possível conectar ao servidor de dados. Confirme se o backend está em execução e se BACKEND_URL está correto.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
