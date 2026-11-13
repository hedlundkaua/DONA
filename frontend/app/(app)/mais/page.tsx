import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { PageTitle } from "@/components/ui/page-title";
import {
  ChevronRightIcon,
  ClipboardIcon,
  MovementsIcon,
  TagIcon,
} from "@/components/ui/icons";

export const metadata: Metadata = { title: "Mais" };

const atalhos = [
  {
    href: "/categorias",
    titulo: "Categorias",
    descricao: "Organize os produtos por tipo e mantenha o catálogo consistente.",
    Icone: TagIcon,
    testId: "mais-categorias",
  },
  {
    href: "/movimentos",
    titulo: "Movimentos",
    descricao: "Consulte entradas e saídas de estoque da cooperativa.",
    Icone: MovementsIcon,
    testId: "mais-movimentos",
  },
  {
    href: "/ajustes",
    titulo: "Ajustes",
    descricao: "Corrija o saldo após conferência física, perdas ou avarias.",
    Icone: ClipboardIcon,
    testId: "mais-ajustes",
  },
] as const;

export default function MaisPage() {
  return (
    <>
      <PageTitle
        sobretitulo="Mais / Cadastros"
        titulo="Mais"
        descricao="Acesse os cadastros e as operações de apoio do sistema."
      />

      <Card className="p-0">
        <div className="px-4 pt-4">
          <CardTitle>Cadastros e estoque</CardTitle>
        </div>
        <div className="mt-3 divide-y divide-line">
          {atalhos.map(({ href, titulo, descricao, Icone, testId }) => (
            <Link
              key={href}
              href={href}
              data-testid={testId}
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-pink-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pink/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink">
                <Icone className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-navy">
                  {titulo}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                  {descricao}
                </span>
              </span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
            </Link>
          ))}
        </div>
      </Card>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Vendas e Clientes ficam na navegação principal. O Financeiro será
        incluído quando o módulo financeiro estiver disponível na API.
      </p>
    </>
  );
}
