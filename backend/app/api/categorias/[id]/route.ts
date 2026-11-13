/**
 * GET    /api/categorias/[id]  — detalha categoria
 * PUT    /api/categorias/[id]  — atualiza categoria (nome + ativo)
 * PATCH  /api/categorias/[id]  — atualiza parcialmente (ex.: só ativo)
 * DELETE /api/categorias/[id]  — inativa categoria (exclusão física PROIBIDA)
 *
 * RN-CAT-03: Categoria inativa não pode ser vinculada a novos produtos
 * RN-CAT-04: Alterações devem registrar data e horário (updatedAt automático)
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ok,
  badRequest,
  notFound,
  conflict,
  serverError,
} from "@/lib/api-response";
import { parseId, parseJsonObject } from "@/lib/validators";
import { PerfilUsuario, Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireUser(_req, Object.values(PerfilUsuario));
    if (!auth.ok) return auth.response;
    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (!id) return badRequest("ID inválido.");

    const categoria = await prisma.categoriaProduto.findFirst({
      where: { id, negocioId: auth.user.negocioId },
      include: { _count: { select: { produtos: true } } },
    });

    if (!categoria) return notFound("Categoria");
    return ok(categoria);
  } catch (err) {
    return serverError(err);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireUser(req, [PerfilUsuario.ADMINISTRADOR, PerfilUsuario.GESTOR]);
    if (!auth.ok) return auth.response;
    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (!id) return badRequest("ID inválido.");

    const body = await parseJsonObject(req);
    if (!body) return badRequest("Corpo JSON inválido; envie um objeto.");
    const { nome, ativo } = body;

    if (!nome || typeof nome !== "string" || nome.trim().length === 0) {
      return badRequest("O campo 'nome' é obrigatório.");
    }

    if (nome.trim().length > 100) {
      return badRequest("O nome deve ter no máximo 100 caracteres.");
    }
    if (ativo !== undefined && typeof ativo !== "boolean") return badRequest("ativo deve ser booleano.");

    const existing = await prisma.categoriaProduto.findFirst({ where: { id, negocioId: auth.user.negocioId } });
    if (!existing) return notFound("Categoria");

    const updated = await prisma.categoriaProduto.update({
      where: { negocioId_id: { negocioId: auth.user.negocioId, id } },
      data: {
        nome: nome.trim(),
        ativo: ativo ?? existing.ativo,
      },
    });

    return ok(updated);
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

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireUser(req, [PerfilUsuario.ADMINISTRADOR, PerfilUsuario.GESTOR]);
    if (!auth.ok) return auth.response;
    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (!id) return badRequest("ID inválido.");

    const body = await parseJsonObject(req);
    if (!body) return badRequest("Corpo JSON inválido; envie um objeto.");

    const existing = await prisma.categoriaProduto.findFirst({ where: { id, negocioId: auth.user.negocioId } });
    if (!existing) return notFound("Categoria");

    if (body.nome !== undefined && typeof body.nome !== "string") return badRequest("nome deve ser texto.");
    if (body.ativo !== undefined && typeof body.ativo !== "boolean") return badRequest("ativo deve ser booleano.");
    const data = {
      ...(body.nome !== undefined ? { nome: body.nome.trim() } : {}),
      ...(body.ativo !== undefined ? { ativo: body.ativo } : {}),
    };

    if (data.nome !== undefined && data.nome.length === 0) {
      return badRequest("O nome não pode ser vazio.");
    }

    if (data.nome !== undefined && data.nome.length > 100) {
      return badRequest("O nome deve ter no máximo 100 caracteres.");
    }

    const updated = await prisma.categoriaProduto.update({
      where: { negocioId_id: { negocioId: auth.user.negocioId, id } },
      data,
    });

    return ok(updated);
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

/**
 * DELETE inativa a categoria — exclusão física PROIBIDA.
 * Não permite inativar se houver produtos ativos vinculados (RN-CAT-03).
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireUser(_req, [PerfilUsuario.ADMINISTRADOR, PerfilUsuario.GESTOR]);
    if (!auth.ok) return auth.response;
    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (!id) return badRequest("ID inválido.");

    const existing = await prisma.categoriaProduto.findFirst({
      where: { id, negocioId: auth.user.negocioId },
      include: { _count: { select: { produtos: { where: { ativo: true } } } } },
    });
    if (!existing) return notFound("Categoria");

    if (existing._count.produtos > 0) {
      return conflict(
        `Categoria possui ${existing._count.produtos} produto(s) ativo(s) vinculado(s). Inative os produtos antes de inativar a categoria.`
      );
    }

    const updated = await prisma.categoriaProduto.update({
      where: { negocioId_id: { negocioId: auth.user.negocioId, id } },
      data: { ativo: false },
    });

    return ok({ message: "Categoria inativada com sucesso.", categoria: updated });
  } catch (err) {
    return serverError(err);
  }
}
