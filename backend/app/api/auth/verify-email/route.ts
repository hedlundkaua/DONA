import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { FinalidadeOtp, StatusNegocio } from "@prisma/client";
import { createAudit } from "@/lib/auth";
import { consumeOtp, normalizeEmail } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { isValidEmail, parseJsonObject } from "@/lib/validators";

const invalidCode = () => NextResponse.json({ success: false, error: "Código inválido ou expirado." }, { status: 400 });
const serverFailure = () => NextResponse.json({ success: false, error: "Não foi possível processar a solicitação." }, { status: 500 });
export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonObject(req);
    const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
    if (!body || Object.keys(body).sort().join(",") !== "codigo,email" || !isValidEmail(email)
      || typeof body.codigo !== "string" || !/^\d{6}$/.test(body.codigo)) return invalidCode();
    const user = await prisma.usuario.findUnique({ where: { email }, include: { negocio: true } });
    if (!user || !user.ativo || user.emailVerificadoEm || user.negocio.status !== StatusNegocio.ATIVO) return invalidCode();
    const verified = await consumeOtp(user.negocioId, user.id, email, FinalidadeOtp.VERIFICAR_EMAIL, body.codigo, async (tx) => {
      const updated = await tx.usuario.updateMany({ where: { id: user.id, negocioId: user.negocioId, ativo: true, emailVerificadoEm: null }, data: { emailVerificadoEm: new Date() } });
      if (updated.count !== 1) throw new Error("EMAIL_VERIFICATION_STATE_CHANGED");
      await createAudit(tx, user.negocioId, user.id, user.id, "EMAIL_VERIFIED", { source: "otp" });
    });
    if (!verified) return invalidCode();
    return NextResponse.json({ success: true, data: { status: "EMAIL_VERIFIED", message: "E-mail verificado. Faça login." } });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_VERIFICATION_STATE_CHANGED") return invalidCode();
    return serverFailure();
  }
}
