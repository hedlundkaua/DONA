import "server-only";
import { NextRequest } from "next/server";
import { FinalidadeOtp, PerfilUsuario, Prisma } from "@prisma/client";
import { requireUser, safeUserSelect, createAudit } from "@/lib/auth";
import { badRequest, conflict, notFound, ok, serverError, unprocessable } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { parseId, parseJsonObject } from "@/lib/validators";
import { issueOtp } from "@/lib/otp";

type Params = { params: Promise<{ id: string }> };
function isRole(value: unknown): value is PerfilUsuario {
  return typeof value === "string" && Object.values(PerfilUsuario).includes(value as PerfilUsuario);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireUser(req, [PerfilUsuario.ADMINISTRADOR]);
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badRequest("ID inválido.");
    const body = await parseJsonObject(req);
    if (!body || Object.keys(body).length === 0) return badRequest("Informe ao menos um campo para alterar.");
    const current = await prisma.usuario.findFirst({ where: { id, negocioId: auth.user.negocioId } });
    if (!current) return notFound("Usuário");

    if (body.nome !== undefined && (typeof body.nome !== "string" || !body.nome.trim() || body.nome.trim().length > 150)) return badRequest("nome deve conter de 1 a 150 caracteres.");
    if (body.nomeUsuario !== undefined && (typeof body.nomeUsuario !== "string" || !/^[a-zA-Z0-9._-]{3,50}$/.test(body.nomeUsuario))) return badRequest("nomeUsuario inválido.");
    if (body.email !== undefined && (typeof body.email !== "string" || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))) return badRequest("email inválido.");
    if (body.perfil !== undefined && !isRole(body.perfil)) return badRequest("perfil inválido.");
    if (body.ativo !== undefined && typeof body.ativo !== "boolean") return badRequest("ativo deve ser booleano.");
    if (body.senha !== undefined) return badRequest("Use /api/auth/password para alterar a própria senha.");

    const nextRole = body.perfil ?? current.perfil;
    const nextActive = body.ativo ?? current.ativo;
    if (id === auth.user.id && (nextRole !== current.perfil || nextActive !== current.ativo)) return unprocessable("Não é permitido alterar o próprio perfil ou status.");

    const emailWillChange = body.email !== undefined && body.email.trim().toLowerCase() !== current.email;
    const revokeSessions = !nextActive || nextRole !== current.perfil || emailWillChange;
    const usuario = await prisma.$transaction(async (tx) => {
      if (current.perfil === PerfilUsuario.ADMINISTRADOR && (!nextActive || nextRole !== PerfilUsuario.ADMINISTRADOR)) {
        await tx.$queryRaw`SELECT id FROM usuarios WHERE negocio_id = ${auth.user.negocioId}::uuid AND perfil = 'ADMINISTRADOR'::perfil_usuario AND ativo = true FOR UPDATE`;
        const admins = await tx.usuario.count({ where: { negocioId: auth.user.negocioId, perfil: PerfilUsuario.ADMINISTRADOR, ativo: true } });
        if (admins <= 1) throw new Error("LAST_ADMIN");
      }
      const updated = await tx.usuario.update({
        where: { negocioId_id: { negocioId: auth.user.negocioId, id } },
        data: {
          ...(body.nome !== undefined ? { nome: body.nome.trim() } : {}),
          ...(body.nomeUsuario !== undefined ? { nomeUsuario: body.nomeUsuario.trim().toLowerCase() } : {}),
          ...(body.email !== undefined ? { email: body.email.trim().toLowerCase(), emailVerificadoEm: body.email.trim().toLowerCase() === current.email ? current.emailVerificadoEm : null } : {}),
          ...(body.perfil !== undefined ? { perfil: body.perfil } : {}),
          ...(body.ativo !== undefined ? { ativo: body.ativo } : {}),
          ...(revokeSessions ? { authVersion: { increment: 1 } } : {}),
        },
        select: safeUserSelect(),
      });
      if (revokeSessions) await tx.sessaoUsuario.updateMany({ where: { negocioId: auth.user.negocioId, usuarioId: id, revogadaEm: null }, data: { revogadaEm: new Date() } });
      const details: Prisma.InputJsonObject = {
        camposAlterados: Object.keys(body).filter((key) => ["nome", "nomeUsuario", "email", "perfil", "ativo"].includes(key)),
        antes: { nome: current.nome, nomeUsuario: current.nomeUsuario, email: current.email, perfil: current.perfil, ativo: current.ativo },
        depois: { nome: updated.nome, nomeUsuario: updated.nomeUsuario, email: updated.email, perfil: updated.perfil, ativo: updated.ativo },
      };
      await createAudit(tx, auth.user.negocioId, auth.user.id, id, updated.ativo ? "USER_UPDATED" : "USER_DEACTIVATED", details);
      return updated;
    });
    if (emailWillChange) await issueOtp(usuario.email, auth.user.negocioId, usuario.id, FinalidadeOtp.VERIFICAR_EMAIL);
    return ok(usuario);
  } catch (err) {
    if (err instanceof Error && err.message === "LAST_ADMIN") return unprocessable("Não é permitido inativar ou rebaixar o último administrador ativo.");
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return conflict("E-mail ou nome de usuário já cadastrado.");
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2000") return badRequest("Um campo excede o limite permitido.");
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return notFound("Usuário");
    return serverError(err);
  }
}
