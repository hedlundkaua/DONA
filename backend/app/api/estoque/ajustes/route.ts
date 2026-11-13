/**
 * GET  /api/estoque/ajustes   — lista ajustes (filtros: produtoId, de, ate)
 * POST /api/estoque/ajustes   — registra ajuste de inventário
 *
 * Requisitos: FADConecta_Ajustes_e_Invent_Sthefane.docx
 *             DDL Fadconecta Geral.docx (ajustes_inventario)
 *
 * RN-AJ-01: ajuste deve estar relacionado a produto cadastrado
 * RN-AJ-02: quantidade contada não pode ser < 0
 * RN-AJ-03: diferença armazenada (calculada pelo sistema) para auditoria
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ok,
  created,
  badRequest,
  unprocessable,
  notFound,
  serverError,
} from "@/lib/api-response";
import { fitsDecimal, isPositiveInteger, isOptionalString, parseDateFilter, parseId, parseJsonObject } from "@/lib/validators";
import { PerfilUsuario, Prisma, TipoAjuste } from "@prisma/client";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req, [PerfilUsuario.ADMINISTRADOR, PerfilUsuario.GESTOR, PerfilUsuario.ESTOQUISTA]);
    if (!auth.ok) return auth.response;
    const { searchParams } = new URL(req.url);
    const produtoId = searchParams.get("produtoId");
    const de = searchParams.get("de");
    const ate = searchParams.get("ate");

    const where: Prisma.AjusteInventarioWhereInput = { negocioId: auth.user.negocioId };

    if (produtoId) {
      const pid = parseId(produtoId);
      if (!pid) return badRequest("produtoId inválido.");
      where.produtoId = pid;
    }

    if (de || ate) {
      where.data = {};
      if (de) {
        const parsed = parseDateFilter(de);
        if (!parsed) return badRequest("de inválido; use YYYY-MM-DD ou ISO-8601.");
        where.data.gte = parsed.date;
      }
      if (ate) {
        const parsed = parseDateFilter(ate, true);
        if (!parsed) return badRequest("ate inválido; use YYYY-MM-DD ou ISO-8601.");
        if (parsed.exclusive) where.data.lt = parsed.date;
        else where.data.lte = parsed.date;
      }
    }

    const ajustes = await prisma.ajusteInventario.findMany({
      where,
      orderBy: { data: "desc" },
      include: {
        produto: { select: { id: true, nome: true, unidadeMedida: true } },
      },
    });

    return ok(ajustes);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req, [PerfilUsuario.ADMINISTRADOR, PerfilUsuario.ESTOQUISTA]);
    if (!auth.ok) return auth.response;
    const body = await parseJsonObject(req);
    if (!body) return badRequest("Corpo JSON inválido; envie um objeto.");
    const {
      produtoId,
      quantidadeContada,
      motivo,
      observacoes,
    } = body;

    // Validações — RN-AJ-01
    if (!isPositiveInteger(produtoId)) {
      return badRequest("O campo 'produtoId' deve ser um inteiro positivo.");
    }

    // RN-AJ-02: quantidade contada não pode ser < 0
    if (!fitsDecimal(quantidadeContada, 8)) {
      return badRequest("A quantidade contada não pode ser negativa.");
    }

    if (!motivo || String(motivo).trim().length === 0) {
      return badRequest("O campo 'motivo' é obrigatório.");
    }
    if (typeof motivo !== "string") return badRequest("motivo deve ser texto.");
    if (!isOptionalString(observacoes, 10000)) return badRequest("observacoes deve ser texto.");

    // Busca produto (RN-AJ-01)
    // Lê saldo e grava ajuste dentro da mesma transação serializável, evitando
    // que um ajuste concorrente sobrescreva uma movimentação recém aplicada.
    const result = await prisma.$transaction(async (tx) => {
      // O lock da linha serializa ajustes e movimentos concorrentes. Mantém-se
      // READ COMMITTED: a operação que adquirir o lock depois lê o saldo novo.
      await tx.$queryRaw`SELECT id FROM produtos WHERE id = ${produtoId} AND negocio_id = ${auth.user.negocioId}::uuid FOR UPDATE`;
      const produto = await tx.produto.findFirst({ where: { id: produtoId, negocioId: auth.user.negocioId }, include: { categoria: true } });
      if (!produto) throw new Error("PRODUCT_NOT_FOUND");
      if (!produto.ativo) throw new Error("PRODUCT_INACTIVE");
      if (!produto.categoria.ativo) throw new Error("CATEGORY_INACTIVE");
      const qContada = new Prisma.Decimal(quantidadeContada);
      const qSistema = produto.quantidadeEstoque;
      const diferenca = qContada.minus(qSistema);
      const tipoAjuste: TipoAjuste = diferenca.greaterThanOrEqualTo(0) ? "AUMENTO" : "REDUCAO";
      const ajuste = await tx.ajusteInventario.create({
        data: {
          negocioId: auth.user.negocioId,
          produtoId,
          quantidadeSistema: qSistema,
          quantidadeContada: qContada,
          diferenca,
          tipoAjuste,
          motivo: String(motivo).trim(),
          usuarioResponsavelId: auth.user.id,
          observacoes: observacoes ?? null,
        },
        include: {
          produto: { select: { id: true, nome: true, unidadeMedida: true } },
        },
      });

      // Atualiza estoque do produto com a quantidade contada
      await tx.produto.update({
        where: { negocioId_id: { negocioId: auth.user.negocioId, id: produtoId } },
        data: { quantidadeEstoque: qContada },
      });

      return ajuste;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

    return created(result);
  } catch (err) {
    if (err instanceof Error && err.message === "PRODUCT_NOT_FOUND") return notFound("Produto");
    if (err instanceof Error && err.message === "PRODUCT_INACTIVE") return unprocessable("Produto inativo não pode receber ajustes.");
    if (err instanceof Error && err.message === "CATEGORY_INACTIVE") return unprocessable("Produto em categoria inativa não pode receber ajustes.");
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2000") return badRequest("Um campo excede o limite permitido.");
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return notFound("Produto");
    return serverError(err);
  }
}
