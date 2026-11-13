/**
 * Constantes de cookie compartilhadas entre proxy (edge) e servidor.
 * Não importar nada de Node aqui: este módulo roda no proxy do Next.
 */

/** Cookies de sessão emitidos pelo backend (dev e produção). */
export const SESSION_COOKIE_NAMES = ["dona_session", "__Host-dona_session"] as const;

/** Espelho httpOnly do token CSRF exigido pelo backend nas mutações. */
export const CSRF_COOKIE = "dona_csrf";

/** Mesmo TTL padrão da sessão do backend (12h). */
export const SESSION_MAX_AGE = 60 * 60 * 12;
