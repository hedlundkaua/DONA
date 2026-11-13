import "server-only";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { FinalidadeOtp, StatusNegocio } from "@prisma/client";
import { createAudit } from "@/lib/auth";
import { consumeOtp, normalizeEmail } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { isValidEmail, parseJsonObject } from "@/lib/validators";

const invalidCode = () => NextResponse.json({ success: false, error: "Código inválido ou expirado." }, { status: 400 });
export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonObject(req);
    const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
    if (!body || Object.keys(body).sort().join(",") !== "codigo,email,novaSenha" || !isValidEmail(email)
      || typeof body.codigo !== "string" || !/^\d{6}$/.test(body.codigo)
      || typeof body.novaSenha !== "string" || body.novaSenha.length < 12 || Buffer.byteLength(body.novaSenha, "utf8") > 72) {
      return NextResponse.json({ success: false, error: "Informe e-mail, código válido e nova senha com ao menos 12 caracteres." }, { status: 400 });
    }
    const user = await prisma.usuario.findUnique({ where: { email }, include: { negocio: true } });
    if (!user || !user.ativo || user.negocio.status !== StatusNegocio.ATIVO) return invalidCode();
    const senhaHash = await bcrypt.hash(body.novaSenha, 12);
    const reset = await consumeOtp(user.negocioId, user.id, email, FinalidadeOtp.RECUPERAR_SENHA, body.codigo, async (tx) => {
      await tx.usuario.update({ where: { negocioId_id: { negocioId: user.negocioId, id: user.id } }, data: { senhaHash, authVersion: { increment: 1 } } });
      await tx.sessaoUsuario.updateMany({ where: { negocioId: user.negocioId, usuarioId: user.id, revogadaEm: null }, data: { revogadaEm: new Date() } });
      await createAudit(tx, user.negocioId, user.id, user.id, "PASSWORD_RESET", { source: "otp" });
    });
    if (!reset) return invalidCode();
    return NextResponse.json({ success: true, data: { message: "Senha alterada. Faça login novamente." } });
  } catch { return NextResponse.json({ success: false, error: "Não foi possível processar a solicitação." }, { status: 500 }); }
}
