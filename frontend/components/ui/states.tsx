"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { AlertIcon, CheckIcon, SpinnerIcon } from "./icons";
import { cn } from "@/lib/cn";

export function InlineAlert({
  tom = "erro",
  children,
  className,
}: {
  tom?: "erro" | "sucesso" | "info" | "atencao";
  children: ReactNode;
  className?: string;
}) {
  const estilos = {
    erro: "border-danger/25 bg-danger/5 text-danger",
    sucesso: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-line bg-pink-50 text-navy",
    atencao: "border-amber-200 bg-amber-50 text-amber-800",
  } as const;

  return (
    <div
      role={tom === "erro" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm font-medium",
        estilos[tom],
        className,
      )}
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {tom === "sucesso" ? (
          <CheckIcon className="h-4 w-4" />
        ) : (
          <AlertIcon className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function EmptyState({
  titulo,
  descricao,
  acao,
  icone,
}: {
  titulo: string;
  descricao: string;
  acao?: ReactNode;
  icone?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 text-pink">
        {icone ?? <AlertIcon className="h-6 w-6" />}
      </div>
      <h2 className="text-base font-semibold text-navy">{titulo}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">{descricao}</p>
      {acao ? <div className="mt-5 w-full max-w-xs">{acao}</div> : null}
    </div>
  );
}

export function ErrorState({
  titulo = "Não foi possível carregar",
  mensagem,
}: {
  titulo?: string;
  mensagem: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  return (
    <div
      role="alert"
      className="rounded-2xl border border-danger/25 bg-danger/5 p-5 text-center"
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-danger">
        <AlertIcon className="h-6 w-6" />
      </div>
      <h2 className="text-base font-semibold text-navy">{titulo}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{mensagem}</p>
      <button
        type="button"
        onClick={() => iniciar(() => router.refresh())}
        disabled={pendente}
        className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-plum px-5 text-sm font-semibold text-white transition-colors hover:bg-plum/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40 focus-visible:ring-offset-2 disabled:opacity-50"
      >
        {pendente ? (
          <SpinnerIcon className="h-4 w-4 animate-spin" />
        ) : null}
        Tentar novamente
      </button>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-slate-100", className)}
      aria-hidden="true"
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Carregando conteúdo">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-28 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-40 w-full" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
