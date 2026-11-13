import type { NextConfig } from "next";

const desenvolvimento = process.env.NODE_ENV !== "production";

/**
 * CSP compatível com o App Router do Next.js.
 *
 * O Next injeta scripts inline de bootstrap/hidratação e o React usa `style`
 * inline em alguns componentes, por isso `'unsafe-inline'` é necessário em
 * `script-src` e `style-src` nesta configuração baseada em headers estáticos.
 * Em desenvolvimento o Turbopack também usa `eval` e WebSocket (HMR).
 *
 * Não há scripts, estilos, fontes ou imagens de terceiros: todo o conteúdo é
 * servido pela própria origem. As chamadas de API usam `/api` (same-origin) e
 * são feitas pelo proxy do próprio Next; o navegador nunca acessa o backend
 * diretamente.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${desenvolvimento ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${desenvolvimento ? " ws: wss:" : ""}`,
  "media-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const cabecalhosSeguranca = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

// HSTS só deve ser habilitado quando o frontend é publicado por HTTPS. Em
// desenvolvimento/local (HTTP) ele é omitido para não "prender" o navegador
// em HTTPS. Defina ENABLE_HSTS=true apenas no ambiente publicado com TLS.
if (process.env.ENABLE_HSTS === "true") {
  cabecalhosSeguranca.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000",
  });
}

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        // Inclui páginas, rotas de API e assets servidos pelo Next.
        source: "/:path*",
        headers: cabecalhosSeguranca,
      },
    ];
  },
};

export default nextConfig;
