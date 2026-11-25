import { PerfilUsuario, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { createAudit, publicAccount, requireUser } from "@/lib/auth";
import { badRequest, conflict, forbidden, ok, serverError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { parseJsonObject } from "@/lib/validators";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req, Object.values(PerfilUsuario));
    return auth.ok ? ok(publicAccount(auth.user)) : auth.response;
  } catch (error) { return serverError(error); }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireUser(req, Object.values(PerfilUsuario));
    if (!auth.ok) return auth.response;
    const body = await parseJsonObject(req);
    const fields = Object.keys(body ?? {});
    if (!body || !fields.length || fields.some(key => !["nome", "nomeUsuario", "nomeEmpresa"].includes(key))) {
      return badRequest("Informe nome, nome de usuário ou nome da empresa.");
    }
    const nome = typeof body.nome === "string" ? body.nome.trim() : "";
    const nomeUsuario = typeof body.nomeUsuario === "string" ? body.nomeUsuario.trim().toLowerCase() : "";
    const nomeEmpresa = typeof body.nomeEmpresa === "string" ? body.nomeEmpresa.trim() : "";
    if (body.nome !== undefined && (nome.length < 2 || nome.length > 150)) return badRequest("O nome deve ter de 2 a 150 caracteres.");
    if (body.nomeUsuario !== undefined && !/^[a-z0-9._-]{3,50}$/.test(nomeUsuario)) return badRequest("Nome de usuário inválido.");
    if (body.nomeEmpresa !== undefined && auth.user.perfil !== PerfilUsuario.ADMINISTRADOR) return forbidden();
    if (body.nomeEmpresa !== undefined && (!nomeEmpresa || nomeEmpresa.length > 150)) return badRequest("A empresa deve ter de 1 a 150 caracteres.");

    const user = await prisma.$transaction(async tx => {
      const { id, negocioId } = auth.user;
      const changed = await tx.usuario.update({
        where: { negocioId_id: { negocioId, id }, ativo: true, authVersion: auth.authVersion },
        data: { ...(nome && { nome }), ...(nomeUsuario && { nomeUsuario }) },
        select: { id: true, nome: true, nomeUsuario: true, email: true, perfil: true, ativo: true, negocio: { select: { nomeEmpresa: true } } },
      });
      const empresa = nomeEmpresa
        ? await tx.negocio.update({ where: { id: negocioId }, data: { nomeEmpresa }, select: { nomeEmpresa: true } })
        : changed.negocio;
      await createAudit(tx, negocioId, id, id, "ACCOUNT_UPDATED", { campos: fields });
      const { negocio: _negocio, ...account } = changed;
      return { ...account, nomeEmpresa: empresa.nomeEmpresa };
    });
    return ok(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return conflict("Dados de acesso indisponíveis.");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return forbidden();
    return serverError(error);
  }
}
