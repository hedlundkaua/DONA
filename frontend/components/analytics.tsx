"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

const paginas = new Set([
  "/", "/login", "/cadastro", "/verificar-email", "/esqueci-senha",
  "/redefinir-senha", "/produtos", "/produtos/novo", "/categorias",
  "/clientes", "/clientes/novo", "/vendas", "/vendas/nova", "/mais",
  "/movimentos", "/movimentos/novo", "/ajustes", "/ajustes/novo",
]);

function sanitizarEvento(evento: BeforeSendEvent): BeforeSendEvent | null {
  if (evento.type !== "pageview") return null;
  try {
    const url = new URL(evento.url, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const caminho = url.pathname.replace(
      /^\/(produtos|clientes|vendas)\/\d+(?=\/|$)/,
      "/$1/[id]",
    );
    if (!paginas.has(caminho) && !/^\/(produtos|clientes|vendas)\/\[id\](\/editar)?$/.test(caminho)) return null;
    url.pathname = caminho;
    url.search = "";
    url.hash = "";
    return { ...evento, url: url.toString() };
  } catch {
    return null;
  }
}

export function DonaAnalytics() {
  return <Analytics beforeSend={sanitizarEvento} />;
}
