"use client";

import { AlertIcon } from "@/components/ui/icons";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-danger/25 bg-danger/5 p-5 text-center"
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-danger">
        <AlertIcon className="h-6 w-6" />
      </div>
      <h2 className="text-base font-semibold text-navy">Algo deu errado</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        {error.message || "Não foi possível montar esta tela agora."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-plum px-5 text-sm font-semibold text-white transition-colors hover:bg-plum/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40 focus-visible:ring-offset-2"
      >
        Tentar novamente
      </button>
    </div>
  );
}
