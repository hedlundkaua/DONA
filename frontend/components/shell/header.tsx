"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { Logo } from "./logo";
import {
  ArrowLeftIcon,
  HelpIcon,
  LogoutIcon,
  SpinnerIcon,
} from "@/components/ui/icons";

const ROTAS_RAIZ = new Set([
  "/",
  "/produtos",
  "/vendas",
  "/clientes",
  "/financeiro",
  "/mais",
  "/categorias",
  "/movimentos",
  "/ajustes",
]);

export function Header({
  nome,
  nomeEmpresa,
}: {
  nome: string;
  nomeEmpresa?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [saindo, iniciarSaida] = useTransition();
  const mostrarVoltar = !ROTAS_RAIZ.has(pathname);

  // Mantém o cookie CSRF sincronizado com a duração real da sessão. Em uma
  // sessão "lembrar de mim" (30 dias), o cookie não pode expirar em 12h.
  useEffect(() => {
    void fetch("/api/auth/me", { cache: "no-store" }).catch(() => {});
  }, []);

  async function sair() {
    iniciarSaida(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-2xl items-center gap-1 px-2">
        {mostrarVoltar ? (
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Voltar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-plum transition-colors hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
        ) : (
          <span className="w-1 shrink-0" aria-hidden="true" />
        )}

        <Link
          href="/"
          aria-label="DONA — ir para o painel"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
        >
          <Logo className="h-10 w-10 shrink-0" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[17px] font-bold tracking-tight text-navy">
              DONA
            </span>
            <span className="block truncate text-[11px] text-muted">
              {nomeEmpresa?.trim() || "Gestão do seu negócio"}
            </span>
          </span>
        </Link>

        <details className="group relative shrink-0">
          <summary
            className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full text-navy transition-colors hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40 [&::-webkit-details-marker]:hidden"
            aria-label="Ajuda"
            title="Ajuda"
          >
            <HelpIcon className="h-5 w-5" />
          </summary>
          <div className="absolute right-0 top-12 z-40 w-72 rounded-2xl border border-line bg-white p-4 shadow-lg">
            <p className="text-sm font-semibold text-navy">Como usar</p>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
              <li>
                <strong className="text-navy">Produtos:</strong> cadastre itens,
                preços e o estoque mínimo.
              </li>
              <li>
                <strong className="text-navy">Vendas:</strong> registre cliente,
                itens e pagamento.
              </li>
              <li>
                <strong className="text-navy">Clientes:</strong> consulte e
                atualize os contatos do negócio.
              </li>
              <li>
                <strong className="text-navy">Mais:</strong> categorias,
                movimentos, ajustes e seus dados.
              </li>
              <li>
                <strong className="text-navy">Financeiro:</strong> parcelas,
                caixa e relatórios (quando liberado para o seu perfil).
              </li>
            </ul>
            <p className="mt-3 truncate border-t border-line pt-3 text-xs text-muted">
              Sessão: <span className="font-medium text-navy">{nome}</span>
            </p>
          </div>
        </details>

        <button
          type="button"
          onClick={sair}
          disabled={saindo}
          data-testid="nav-sair"
          aria-label="Sair da conta"
          title="Sair da conta"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-plum transition-colors hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40 disabled:opacity-60"
        >
          {saindo ? (
            <SpinnerIcon className="h-5 w-5 animate-spin" />
          ) : (
            <LogoutIcon className="h-5 w-5" />
          )}
        </button>
      </div>
      <div
        className="h-px w-full bg-gradient-to-r from-pink via-pink/40 to-transparent"
        aria-hidden="true"
      />
    </header>
  );
}
