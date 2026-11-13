import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAMES } from "@/lib/cookies";

const PUBLICAS = new Set([
  "/login",
  "/cadastro",
  "/verificar-email",
  "/esqueci-senha",
  "/redefinir-senha",
]);

/**
 * Proteção de navegação: exige a presença do cookie de sessão do backend.
 * A validade real da sessão é conferida pelo layout `(app)` via backend.
 */
export default function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/_vercel/insights/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const temSessao = SESSION_COOKIE_NAMES.some((nome) =>
    Boolean(req.cookies.get(nome)?.value),
  );

  if (PUBLICAS.has(pathname)) {
    // A página de login valida a sessão no backend; aqui não redirecionamos
    // apenas pela presença do cookie, para não criar loop com cookie expirado.
    return NextResponse.next();
  }

  if (!temSessao) {
    const destino = new URL("/login", req.url);
    if (pathname !== "/") {
      destino.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(destino);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
