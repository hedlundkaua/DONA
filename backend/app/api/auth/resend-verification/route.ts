import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { FinalidadeOtp, StatusNegocio } from "@prisma/client";
import { deliverReservedOtp, normalizeEmail, reserveOtpSend } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { isValidEmail, parseJsonObject } from "@/lib/validators";
import { emailProviderConfigured } from "@/lib/auth-email";

const accepted = () => NextResponse.json({ success: true, data: { message: "Se houver uma verificação pendente, enviaremos instruções ao e-mail informado." } }, { status: 202 });
export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonObject(req);
    const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
    if (!body || Object.keys(body).join(",") !== "email" || !isValidEmail(email)) {
      return NextResponse.json({ success: false, error: "Informe um e-mail válido." }, { status: 400 });
    }
    if (!emailProviderConfigured()) return NextResponse.json({ success: false, error: "Serviço de email temporariamente indisponível." }, { status: 503 });
    const allowed = await reserveOtpSend(email, FinalidadeOtp.VERIFICAR_EMAIL);
    if (allowed) {
      const user = await prisma.usuario.findUnique({ where: { email }, include: { negocio: true } });
      if (user && user.ativo && !user.emailVerificadoEm && user.negocio.status === StatusNegocio.ATIVO) {
        await deliverReservedOtp(email, user.negocioId, user.id, FinalidadeOtp.VERIFICAR_EMAIL);
      }
    }
    return accepted();
  } catch { return accepted(); }
}
