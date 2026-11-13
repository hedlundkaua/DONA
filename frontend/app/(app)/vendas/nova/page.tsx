import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { BoxIcon, ClientsIcon, PlusIcon } from "@/components/ui/icons";
import { PageTitle } from "@/components/ui/page-title";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { EmptyState, ErrorState, InlineAlert } from "@/components/ui/states";
import { VendaForm } from "@/components/vendas/venda-form";
import { backendFetch } from "@/lib/api";
import { hojeISO } from "@/lib/format";
import {
  podeCriarVenda,
  podeGerirCatalogo,
  podeGerirClientes,
  podeVerClientes,
} from "@/lib/permissions";
import { getSession } from "@/lib/session";
import type { Categoria, ClienteSelecao, Produto } from "@/lib/types";

export const metadata: Metadata = { title: "Nova venda" };
export const dynamic = "force-dynamic";

export default async function NovaVendaPage() {
  const sessao = await getSession();
  const perfil = sessao.status === "autenticado" ? sessao.user.perfil : null;

  if (!podeCriarVenda(perfil)) {
    return (
      <>
        <PageTitle sobretitulo="Vendas / Cadastro" titulo="Nova venda" />
        <SemPermissao descricao="Seu perfil não pode registrar uma nova venda." />
      </>
    );
  }

  const [clientesRes, produtosRes, categoriasRes] = await Promise.all([
    backendFetch<ClienteSelecao[]>("/api/clientes?ativo=true"),
    backendFetch<Produto[]>("/api/produtos?ativo=true"),
    backendFetch<Categoria[]>("/api/categorias?ativo=true"),
  ]);

  const titulo = (
    <PageTitle
      sobretitulo="Vendas / Cadastro"
      titulo="Nova venda"
      descricao="Selecione o cliente, os itens e as condições de pagamento."
    />
  );

  if (!clientesRes.ok) {
    return (
      <>
        {titulo}
        {clientesRes.status === 403 ? (
          <SemPermissao descricao="Seu perfil não pode consultar os clientes necessários para uma venda." />
        ) : (
          <ErrorState mensagem={clientesRes.message} />
        )}
      </>
    );
  }

  if (!produtosRes.ok) {
    return (
      <>
        {titulo}
        <ErrorState mensagem={produtosRes.message} />
      </>
    );
  }

  const clientes = clientesRes.data;
  if (clientes.length === 0) {
    return (
      <>
        {titulo}
        <EmptyState
          titulo="Nenhum cliente ativo"
          descricao="Cadastre um cliente ativo antes de registrar a primeira venda."
          icone={<ClientsIcon className="h-6 w-6" />}
          acao={
            podeGerirClientes(perfil) ? (
              <ButtonLink href="/clientes/novo" className="w-full">
                <PlusIcon className="h-4 w-4" />
                Cadastrar cliente
              </ButtonLink>
            ) : podeVerClientes(perfil) ? (
              <ButtonLink href="/clientes" variante="secundario" className="w-full">
                Ver clientes
              </ButtonLink>
            ) : (
              <ButtonLink href="/" variante="secundario" className="w-full">
                Voltar ao painel
              </ButtonLink>
            )
          }
        />
      </>
    );
  }

  const categoriasAtivas = categoriasRes.ok
    ? new Set(categoriasRes.data.map((categoria) => categoria.id))
    : null;
  const produtos = categoriasAtivas
    ? produtosRes.data.filter((produto) => categoriasAtivas.has(produto.categoriaId))
    : produtosRes.data;

  if (produtos.length === 0) {
    return (
      <>
        {titulo}
        <EmptyState
          titulo="Nenhum produto ativo"
          descricao="Cadastre um produto ativo em uma categoria ativa para registrar vendas."
          icone={<BoxIcon className="h-6 w-6" />}
          acao={
            podeGerirCatalogo(perfil) ? (
              <ButtonLink href="/produtos/novo" className="w-full">
                <PlusIcon className="h-4 w-4" />
                Cadastrar produto
              </ButtonLink>
            ) : (
              <ButtonLink href="/produtos" variante="secundario" className="w-full">
                Ver produtos
              </ButtonLink>
            )
          }
        />
      </>
    );
  }

  return (
    <>
      {titulo}
      {categoriasRes.ok ? null : (
        <div className="mb-4">
          <InlineAlert tom="atencao">
            Não foi possível conferir as categorias ativas. Se a venda falhar,
            verifique o cadastro do produto.
          </InlineAlert>
        </div>
      )}
      <VendaForm
        clientes={clientes}
        produtos={produtos}
        dataHoje={hojeISO()}
      />
    </>
  );
}
