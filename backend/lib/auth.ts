import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { PerfilUsuario, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { otpPepper } from "./otp";

export type AuthenticatedUser = {
  id: number;
  negocioId: string;
  nome: string;
  nomeUsuario: string;
  email: string;
  perfil: PerfilUsuario;
  ativo: boolean;
};

export type AuthResult = { ok: true; user: AuthenticatedUser; sessionId: string; csrfToken: string } | { ok: false; response: NextResponse };

const cookieName = () => process.env.NODE_ENV === "production" ? "__Host-dona_session" : "dona_session";
const errorResponse = (status: number, error: string) => NextResponse.json({ success: false, error }, { status });

export function sessionTtlSeconds(): number {
  const value = process.env.SESSION_TTL_HOURS;
  const hours = value === undefined ? 12 : Number(value);
  if (!Number.isInteger(hours) || hours < 1 || hours > 168) throw new Error("SESSION_TTL_HOURS deve ser inteiro entre 1 e 168.");
  return hours * 60 * 60;
}

function sessionSecret(): Buffer {
  const configured = process.env.SESSION_SECRET;
  if (configured && Buffer.byteLength(configured) >= 32) return Buffer.from(configured, "utf8");
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET de pelo menos 32 bytes é obrigatório em produção.");
  // Segredo efêmero somente para desenvolvimento; reiniciar invalida as sessões existentes.
  const globalForAuth = globalThis as typeof globalThis & { __donaDevSessionSecret?: Buffer };
  globalForAuth.__donaDevSessionSecret ??= randomBytes(32);
  return globalForAuth.__donaDevSessionSecret;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function csrfForToken(token: string): string {
  return createHmac("sha256", sessionSecret()).update(`dona-csrf:${token}`).digest("hex");
}

export function loginThrottleKey(identifier: string): string {
  return createHmac("sha256", sessionSecret()).update(`dona-login:${identifier}`).digest("hex");
}

export async function loginBlocked(key: string, now = new Date()): Promise<boolean> {
  const throttle = await prisma.loginThrottle.findUnique({ where: { chave: key }, select: { bloqueadaAte: true } });
  return Boolean(throttle?.bloqueadaAte && throttle.bloqueadaAte > now);
}

export async function recordFailedLogin(key: string): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO login_throttles (chave, tentativas, janela_inicio, bloqueada_ate, updated_at)
    VALUES (${key}, 1, NOW(), NULL, NOW())
    ON CONFLICT (chave) DO UPDATE SET
      tentativas = CASE
        WHEN login_throttles.janela_inicio <= NOW() - INTERVAL '1 minute' THEN 1
        ELSE login_throttles.tentativas + 1
      END,
      janela_inicio = CASE
        WHEN login_throttles.janela_inicio <= NOW() - INTERVAL '1 minute' THEN NOW()
        ELSE login_throttles.janela_inicio
      END,
      bloqueada_ate = CASE
        WHEN (CASE WHEN login_throttles.janela_inicio <= NOW() - INTERVAL '1 minute' THEN 1 ELSE login_throttles.tentativas + 1 END) >= 10
          THEN NOW() + INTERVAL '1 minute'
        WHEN login_throttles.bloqueada_ate <= NOW() THEN NULL
        ELSE login_throttles.bloqueada_ate
      END,
      updated_at = NOW()
  `;
}

export async function clearLoginFailures(key: string): Promise<void> {
  await prisma.loginThrottle.deleteMany({ where: { chave: key } });
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function requestCookie(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  for (const entry of cookie.split(";")) {
    const index = entry.indexOf("=");
    if (index < 0 || entry.slice(0, index).trim() !== cookieName()) continue;
    try { return decodeURIComponent(entry.slice(index + 1).trim()); } catch { return null; }
  }
  return null;
}

export async function requireUser(request: Request, roles: PerfilUsuario[]): Promise<AuthResult> {
  otpPepper();
  const token = requestCookie(request);
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
    return { ok: false, response: errorResponse(401, "Autenticação necessária.") };
  }

  const session = await prisma.sessaoUsuario.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { usuario: { include: { negocio: true } } },
  });
  const now = new Date();
  if (!session || session.revogadaEm || session.expiraEm <= now || !session.usuario.ativo
    || !session.usuario.emailVerificadoEm || session.usuario.negocioId !== session.negocioId
    || session.authVersion !== session.usuario.authVersion
    || session.usuario.negocio.status !== "ATIVO") {
    return { ok: false, response: errorResponse(401, "Sessão inválida ou expirada.") };
  }

  const method = request.method.toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const supplied = request.headers.get("x-csrf-token") ?? "";
    if (!safeEqual(supplied, csrfForToken(token))) {
      return { ok: false, response: errorResponse(403, "Token CSRF ausente ou inválido.") };
    }
  }

  if (!roles.includes(session.usuario.perfil)) {
    return { ok: false, response: errorResponse(403, "Seu perfil não tem permissão para esta operação.") };
  }

  return {
    ok: true,
    user: {
      id: session.usuario.id,
      negocioId: session.usuario.negocioId,
      nome: session.usuario.nome,
      nomeUsuario: session.usuario.nomeUsuario,
      email: session.usuario.email,
      perfil: session.usuario.perfil,
      ativo: session.usuario.ativo,
    },
    sessionId: session.id,
    csrfToken: csrfForToken(token),
  };
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(cookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionTtlSeconds(),
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(cookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function safeUserSelect() {
  return { id: true, nome: true, nomeUsuario: true, email: true, perfil: true, ativo: true, createdAt: true } as const;
}

export async function createAudit(tx: Prisma.TransactionClient, negocioId: string, actorId: number | null, targetId: number | null, evento: string, detalhes: Prisma.InputJsonValue = {}) {
  await tx.auditoriaUsuario.create({ data: { negocioId, atorId: actorId, alvoId: targetId, evento, detalhes } });
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}
