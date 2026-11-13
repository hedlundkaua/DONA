import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { Header } from "./header";
import { InlineAlert } from "@/components/ui/states";

export function AppShell({
  nome,
  aviso,
  children,
}: {
  nome: string;
  aviso?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-plum focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Pular para o conteúdo
      </a>
      <Header nome={nome} />
      <main
        id="conteudo"
        className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-5"
      >
        {aviso ? (
          <InlineAlert tom="atencao" className="mb-4">
            {aviso}
          </InlineAlert>
        ) : null}
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
