import Link from "next/link";
import { StatusBadge } from "@/components/ui/badges";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatWhatsapp } from "@/lib/format";

export interface ClienteResumo {
  id: number;
  nome: string;
  whatsapp: string;
  instagram?: string | null;
  ativo?: boolean;
}

/**
 * Card de cliente usado na listagem real. Recebe os dados já carregados e não
 * faz chamadas de API.
 */
export function ClienteCard({
  cliente,
  href,
  testId,
  className,
}: {
  cliente: ClienteResumo;
  href?: string;
  testId?: string;
  className?: string;
}) {
  const inicial = cliente.nome.trim().charAt(0).toUpperCase() || "?";
  const instagram = cliente.instagram?.trim().replace(/^@/, "");

  const corpo = (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pink-50 text-base font-bold text-pink"
      >
        {inicial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-navy">
            {cliente.nome}
          </span>
          {typeof cliente.ativo === "boolean" ? (
            <StatusBadge ativo={cliente.ativo} />
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">
          {formatWhatsapp(cliente.whatsapp)}
          {instagram ? ` · @${instagram}` : ""}
        </span>
      </span>
    </div>
  );

  return (
    <Card className={cn("p-0", className)}>
      {href ? (
        <Link
          href={href}
          data-testid={testId}
          className="block rounded-2xl px-4 py-3.5 transition-colors hover:bg-pink-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pink/40"
        >
          {corpo}
        </Link>
      ) : (
        <div data-testid={testId} className="px-4 py-3.5">{corpo}</div>
      )}
    </Card>
  );
}
