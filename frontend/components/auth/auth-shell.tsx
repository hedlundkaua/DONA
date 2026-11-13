import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/shell/logo";
import { cn } from "@/lib/cn";

export function AuthShell({
  children,
  rodape,
  largura = "md",
}: {
  children: ReactNode;
  rodape?: ReactNode;
  largura?: "md" | "lg";
}) {
  return (
    <main className="relative flex min-h-dvh flex-col bg-pink-50">
      <div
        className="h-2 w-full bg-gradient-to-r from-navy via-plum to-pink"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,_rgba(229,23,110,0.12),transparent_62%)]"
        aria-hidden="true"
      />

      <div
        className={cn(
          "relative mx-auto flex w-full flex-1 flex-col justify-center px-4 py-8 sm:px-6 sm:py-12",
          largura === "lg" ? "max-w-lg" : "max-w-md",
        )}
      >
        <div className="mb-5 flex flex-col items-center text-center sm:mb-6">
          <Link
            href="/login"
            aria-label="DONA — ir para o login"
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40 focus-visible:ring-offset-2"
          >
            <Logo className="h-16 w-16 sm:h-20 sm:w-20" />
          </Link>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.22em] text-pink">
            Empreendedoras Restinga
          </p>
          <h1 className="mt-1 text-[32px] font-bold leading-tight tracking-tight text-navy">
            DONA
          </h1>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted">
            Gestão de produtos e estoque do seu negócio, simples e no celular.
          </p>
        </div>

        {children}

        {rodape ? (
          <div className="mt-6 text-center text-sm leading-relaxed text-muted">
            {rodape}
          </div>
        ) : null}
      </div>
    </main>
  );
}
