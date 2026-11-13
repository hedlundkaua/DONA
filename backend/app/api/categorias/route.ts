/**
 * GET  /api/categorias      — lista categorias (filtro: ?ativo=true|false)
 * POST /api/categorias      — cria nova categoria
 *
 * Requisitos: Categoria do Produto Requisitos.docx
 *             FadConecta_Kaua_Hedlund (2).docx
 * RN: nome único, inativação nunca exclui histórico
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ok,
  created,
  badRequest,
  conflict,
  serverError,
} from "@/lib/api-response";
import { PerfilUsuario, Prisma } from "@prisma/client";
import { parseJsonObject } from "@/lib/validators";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req, Object.values(PerfilUsuario));
    if (!auth.ok) return auth.response;
    const { searchParams } = new URL(req.url);
    const ativoParam = searchParams.get("ativo");

    const where: Prisma.CategoriaProdutoWhereInput = { negocioId: auth.user.negocioId };
    if (ativoParam === "true") where.ativo = true;
    if (ativoParam === "false") where.ativo = false;

    const categorias = await prisma.categoriaProduto.findMany({
      where,
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        ativo: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { produtos: true } },
      },
    });

    return ok(categorias);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req, [PerfilUsuario.ADMINISTRADOR, PerfilUsuario.GESTOR]);
    if (!auth.ok) return auth.response;
    const body = await parseJsonObject(req);
    if (!body) return badRequest("Corpo JSON inválido; envie um objeto.");
    const { nome } = body;

    // Validações — RN-01 e RN-02
    if (!nome || typeof nome !== "string" || nome.trim().length === 0) {
      return badRequest("O campo 'nome' é obrigatório.");
    }

    if (nome.trim().length > 100) {
      return badRequest("O nome da categoria deve ter no máximo 100 caracteres.");
    }

    const categoria = await prisma.categoriaProduto.create({
      data: { negocioId: auth.user.negocioId, nome: nome.trim() },
    });

    return created(categoria);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return conflict("Já existe uma categoria com esse nome.");
    }
    return serverError(err);
  }
}
