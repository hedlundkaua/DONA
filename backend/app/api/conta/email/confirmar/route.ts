import { FinalidadeOtp, PerfilUsuario, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { badRequest, ok, serverError } from "@/lib/api-response";
import { clearSessionCookie, createAudit, requireUser } from "@/lib/auth";
import { consumeOtp, normalizeEmail } from "@/lib/otp";
import { isValidEmail, parseJsonObject } from "@/lib/validators";

const invalid = () => badRequest("Código inválido ou expirado.");

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req, Object.values(PerfilUsuario));
    if (!auth.ok) return auth.response;
    const body = await parseJsonObject(req);
    const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
    if (!body || Object.keys(body).sort().join(",") !== "codigo,email" || !isValidEmail(email)
      || typeof body.codigo !== "string" || !/^\d{6}$/.test(body.codigo)) return invalid();
    const { negocioId, id } = auth.user;
    const confirmed = await consumeOtp(negocioId, id, email, FinalidadeOtp.ALTERAR_EMAIL, body.codigo, async tx => {
      const now = new Date();
      await tx.usuario.update({
        where: { negocioId_id: { negocioId, id }, ativo: true, authVersion: auth.authVersion },
        data: { email, emailVerificadoEm: now, authVersion: { increment: 1 } },
      });
      await tx.sessaoUsuario.updateMany({ where: { negocioId, usuarioId: id, revogadaEm: null }, data: { revogadaEm: now } });
      await tx.codigoOtp.updateMany({ where: { negocioId, usuarioId: id, consumidoEm: null }, data: { consumidoEm: now } });
      await createAudit(tx, negocioId, id, id, "ACCOUNT_EMAIL_CHANGED");
    }, auth.authVersion);
    if (!confirmed) return invalid();
    const response = ok({ message: "E-mail alterado. Faça login novamente." });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2025"].includes(error.code)) return invalid();
    return serverError(error);
  }
}
