import "server-only";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { FinalidadeOtp, PerfilUsuario, Prisma } from "@prisma/client";
import { requireUser, safeUserSelect, createAudit } from "@/lib/auth";
import { badRequest, conflict, created, ok, serverError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { isValidEmail, parseJsonObject } from "@/lib/validators";
import { issueOtp } from "@/lib/otp";
import { emailProviderConfigured } from "@/lib/auth-email";

function validIdentity(nome: unknown, nomeUsuario: unknown, email: unknown) {
  return typeof nome === "string" && nome.trim().length > 0 && nome.trim().length <= 150
    && typeof nomeUsuario === "string" && /^[a-zA-Z0-9._-]{3,50}$/.test(nomeUsuario)
    && isValidEmail(email);
}

function isRole(value: unknown): value is PerfilUsuario {
  return typeof value === "string" && Object.values(PerfilUsuario).includes(value as PerfilUsuario);
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req, [PerfilUsuario.ADMINISTRADOR]);
    if (!auth.ok) return auth.response;
    const ativo = req.nextUrl.searchParams.get("ativo");
    if (ativo !== null && ativo !== "true" && ativo !== "false") return badRequest("ativo deve ser true ou false.");
    const usuarios = await prisma.usuario.findMany({
      where: { negocioId: auth.user.negocioId, ...(ativo === null ? {} : { ativo: ativo === "true" }) },
      orderBy: { id: "asc" },
      select: safeUserSelect(),
    });
    return ok(usuarios);
  } catch (err) { return serverError(err); }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req, [PerfilUsuario.ADMINISTRADOR]);
    if (!auth.ok) return auth.response;
    const body = await parseJsonObject(req);
    if (!body || !validIdentity(body.nome, body.nomeUsuario, body.email) || !isRole(body.perfil)) return badRequest("Informe nome, nomeUsuario, email e perfil vÃ¡lidos.");
    if (typeof body.senha !== "string" || body.senha.length < 12 || Buffer.byteLength(body.senha, "utf8") > 72) return badRequest("A senha deve ter ao menos 12 caracteres e no mÃ¡ximo 72 bytes.");
    if (!emailProviderConfigured()) return Response.json({ success: false, error: "Serviço de email temporariamente indisponível." }, { status: 503 });
    const email = body.email.trim().toLowerCase();
    const nomeUsuario = body.nomeUsuario.trim().toLowerCase();
    const senhaHash = await bcrypt.hash(body.senha, 12);
    const usuario = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.usuario.create({
        data: { negocioId: auth.user.negocioId, nome: body.nome.trim(), nomeUsuario, email, senhaHash, perfil: body.perfil },
        select: { ...safeUserSelect(), negocioId: true },
      });
      await createAudit(tx, auth.user.negocioId, auth.user.id, createdUser.id, "USER_CREATED", { perfil: createdUser.perfil, emailVerificado: false });
      return createdUser;
    });
    await issueOtp(email, auth.user.negocioId, usuario.id, FinalidadeOtp.VERIFICAR_EMAIL);
    const { negocioId: _tenantId, ...safeUsuario } = usuario;
    return created(safeUsuario);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return conflict("Conflito ao criar usuário.");
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2000") return badRequest("Um campo excede o limite permitido.");
    return serverError(err);
  }
}
