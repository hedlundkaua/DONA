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
import { isValidNewPassword } from "@/lib/password-policy";
import { generateUniqueUsername } from "@/lib/username";

function validIdentity(nome: unknown, email: unknown) {
  return typeof nome === "string" && nome.trim().length > 0 && nome.trim().length <= 150
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
    const fields = body ? Object.keys(body).sort().join(",") : "";
    const currentContract = fields === "email,nome,perfil,senha";
    const legacyContract = fields === "email,nome,nomeUsuario,perfil,senha";
    const legacyBase = body && legacyContract && typeof body.nomeUsuario === "string" && /^[a-zA-Z0-9._-]{3,50}$/.test(body.nomeUsuario) ? body.nomeUsuario : null;
    if (!body || (!currentContract && !legacyContract) || !validIdentity(body.nome, body.email) || !isRole(body.perfil) || (legacyContract && !legacyBase)) return badRequest("Informe nome, email e perfil válidos.");
    if (!isValidNewPassword(body.senha)) return badRequest("Password needs 8 characters, max 72 UTF-8 bytes, and cannot be on the common-password list.");
    if (!emailProviderConfigured()) return Response.json({ success: false, error: "Serviço de email temporariamente indisponível." }, { status: 503 });
    const email = body.email.trim().toLowerCase();
    const senhaHash = await bcrypt.hash(body.senha, 12);
    let usuario: { id: number; negocioId: string; nome: string; nomeUsuario: string; email: string; perfil: PerfilUsuario; ativo: boolean; createdAt: Date } | null = null;
    for (let attempt = 0; attempt < 8 && !usuario; attempt++) {
      const exists = async (candidate: string) => Boolean(await prisma.usuario.findUnique({ where: { nomeUsuario: candidate }, select: { id: true } }));
      const legacyCandidate = attempt === 0 && legacyBase ? legacyBase.toLowerCase() : null;
      const nomeUsuario = legacyCandidate && !await exists(legacyCandidate) ? legacyCandidate : await generateUniqueUsername(legacyBase ?? `${body.nome}.${email.split("@")[0]}`, exists);
      try {
        usuario = await prisma.$transaction(async (tx) => {
          const createdUser = await tx.usuario.create({
            data: { negocioId: auth.user.negocioId, nome: body.nome.trim(), nomeUsuario, email, senhaHash, perfil: body.perfil },
            select: { ...safeUserSelect(), negocioId: true },
          });
          await createAudit(tx, auth.user.negocioId, auth.user.id, createdUser.id, "USER_CREATED", { perfil: createdUser.perfil, emailVerificado: false });
          return createdUser;
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          const emailExists = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
          if (emailExists) return conflict("Conflito ao criar usuário.");
          continue;
        }
        throw err;
      }
    }
    if (!usuario) return serverError(new Error("Username allocation exhausted."));
    await issueOtp(email, auth.user.negocioId, usuario.id, FinalidadeOtp.VERIFICAR_EMAIL);
    const { negocioId: _tenantId, ...safeUsuario } = usuario;
    return created(safeUsuario);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return conflict("Conflito ao criar usuário.");
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2000") return badRequest("Um campo excede o limite permitido.");
    return serverError(err);
  }
}
