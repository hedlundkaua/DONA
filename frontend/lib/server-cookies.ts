import type { NextResponse } from "next/server";

type HeadersComGetSetCookie = Headers & { getSetCookie?: () => string[] };

/** Repassa ao navegador os cookies emitidos pelo backend (login/logout). */
export function copiarSetCookie(origem: Response, destino: NextResponse): void {
  const headers = origem.headers as HeadersComGetSetCookie;
  const valores =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [origem.headers.get("set-cookie")].filter(
          (valor): valor is string => Boolean(valor),
        );

  for (const valor of valores) {
    destino.headers.append("set-cookie", valor);
  }
}
