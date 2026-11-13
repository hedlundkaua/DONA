/**
 * GET  /api/estoque/movimentacoes   — lista movimentações (filtros: produtoId, tipo, de, ate)
 * POST /api/estoque/movimentacoes   — registra nova movimentação (entrada ou saída)
 *
 * Requisitos: Entrada_Saída_de_Mercadorias-Gledson.docx
 *             DDL Fadconecta Geral.docx
 *
 * RN-MOV-01: saída não pode ser maior que saldo atual
 * RN-MOV-02: registra automaticamente data e hora (campo dataHora no model)
 * NOTA: RN-MOV-03 (offline sync) = PROPOSTA NÃO CONFIRMADA — não implementado na v1
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ok,
  created,
  badRequest,
  forbidden,
  notFound,
  unprocessable,
  serverError,
} from "@/lib/api-response";
import { fitsDecimal, isPositiveInteger, isOptionalString, parseDateFilter, parseId, parseJsonObject } from "@/lib/validators";
import { PerfilUsuario, Prisma, TipoMovimento } from "@prisma/client";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req, [PerfilUsuario.ADMINISTRADOR, PerfilUsuario.GESTOR, PerfilUsuario.ESTOQUISTA, PerfilUsuario.VENDEDOR, PerfilUsuario.FINANCEIRO]);
    if (!auth.ok) return auth.response;
    const { searchParams } = new URL(req.url);
    const produtoId = searchParams.get("produtoId");
    const tipo = searchParams.get("tipo");
    const de = searchParams.get("de");
    const ate = searchParams.get("ate");

    const where: Prisma.MovimentacaoEstoqueWhereInput = { negocioId: auth.user.negocioId };

    if (produtoId) {
      const pid = parseId(produtoId);
      if (!pid) return badRequest("produtoId inválido.");
      where.produtoId = pid;
    }

    if (tipo) {
      if (tipo !== "ENTRADA" && tipo !== "SAIDA") return badRequest("tipo inválido.");
      where.tipoMovimento = tipo as TipoMovimento;
    }

    if (de || ate) {
      where.dataHora = {};
      if (de) {
        const parsed = parseDateFilter(de);
        if (!parsed) return badRequest("de inválido; use YYYY-MM-DD ou ISO-8601.");
        where.dataHora.gte = parsed.date;
      }
      if (ate) {
        const parsed = parseDateFilter(ate, true);
        if (!parsed) return badRequest("ate inválido; use YYYY-MM-DD ou ISO-8601.");
        if (parsed.exclusive) where.dataHora.lt = parsed.date;
        else where.dataHora.lte = parsed.date;
      }
    }

    const movimentacoes = await prisma.movimentacaoEstoque.findMany({
      where,
      orderBy: { dataHora: "desc" },
      include: {
        produto: { select: { id: true, nome: true, unidadeMedida: true } },
      },
    });

    return ok(movimentacoes);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req, [PerfilUsuario.ADMINISTRADOR, PerfilUsuario.GESTOR, PerfilUsuario.ESTOQUISTA, PerfilUsuario.VENDEDOR]);
    if (!auth.ok) return auth.response;
    const body = await parseJsonObject(req);
    if (!body) return badRequest("Corpo JSON inválido; envie um objeto.");
    const { produtoId, tipoMovimento, quantidade, documentoOrigem, observacoes } = body;

    // Validações
    if (!isPositiveInteger(produtoId)) {
      return badRequest("O campo 'produtoId' deve ser um inteiro positivo.");
    }

    if (!tipoMovimento || !["ENTRADA", "SAIDA"].includes(tipoMovimento)) {
      return badRequest("O campo 'tipoMovimento' deve ser 'ENTRADA' ou 'SAIDA'.");
    }
    if (auth.user.perfil === PerfilUsuario.VENDEDOR && tipoMovimento !== "SAIDA") {
      return forbidden("Vendedor só pode registrar saída de estoque.");
    }

    if (!fitsDecimal(quantidade, 8) || Number(quantidade) <= 0) {
      return badRequest("A quantidade deve ser maior que zero.");
    }
    if (!isOptionalString(documentoOrigem, 100)) return badRequest("documentoOrigem deve conter no máximo 100 caracteres.");
    if (!isOptionalString(observacoes, 10000)) return badRequest("observacoes deve ser texto.");

    const qtd = new Prisma.Decimal(quantidade);
    // Serialização + update condicional impede duas saídas concorrentes de
    // consumirem o mesmo saldo. O operador vem da autenticação quando houver;
    // A identidade do operador vem da sessão validada, nunca do payload.
    const result = await prisma.$transaction(async (tx) => {
      const produto = await tx.produto.findFirst({ where: { id: produtoId, negocioId: auth.user.negocioId }, include: { categoria: true } });
      if (!produto) throw new Error("PRODUCT_NOT_FOUND");
      if (!produto.ativo) throw new Error("PRODUCT_INACTIVE");
      if (!produto.categoria.ativo) throw new Error("CATEGORY_INACTIVE");
      const delta = tipoMovimento === "ENTRADA" ? qtd : qtd.negated();
      const updated = await tx.produto.updateMany({
        where: {
          id: produtoId,
          negocioId: auth.user.negocioId,
          ativo: true,
          ...(tipoMovimento === "SAIDA" ? { quantidadeEstoque: { gte: qtd } } : {}),
        },
        data: { quantidadeEstoque: { increment: delta } },
      });
      if (updated.count !== 1) throw new Error("INSUFFICIENT_STOCK");
      const movimentacao = await tx.movimentacaoEstoque.create({
        data: {
          negocioId: auth.user.negocioId,
          tipoMovimento: tipoMovimento as TipoMovimento,
          produtoId,
          quantidade: new Prisma.Decimal(quantidade),
          operadorId: auth.user.id,
          documentoOrigem: documentoOrigem ?? null,
          observacoes: observacoes ?? null,
        },
        include: {
          produto: { select: { id: true, nome: true, unidadeMedida: true } },
        },
      });

      // Busca saldo atualizado
      const produtoAtualizado = await tx.produto.findUnique({
        where: { negocioId_id: { negocioId: auth.user.negocioId, id: produtoId } },
        select: { quantidadeEstoque: true, estoqueMinimo: true },
      });

      return {
        movimentacao,
        saldoAtual: produtoAtualizado?.quantidadeEstoque,
        alertaEstoqueBaixo: produtoAtualizado
          ? produtoAtualizado.quantidadeEstoque.lessThanOrEqualTo(produtoAtualizado.estoqueMinimo)
          : false,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

    return created(result);
  } catch (err) {
    if (err instanceof Error && err.message === "PRODUCT_NOT_FOUND") return notFound("Produto");
    if (err instanceof Error && err.message === "PRODUCT_INACTIVE") return unprocessable("Produto inativo não pode ter movimentações.");
    if (err instanceof Error && err.message === "CATEGORY_INACTIVE") return unprocessable("Categoria inativa não pode receber novas movimentações.");
    if (err instanceof Error && err.message === "INSUFFICIENT_STOCK") return unprocessable("Saldo insuficiente para esta saída.");
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2000") return badRequest("Um campo excede o limite permitido.");
    return serverError(err);
  }
}
