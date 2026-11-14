import "server-only";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { PerfilUsuario } from "@prisma/client";
import { clearSessionCookie, createAudit, requireUser } from "@/lib/auth";
import { badRequest, serverError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { parseJsonObject } from "@/lib/validators";
import { isValidNewPassword } from "@/lib/password-policy";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req, Object.values(PerfilUsuario));
    if (!auth.ok) return auth.response;
    const body = await parseJsonObject(req);
    if (!body || typeof body.currentPassword !== "string" || typeof body.newPassword !== "string") return badRequest("Informe a senha atual e a nova senha.");
    if (!isValidNewPassword(body.newPassword)) return badRequest("Password needs 8 characters, max 72 UTF-8 bytes, and cannot be on the common-password list.");
    const user = await prisma.usuario.findFirst({ where: { id: auth.user.id, negocioId: auth.user.negocioId } });
    if (!user || !await bcrypt.compare(body.currentPassword, user.senhaHash)) return NextResponse.json({ success: false, error: "Senha atual inválida." }, { status: 401 });
    const senhaHash = await bcrypt.hash(body.newPassword, 12);
    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { negocioId_id: { negocioId: user.negocioId, id: user.id } }, data: { senhaHash, authVersion: { increment: 1 } } });
      await tx.sessaoUsuario.updateMany({ where: { negocioId: user.negocioId, usuarioId: user.id, revogadaEm: null }, data: { revogadaEm: new Date() } });
      await createAudit(tx, user.negocioId, user.id, user.id, "PASSWORD_CHANGED");
    }, { maxWait: 10_000, timeout: 20_000 });
    const response = NextResponse.json({ success: true, data: { message: "Senha alterada; entre novamente." } });
    clearSessionCookie(response);
    return response;
  } catch (err) { return serverError(err); }
}
