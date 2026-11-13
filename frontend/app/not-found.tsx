import Link from "next/link";
import { Logo } from "@/components/shell/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-pink-50 px-6 text-center">
      <Logo className="h-16 w-16" />
      <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-pink">
        Página não encontrada
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-navy">
        Esse caminho não existe
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        O endereço pode ter mudado. Volte para o painel para continuar.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-plum px-6 text-sm font-semibold text-white transition-colors hover:bg-plum/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40 focus-visible:ring-offset-2"
      >
        Ir para o painel
      </Link>
    </main>
  );
}
