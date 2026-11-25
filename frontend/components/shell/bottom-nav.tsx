"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BoxIcon,
  ChartIcon,
  ClientsIcon,
  HomeIcon,
  MoreIcon,
  WalletIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { podeVerFinanceiro } from "@/lib/permissions";

const itensBase = [
  { href: "/", rotulo: "Início", Icone: HomeIcon },
  { href: "/produtos", rotulo: "Produtos", Icone: BoxIcon },
  { href: "/vendas", rotulo: "Vendas", Icone: ChartIcon },
  { href: "/clientes", rotulo: "Clientes", Icone: ClientsIcon },
  { href: "/mais", rotulo: "Mais", Icone: MoreIcon },
] as const;

const ROTAS_MAIS = ["/mais", "/categorias", "/movimentos", "/ajustes"] as const;

function estaAtivo(pathname: string, href: string) {
  if (href === "/mais") {
    return ROTAS_MAIS.some(
      (rota) => pathname === rota || pathname.startsWith(`${rota}/`),
    );
  }
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function testId(href: string) {
  return href === "/" ? "nav-inicio" : `nav-${href.slice(1)}`;
}

export function BottomNav({ perfil }: { perfil?: string | null }) {
  const pathname = usePathname();
  const comFinanceiro = podeVerFinanceiro(perfil);
  const itens = comFinanceiro
    ? [
        ...itensBase.slice(0, 3),
        { href: "/financeiro", rotulo: "Financeiro", Icone: WalletIcon },
        ...itensBase.slice(3),
      ]
    : itensBase;

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/97 backdrop-blur safe-bottom"
    >
      <ul
        className={cn(
          "mx-auto grid w-full max-w-2xl px-1 pt-1.5",
          comFinanceiro ? "grid-cols-6" : "grid-cols-5",
        )}
      >
        {itens.map(({ href, rotulo, Icone }) => {
          const ativo = estaAtivo(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={ativo ? "page" : undefined}
                data-testid={testId(href)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 font-semibold transition-colors",
                  comFinanceiro ? "text-[10px]" : "text-[11px]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40",
                  ativo
                    ? "bg-pink-50 text-pink"
                    : "text-navy hover:bg-pink-50/60",
                )}
              >
                <Icone className="h-[22px] w-[22px]" />
                <span className="truncate">{rotulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
