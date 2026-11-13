import type { NextConfig } from "next";

// Copie esta regra para o next.config.ts do frontend separado.
// DONA_BACKEND_URL é somente server-side, por exemplo https://api.example.com.
const backendUrl = process.env.DONA_BACKEND_URL;

if (process.env.NODE_ENV === "production" && !backendUrl) {
  throw new Error("DONA_BACKEND_URL é obrigatório em produção.");
}

if (backendUrl) {
  const target = new URL(backendUrl);
  if (target.username || target.password || target.pathname !== "/" || target.search || target.hash || (process.env.NODE_ENV === "production" && target.protocol !== "https:")) {
    throw new Error("DONA_BACKEND_URL deve ser HTTPS em produção e não pode conter credenciais.");
  }
}

const config: NextConfig = {
  async rewrites() {
    return backendUrl
      ? [{ source: "/api/backend/:path*", destination: `${backendUrl.replace(/\/$/, "")}/api/:path*` }]
      : [];
  },
};

export default config;
