import "server-only";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { FinalidadeOtp, PerfilUsuario, Prisma, StatusNegocio } from "@prisma/client";
import { createAudit } from "@/lib/auth";
import { deliverReservedOtp, normalizeEmail, reserveOtpSend } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { isValidEmail, parseJsonObject } from "@/lib/validators";
import { emailProviderConfigured } from "@/lib/auth-email";

const genericAccepted = () => NextResponse.json({ success: true, data: {
  status: "EMAIL_VERIFICATION_REQUIRED",
  message: "Se o cadastro puder ser processado, enviaremos instruções para verificar o e-mail.",
} }, { status: 202 });
const genericError = (status = 500) => NextResponse.json({ success: false, error: "Não foi possível processar a solicitação." }, { status });
function validPassword(value: unknown): value is string { return typeof value === "string" && value.length >= 12 && Buffer.byteLength(value, "utf8") <= 72; }
function validName(value: unknown): value is string { return typeof value === "string" && value.trim().length >= 2 && value.trim().length <= 150; }
function validUsername(value: unknown): value is string { return typeof value === "string" && /^[a-zA-Z0-9._-]{3,50}$/.test(value); }

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonObject(req);
    if (!body || Object.keys(body).sort().join(",") !== "email,nome,nomeUsuario,senha"
      || !validName(body.nome) || !validUsername(body.nomeUsuario) || !isValidEmail(body.email) || !validPassword(body.senha)) {
      return NextResponse.json({ success: false, error: "Informe nome, nomeUsuario, email e senha válidos (mínimo de 12 caracteres)." }, { status: 400 });
    }
    if (!emailProviderConfigured()) return genericError(503);
    const email = normalizeEmail(body.email);
    const allowed = await reserveOtpSend(email, FinalidadeOtp.VERIFICAR_EMAIL);
    if (!allowed) return genericAccepted();
    const senhaHash = await bcrypt.hash(body.senha, 12);
    const created = await prisma.$transaction(async (tx) => {
      const negocio = await tx.negocio.create({ data: { status: StatusNegocio.ATIVO } });
      const user = await tx.usuario.create({ data: {
        negocioId: negocio.id, nome: body.nome.trim(), nomeUsuario: body.nomeUsuario.trim().toLowerCase(),
        email, senhaHash, perfil: PerfilUsuario.ADMINISTRADOR, ativo: true,
      } });
      await createAudit(tx, negocio.id, null, user.id, "PUBLIC_ACCOUNT_REGISTERED", { perfil: PerfilUsuario.ADMINISTRADOR, emailVerificado: false });
      return { negocioId: negocio.id, userId: user.id };
    });
    await deliverReservedOtp(email, created.negocioId, created.userId, FinalidadeOtp.VERIFICAR_EMAIL);
    return genericAccepted();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return genericAccepted();
    return genericError();
  }
}
