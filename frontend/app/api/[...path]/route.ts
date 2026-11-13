import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { backendUrl } from "@/lib/api";
import { CSRF_COOKIE } from "@/lib/cookies";
import { copiarSetCookie } from "@/lib/server-cookies";
import { lerCookieSessao } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Contexto = { params: Promise<{ path: string[] }> };

/**
 * Proxy server-side de /api/* para BACKEND_URL.
 * - Injeta o cookie de sessão do backend (httpOnly no navegador).
 * - Injeta o token CSRF nas mutações.
 * - Nunca expõe a URL interna do backend ao cliente.
 */
async function encaminhar(req: NextRequest, contexto: Contexto) {
  const { path } = await contexto.params;
  if (!path?.length) {
    return NextResponse.json(
      { success: false, error: "Recurso não encontrado." },
      { status: 404 },
    );
  }

  const sessao = await lerCookieSessao();
  if (!sessao) {
    return NextResponse.json(
      { success: false, error: "Autenticação necessária." },
      { status: 401 },
    );
  }

  const metodo = req.method.toUpperCase();
  const url = new URL(req.url);
  const destino = `${backendUrl()}/api/${path
    .map((segmento) => encodeURIComponent(segmento))
    .join("/")}${url.search}`;

  const headers = new Headers();
  headers.set("Accept", req.headers.get("accept") ?? "application/json");
  headers.set("Cookie", `${sessao.nome}=${sessao.valor}`);

  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  if (!["GET", "HEAD", "OPTIONS"].includes(metodo)) {
    const store = await cookies();
    const csrf = store.get(CSRF_COOKIE)?.value;
    if (csrf) headers.set("x-csrf-token", csrf);
  }

  const corpo =
    metodo === "GET" || metodo === "HEAD"
      ? undefined
      : await req.arrayBuffer();

  try {
    const resposta = await fetch(destino, {
      method: metodo,
      headers,
      body: corpo,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });

    const dados = await resposta.arrayBuffer();
    const saida = new NextResponse(dados.byteLength ? dados : null, {
      status: resposta.status,
      headers: { "Cache-Control": "no-store" },
    });

    const tipo = resposta.headers.get("content-type");
    if (tipo) saida.headers.set("content-type", tipo);

    copiarSetCookie(resposta, saida);
    return saida;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:
          "Não foi possível conectar ao servidor de dados. Confirme se o backend está em execução.",
      },
      { status: 502 },
    );
  }
}

export {
  encaminhar as GET,
  encaminhar as POST,
  encaminhar as PUT,
  encaminhar as PATCH,
  encaminhar as DELETE,
  encaminhar as HEAD,
};
