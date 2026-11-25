import { NextRequest, NextResponse } from "next/server";
import { PerfilUsuario } from "@prisma/client";
import { clearSessionCookie, publicAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serverError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req, Object.values(PerfilUsuario));
    if (!auth.ok) return auth.response;
    const remainingSeconds = Math.max(0, Math.ceil((auth.sessionExpiresAt.getTime() - Date.now()) / 1000));
    return NextResponse.json({ success: true, data: {
      user: publicAccount(auth.user),
      csrfToken: auth.csrfToken,
      expiresAt: auth.sessionExpiresAt.toISOString(),
      csrfMaxAgeSeconds: remainingSeconds,
    } });
  } catch (err) { return serverError(err); }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req, Object.values(PerfilUsuario));
    if (!auth.ok) return auth.response;
    await prisma.sessaoUsuario.updateMany({ where: { id: auth.sessionId, negocioId: auth.user.negocioId }, data: { revogadaEm: new Date() } });
    const response = NextResponse.json({ success: true, data: { message: "Sessão encerrada." } });
    clearSessionCookie(response);
    return response;
  } catch (err) { return serverError(err); }
}
