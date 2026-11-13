import "server-only";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api-response";
import { clearLoginFailures, csrfForToken, hashSessionToken, loginBlocked, loginThrottleKey, newSessionToken, recordFailedLogin, sessionTtlSeconds, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { otpPepper } from "@/lib/otp";
import { parseJsonObject } from "@/lib/validators";

const dummyHash = bcrypt.hash(randomBytes(32).toString("hex"), 12);

export async function POST(req: NextRequest) {
  try {
    otpPepper();
    const body = await parseJsonObject(req);
    if (!body) return badRequest("Corpo JSON inválido.");
    const identifier = typeof body.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!identifier || identifier.length > 254 || !password || Buffer.byteLength(password, "utf8") > 72) {
      return badRequest("Informe usuário/e-mail e senha válidos.");
    }

    const throttleKey = loginThrottleKey(identifier);
    if (await loginBlocked(throttleKey)) return NextResponse.json({ success: false, error: "Muitas tentativas. Aguarde antes de tentar novamente." }, { status: 429, headers: { "Retry-After": "60" } });

    const user = await prisma.usuario.findFirst({
      where: { OR: [{ email: identifier }, { nomeUsuario: identifier }] },
      include: { negocio: true },
    });
    const storedHash = user?.senhaHash ?? await dummyHash;
    const matches = await bcrypt.compare(password, storedHash);
    if (!user || !user.ativo || !user.emailVerificadoEm || user.negocio.status !== "ATIVO" || !matches) {
      await recordFailedLogin(throttleKey);
      return NextResponse.json({ success: false, error: "Credenciais inválidas ou conta inativa." }, { status: 401 });
    }

    await clearLoginFailures(throttleKey);
    const token = newSessionToken();
    const csrfToken = csrfForToken(token);
    const expiresAt = new Date(Date.now() + sessionTtlSeconds() * 1000);
    await prisma.sessaoUsuario.create({ data: { negocioId: user.negocioId, usuarioId: user.id, authVersion: user.authVersion, tokenHash: hashSessionToken(token), expiraEm: expiresAt } });

    const response = NextResponse.json({ success: true, data: { user: {
      id: user.id, nome: user.nome, nomeUsuario: user.nomeUsuario, email: user.email, perfil: user.perfil,
    }, csrfToken } }, { status: 200 });
    setSessionCookie(response, token);
    return response;
  } catch (err) { return serverError(err); }
}
