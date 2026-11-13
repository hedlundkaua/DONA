import "server-only";
import { NextRequest } from "next/server";
import { PerfilUsuario } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, ok, serverError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { normalizeInstagram, normalizeWhatsapp, validCustomerName } from "@/lib/customer-validation";
import { parseId, parseJsonObject } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };
const writeRoles = [PerfilUsuario.ADMINISTRADOR, PerfilUsuario.GESTOR];

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireUser(req, [PerfilUsuario.ADMINISTRADOR, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR]);
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badRequest("ID inválido.");
    const cliente = await prisma.cliente.findFirst({ where: { id, negocioId: auth.user.negocioId } });
    return cliente ? ok(cliente) : notFound("Cliente");
  } catch (err) { return serverError(err); }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireUser(req, writeRoles);
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badRequest("ID inválido.");
    const body = await parseJsonObject(req);
    if (!body || Object.keys(body).length === 0) return badRequest("Informe campos para atualizar.");
    const current = await prisma.cliente.findFirst({ where: { id, negocioId: auth.user.negocioId }, select: { id: true } });
    if (!current) return notFound("Cliente");
    if (body.nome !== undefined && !validCustomerName(body.nome)) return badRequest("nome deve conter de 2 a 150 caracteres.");
    if (body.ativo !== undefined && typeof body.ativo !== "boolean") return badRequest("ativo deve ser booleano.");
    let whatsapp: string | undefined;
    if (body.whatsapp !== undefined) {
      const normalized = normalizeWhatsapp(body.whatsapp);
      if (!normalized) return badRequest("whatsapp inválido; informe um número brasileiro com DDD.");
      whatsapp = normalized;
    }
    const instagram = normalizeInstagram(body.instagram);
    if (body.instagram !== undefined && instagram === undefined) return badRequest("instagram inválido; use até 30 caracteres de usuário.");
    const cliente = await prisma.cliente.update({ where: { negocioId_id: { negocioId: auth.user.negocioId, id } }, data: {
      ...(body.nome !== undefined ? { nome: body.nome.trim() } : {}),
      ...(whatsapp !== undefined ? { whatsapp } : {}),
      ...(instagram !== undefined ? { instagram } : {}),
      ...(body.ativo !== undefined ? { ativo: body.ativo } : {}),
      atualizadoPorId: auth.user.id,
    } });
    return ok(cliente);
  } catch (err) { return serverError(err); }
}
