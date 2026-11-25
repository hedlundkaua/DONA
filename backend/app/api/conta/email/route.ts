import { FinalidadeOtp, PerfilUsuario } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { badRequest, forbidden, ok, serverError } from "@/lib/api-response";
import { clearLoginFailures, loginBlocked, loginThrottleKey, recordFailedLogin, requireUser } from "@/lib/auth";
import { emailProviderConfigured } from "@/lib/auth-email";
import { deliverReservedOtp, normalizeEmail, reserveOtpSend } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { isValidEmail, parseJsonObject } from "@/lib/validators";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req, Object.values(PerfilUsuario));
    if (!auth.ok) return auth.response;
    const body = await parseJsonObject(req);
    const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
    if (!body || Object.keys(body).sort().join(",") !== "email,senhaAtual" || !isValidEmail(email)
      || typeof body.senhaAtual !== "string" || !body.senhaAtual || Buffer.byteLength(body.senhaAtual) > 72) {
      return badRequest("Informe o novo e-mail e a senha atual.");
    }
    if (email === auth.user.email) return badRequest("Informe um endereço diferente do atual.");
    const throttle = loginThrottleKey("change-email:" + auth.user.id);
    if (await loginBlocked(throttle)) return NextResponse.json({ success: false, error: "Aguarde antes de tentar novamente." }, { status: 429, headers: { "Retry-After": "60" } });
    const owner = await prisma.usuario.findFirst({ where: { id: auth.user.id, negocioId: auth.user.negocioId, authVersion: auth.authVersion, ativo: true }, select: { senhaHash: true } });
    if (!owner || !await bcrypt.compare(body.senhaAtual, owner.senhaHash)) {
      await recordFailedLogin(throttle);
      return forbidden("Senha atual inválida.");
    }
    await clearLoginFailures(throttle);
    if (!emailProviderConfigured()) return NextResponse.json({ success: false, error: "Envio de e-mail indisponível." }, { status: 503 });
    const purpose = FinalidadeOtp.ALTERAR_EMAIL;
    const actorAllowed = await reserveOtpSend("account:" + auth.user.id, purpose);
    if (actorAllowed && await reserveOtpSend(email, purpose)) {
      const existing = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
      if (!existing) await deliverReservedOtp(email, auth.user.negocioId, auth.user.id, purpose, auth.authVersion);
    }
    return ok({ message: "Se a alteração puder ser realizada, você receberá um código no novo e-mail." }, 202);
  } catch (error) { return serverError(error); }
}
