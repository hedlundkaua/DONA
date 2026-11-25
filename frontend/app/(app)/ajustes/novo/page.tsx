import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/ui/page-title";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { ButtonLink } from "@/components/ui/button";
import { BoxIcon } from "@/components/ui/icons";
import { backendFetch } from "@/lib/api";
import { podeAjustar } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import type { Produto } from "@/lib/types";
import { AjusteForm } from "./ajuste-form";

export const metadata: Metadata = { title: "Novo ajuste" };
export const dynamic = "force-dynamic";

export default async function NovoAjustePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sessao = await getSession();
  const perfil = sessao.status === "autenticado" ? sessao.user.perfil : null;

  const titulo = (
    <PageTitle
      sobretitulo="Ajustes / Novo"
      titulo="Novo ajuste"
      descricao="Registre a quantidade contada. O sistema calcula e guarda a diferença."
    />
  );

  if (!podeAjustar(perfil)) {
    return (
      <>
        {titulo}
        <SemPermissao descricao="Ajustes de inventário são restritos a administração e estoquista." />
      </>
    );
  }

  const produtosRes = await backendFetch<Produto[]>("/api/produtos?ativo=true");

  if (!produtosRes.ok) {
    return (
      <>
        {titulo}
        <ErrorState mensagem={produtosRes.message} />
      </>
    );
  }

  const produtos = produtosRes.data.filter((produto) => produto.ativo);

  if (produtos.length === 0) {
    return (
      <>
        {titulo}
        <EmptyState
          titulo="Nenhum produto ativo"
          descricao="É necessário ter um produto ativo para registrar um ajuste."
          icone={<BoxIcon className="h-6 w-6" />}
          acao={
            <ButtonLink href="/produtos" className="w-full">
              Ver produtos
            </ButtonLink>
          }
        />
      </>
    );
  }

  const produtoParam =
    typeof params.produto === "string" ? params.produto : "";
  const produtoInicial = produtos.some(
    (produto) => String(produto.id) === produtoParam,
  )
    ? produtoParam
    : "";

  return (
    <>
      {titulo}
      <AjusteForm produtos={produtos} produtoInicial={produtoInicial} />
      <p className="mt-4 px-1 text-xs leading-relaxed text-muted">
        Perda, avaria ou vencimento também podem ser registrados como{" "}
        <Link
          href="/movimentos/novo?tipo=SAIDA"
          className="font-semibold text-plum underline-offset-2 hover:underline"
        >
          saída de estoque
        </Link>
        , se o negócio preferir esse fluxo.
      </p>
    </>
  );
}
