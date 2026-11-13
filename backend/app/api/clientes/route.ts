import "server-only";
import { NextRequest } from "next/server";
import { PerfilUsuario } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { badRequest, created, serverError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { normalizeInstagram, normalizeWhatsapp, validCustomerName } from "@/lib/customer-validation";
import { parseJsonObject } from "@/lib/validators";

const readRoles = [PerfilUsuario.ADMINISTRADOR, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR, PerfilUsuario.ESTOQUISTA];
const writeRoles = [PerfilUsuario.ADMINISTRADOR, PerfilUsuario.GESTOR];

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req, readRoles);
    if (!auth.ok) return auth.response;
    const active = req.nextUrl.searchParams.get("ativo");
    if (active !== null && active !== "true" && active !== "false") return badRequest("ativo deve ser true ou false.");
    const q = req.nextUrl.searchParams.get("q")?.trim();
    if (auth.user.perfil === PerfilUsuario.ESTOQUISTA && active === "false") return Response.json({ success: true, data: [] });
    if (auth.user.perfil === PerfilUsuario.ESTOQUISTA) {
      const clientes = await prisma.cliente.findMany({
        where: { negocioId: auth.user.negocioId, ativo: true, ...(q ? { nome: { contains: q, mode: "insensitive" } } : {}) },
        orderBy: [{ nome: "asc" }, { id: "asc" }], take: 100,
        select: { id: true, nome: true },
      });
      return Response.json({ success: true, data: clientes });
    }
    const clientes = await prisma.cliente.findMany({
      where: { negocioId: auth.user.negocioId, ...(active === null ? {} : { ativo: active === "true" }), ...(q ? { OR: [{ nome: { contains: q, mode: "insensitive" } }, { whatsapp: { contains: q } }] } : {}) },
      orderBy: [{ nome: "asc" }, { id: "asc" }], take: 100,
      select: { id: true, nome: true, whatsapp: true, instagram: true, ativo: true, createdAt: true, updatedAt: true, criadoPorId: true, atualizadoPorId: true },
    });
    return Response.json({ success: true, data: clientes });
  } catch (err) { return serverError(err); }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req, writeRoles);
    if (!auth.ok) return auth.response;
    const body = await parseJsonObject(req);
    if (!body || !validCustomerName(body.nome)) return badRequest("nome deve conter de 2 a 150 caracteres.");
    const whatsapp = normalizeWhatsapp(body.whatsapp);
    if (!whatsapp) return badRequest("whatsapp inválido; informe um número brasileiro com DDD.");
    const instagram = normalizeInstagram(body.instagram);
    if (body.instagram !== undefined && instagram === undefined) return badRequest("instagram inválido; use até 30 caracteres de usuário.");
    const cliente = await prisma.cliente.create({ data: { negocioId: auth.user.negocioId, nome: body.nome.trim(), whatsapp, instagram, criadoPorId: auth.user.id } });
    return Response.json({ success: true, data: cliente }, { status: 201 });
  } catch (err) { return serverError(err); }
}
