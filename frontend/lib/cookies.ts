/**
 * Constantes de cookie compartilhadas entre proxy (edge) e servidor.
 * Não importar nada de Node aqui: este módulo roda no proxy do Next.
 */

/** Cookies de sessão emitidos pelo backend (dev e produção). */
export const SESSION_COOKIE_NAMES = ["dona_session", "__Host-dona_session"] as const;

/** Espelho httpOnly do token CSRF exigido pelo backend nas mutações. */
export const CSRF_COOKIE = "dona_csrf";

/** Fallback quando o backend não informa a validade efetiva da sessão. */
export const SESSION_MAX_AGE_PADRAO = 60 * 60 * 12;

/** Sessão persistente: 30 dias, conforme contrato de `lembrarDeMim`. */
export const SESSION_MAX_AGE_LEMBRAR = 60 * 60 * 24 * 30;

export function maxAgeSessao(lembrarDeMim: boolean): number {
  return lembrarDeMim ? SESSION_MAX_AGE_LEMBRAR : SESSION_MAX_AGE_PADRAO;
}

function segundosNaoNegativos(valor: unknown): number | null {
  const numero =
    typeof valor === "number"
      ? valor
      : typeof valor === "string" && valor.trim()
        ? Number(valor)
        : NaN;

  if (!Number.isFinite(numero) || numero < 0) return null;
  return Math.floor(numero);
}

function segundosAte(expiraEm: unknown): number | null {
  if (typeof expiraEm !== "string" || !expiraEm.trim()) return null;
  const data = Date.parse(expiraEm);
  if (!Number.isFinite(data)) return null;
  return Math.max(0, Math.floor((data - Date.now()) / 1000));
}

/**
 * Sincroniza o cookie CSRF com a sessão emitida pelo backend. O backend é a
 * autoridade: usa `csrfMaxAgeSeconds` e, se ausente, `expiresAt`; só então cai
 * no fallback local. O limite de 30 dias evita cookies com duração absurda.
 */
export function maxAgeCsrfDaSessao(
  dados:
    | {
        csrfMaxAgeSeconds?: unknown;
        expiresAt?: unknown;
        session?: { expiresAt?: unknown } | null;
      }
    | null
    | undefined,
  fallback: number,
): number {
  if (!dados) return fallback;

  const informado = segundosNaoNegativos(dados.csrfMaxAgeSeconds);
  if (informado !== null) {
    return Math.min(informado, SESSION_MAX_AGE_LEMBRAR);
  }

  const expiraEm =
    segundosAte(dados.expiresAt) ??
    segundosAte(dados.session?.expiresAt);
  if (expiraEm !== null) {
    return Math.min(expiraEm, SESSION_MAX_AGE_LEMBRAR);
  }

  return fallback;
}
