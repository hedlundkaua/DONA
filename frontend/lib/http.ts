/**
 * Cliente HTTP do navegador. Todas as chamadas passam pelo proxy server-side
 * em /api, que encaminha para BACKEND_URL, valida a sessão e injeta o CSRF.
 */

export type ClientResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      status: number;
      message: string;
      retryAfterSeconds?: number;
    };

function lerRetryAfter(resposta: Response): number | undefined {
  const valor = resposta.headers.get("retry-after");
  if (!valor) return undefined;

  const segundos = Number(valor);
  if (Number.isFinite(segundos) && segundos > 0) return Math.ceil(segundos);

  const data = Date.parse(valor);
  if (Number.isFinite(data)) {
    return Math.max(1, Math.ceil((data - Date.now()) / 1000));
  }

  return undefined;
}

export interface OpcoesFetch {
  /** Redireciona para /login ao receber 401. Padrão: true. */
  redirecionar401?: boolean;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  opcoes: OpcoesFetch = {},
): Promise<ClientResult<T>> {
  const enviarCorpo = init.body !== undefined && init.body !== null;

  try {
    const resposta = await fetch(`/api${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(enviarCorpo ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });

    const texto = await resposta.text();
    let corpo: { success?: boolean; data?: unknown; error?: string } | null = null;
    try {
      corpo = texto ? JSON.parse(texto) : null;
    } catch {
      corpo = null;
    }

    if (resposta.status === 401 && opcoes.redirecionar401 !== false) {
      const destino = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/login?next=${encodeURIComponent(destino)}`);
      return { ok: false, status: 401, message: "Sessão expirada." };
    }

    if (!resposta.ok || corpo?.success === false) {
      return {
        ok: false,
        status: resposta.status,
        message:
          corpo?.error ??
          `Não foi possível concluir a operação (${resposta.status}).`,
        retryAfterSeconds:
          resposta.status === 429 ? lerRetryAfter(resposta) : undefined,
      };
    }

    return { ok: true, data: (corpo?.data ?? corpo) as T };
  } catch {
    return {
      ok: false,
      status: 0,
      message: "Falha de conexão. Verifique sua internet e tente novamente.",
    };
  }
}
