import { NextRequest, NextResponse } from "next/server";
import { PerfilUsuario } from "@prisma/client";
import { clearSessionCookie, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serverError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req, Object.values(PerfilUsuario));
    if (!auth.ok) return auth.response;
    return NextResponse.json({ success: true, data: { user: auth.user, csrfToken: auth.csrfToken } });
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
