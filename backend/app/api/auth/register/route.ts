import "server-only";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { FinalidadeOtp, PerfilUsuario, Prisma, StatusNegocio } from "@prisma/client";
import { createAudit } from "@/lib/auth";
import { deliverReservedOtp, normalizeEmail, reserveOtpSend } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { generateUniqueUsername } from "@/lib/username";
import { isValidEmail, parseJsonObject } from "@/lib/validators";
import { emailProviderConfigured } from "@/lib/auth-email";
import { isValidNewPassword } from "@/lib/password-policy";

const genericAccepted = () => NextResponse.json({ success: true, data: {
  status: "EMAIL_VERIFICATION_REQUIRED",
  message: "Se o cadastro puder ser processado, enviaremos instruções para verificar o e-mail.",
} }, { status: 202 });
const genericError = (status = 500) => NextResponse.json({ success: false, error: "Não foi possível processar a solicitação." }, { status });
function validName(value: unknown): value is string { return typeof value === "string" && value.trim().length >= 2 && value.trim().length <= 150; }
function validCompany(value: unknown): value is string { return typeof value === "string" && value.trim().length >= 1 && value.trim().length <= 150; }
function validLegacyUsername(value: unknown): value is string { return typeof value === "string" && /^[a-zA-Z0-9._-]{3,50}$/.test(value); }

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonObject(req);
    if (!body) return NextResponse.json({ success: false, error: "Informe os dados de cadastro válidos." }, { status: 400 });
    const fields = Object.keys(body).sort().join(",");
    const newContract = fields === "email,nome,nomeEmpresa,senha";
    const legacyContract = fields === "email,nome,nomeUsuario,senha";
    const legacyBase = legacyContract && validLegacyUsername(body.nomeUsuario) ? body.nomeUsuario : null;
    if ((!newContract && !legacyContract) || !validName(body.nome) || !isValidEmail(body.email)
      || (newContract && !validCompany(body.nomeEmpresa)) || (legacyContract && !legacyBase) || !isValidNewPassword(body.senha)) {
      return NextResponse.json({ success: false, error: "Informe nome, nomeEmpresa, e-mail e uma senha válida (mínimo de 8 caracteres)." }, { status: 400 });
    }
    if (!emailProviderConfigured()) return genericError(503);

    const email = normalizeEmail(body.email);
    const allowed = await reserveOtpSend(email, FinalidadeOtp.VERIFICAR_EMAIL);
    if (!allowed) return genericAccepted();
    const senhaHash = await bcrypt.hash(body.senha, 12);
    const usernameBase = legacyBase ?? `${body.nome}.${email.split("@")[0]}`;
    let created: { negocioId: string; userId: number } | null = null;
    for (let attempt = 0; attempt < 8 && !created; attempt++) {
      const exists = async (candidate: string) => Boolean(await prisma.usuario.findUnique({ where: { nomeUsuario: candidate }, select: { id: true } }));
      const legacyCandidate = attempt === 0 && legacyBase ? legacyBase.toLowerCase() : null;
      const nomeUsuario = legacyCandidate && !await exists(legacyCandidate)
        ? legacyCandidate
        : await generateUniqueUsername(usernameBase, exists);
      try {
        created = await prisma.$transaction(async (tx) => {
          const negocio = await tx.negocio.create({ data: {
            nomeEmpresa: newContract ? body.nomeEmpresa.trim() : null,
            status: StatusNegocio.ATIVO,
          } });
          const user = await tx.usuario.create({ data: {
            negocioId: negocio.id, nome: body.nome.trim(), nomeUsuario, email, senhaHash,
            perfil: PerfilUsuario.ADMINISTRADOR, ativo: true,
          } });
          await createAudit(tx, negocio.id, null, user.id, "PUBLIC_ACCOUNT_REGISTERED", {
            perfil: PerfilUsuario.ADMINISTRADOR,
            emailVerificado: false,
            contract: legacyContract ? "legacy-compat" : "business-name-v1",
          });
          return { negocioId: negocio.id, userId: user.id };
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const emailExists = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
          if (emailExists) return genericAccepted();
          continue; // A concurrent username allocation won this candidate; generate another.
        }
        throw error;
      }
    }
    if (!created) return genericError(503);

    await deliverReservedOtp(email, created.negocioId, created.userId, FinalidadeOtp.VERIFICAR_EMAIL);
    return genericAccepted();
  } catch { return genericError(); }
}
