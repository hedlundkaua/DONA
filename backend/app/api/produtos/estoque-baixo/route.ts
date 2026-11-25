/**
 * GET /api/produtos/estoque-baixo
 *
 * Lista produtos cuja quantidadeEstoque < estoqueMinimo.
 * Usa query SQL direta pois Prisma nÃ£o suporta comparar duas colunas no WHERE.
 *
 * Fonte: FadConecta - Produtos com Estoque Baixo - Felipe Molina.docx
 *        Estoque Minimo - Levantamento.docx (Murilo)
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, serverError } from "@/lib/api-response";
import { PerfilUsuario } from "@prisma/client";
import { requireUser } from "@/lib/auth";


type ProdutoEstoqueBaixo = {
  id: number;
  nome: string;
  quantidade_estoque: string;
  estoque_minimo: string;
  categoria_nome: string;
  unidade_medida: string;
  preco_venda: string;
};

export async function GET(_req: NextRequest) {
  try {
    const requestHeaders = _req.headers;
    const auth = await requireUser(new Request(_req.url, { headers: requestHeaders }), Object.values(PerfilUsuario));
    if (!auth.ok) return auth.response;
    const produtos = await prisma.$queryRaw<ProdutoEstoqueBaixo[]>`
      SELECT
        p.id,
        p.nome,
        p.quantidade_estoque,
        p.estoque_minimo,
        c.nome AS categoria_nome,
        p.unidade_medida,
        p.preco_venda
      FROM produtos p
      JOIN categorias_produtos c ON c.id = p.categoria_id AND c.negocio_id = p.negocio_id
      WHERE p.ativo = true
        AND p.negocio_id = ${auth.user.negocioId}::uuid
        AND p.quantidade_estoque < p.estoque_minimo
      ORDER BY (p.estoque_minimo - p.quantidade_estoque) DESC, p.nome ASC
    `;

    const visible = auth.user.perfil === PerfilUsuario.VENDEDOR
      ? produtos.map(({ preco_venda, ...produto }) => produto)
      : produtos;
    return ok({
      total: visible.length,
      produtos: visible,
    });
  } catch (err) {
    return serverError(err);
  }
}
