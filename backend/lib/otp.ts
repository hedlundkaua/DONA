import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { FinalidadeOtp, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { sendAuthCode } from "./auth-email";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_SEND_LIMIT = 5;
export const OTP_SEND_WINDOW_MS = 60 * 60 * 1000;
const QUARANTINE_TENANT_ID = "00000000-0000-4000-8000-000000000005";

export function otpPepper(): Buffer {
  const pepper = process.env.OTP_PEPPER;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!pepper || Buffer.byteLength(pepper, "utf8") < 32) throw new Error("OTP_PEPPER must contain at least 32 bytes.");
  if (sessionSecret && pepper === sessionSecret) throw new Error("OTP_PEPPER must be distinct from SESSION_SECRET.");
  return Buffer.from(pepper, "utf8");
}

export function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }
export function otpThrottleKey(email: string, purpose: FinalidadeOtp): string {
  return createHmac("sha256", otpPepper()).update(`dona-otp-throttle:${purpose}:${normalizeEmail(email)}`).digest("hex");
}
export function hashOtp(code: string, purpose: FinalidadeOtp, usuarioId: number): string {
  return createHmac("sha256", otpPepper()).update(`dona-otp:${purpose}:${usuarioId}:${code}`).digest("hex");
}
export function newOtpCode(): string { return randomInt(0, 1_000_000).toString().padStart(6, "0"); }
export function constantEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex"); const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function reserveOtpSend(email: string, purpose: FinalidadeOtp): Promise<boolean> {
  const key = otpThrottleKey(email, purpose);
  const rows = await prisma.$queryRaw<Array<{ chave: string }>>`
    INSERT INTO limites_envio_otp (chave, finalidade, envios, janela_inicio, ultimo_envio, falhas_codigo, janela_falhas, updated_at)
    VALUES (${key}, ${purpose}::finalidade_otp, 1, NOW(), NOW(), 0, NULL, NOW())
    ON CONFLICT (chave) DO UPDATE SET
      envios = CASE WHEN limites_envio_otp.janela_inicio <= NOW() - INTERVAL '1 hour' THEN 1 ELSE limites_envio_otp.envios + 1 END,
      janela_inicio = CASE WHEN limites_envio_otp.janela_inicio <= NOW() - INTERVAL '1 hour' THEN NOW() ELSE limites_envio_otp.janela_inicio END,
      ultimo_envio = NOW(),
      updated_at = NOW()
    WHERE (limites_envio_otp.ultimo_envio <= NOW() - INTERVAL '60 seconds')
      AND (limites_envio_otp.janela_inicio <= NOW() - INTERVAL '1 hour' OR limites_envio_otp.envios < ${OTP_SEND_LIMIT})
    RETURNING chave
  `;
  return rows.length === 1;
}

export async function issueOtp(email: string, negocioId: string, usuarioId: number, purpose: FinalidadeOtp): Promise<boolean> {
  const allowed = await reserveOtpSend(email, purpose);
  if (!allowed) return false;
  return deliverReservedOtp(email, negocioId, usuarioId, purpose);
}

export async function deliverReservedOtp(email: string, negocioId: string, usuarioId: number, purpose: FinalidadeOtp): Promise<boolean> {
  const code = newOtpCode();
  const now = new Date();
  const key = otpThrottleKey(email, purpose);
  const hashCodigo = hashOtp(code, purpose, usuarioId);
  const challenge = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT chave FROM limites_envio_otp WHERE chave = ${key} FOR UPDATE`;
    return tx.codigoOtp.upsert({
      where: { negocioId_usuarioId_finalidade: { negocioId, usuarioId, finalidade: purpose } },
      create: { negocioId, usuarioId, finalidade: purpose, hashCodigo, expiraEm: new Date(now.getTime() + OTP_TTL_MS), envioPendente: true },
      update: { hashCodigo, expiraEm: new Date(now.getTime() + OTP_TTL_MS), tentativas: 0, consumidoEm: null, envioPendente: true, createdAt: now },
    });
  }, { maxWait: 10_000, timeout: 20_000 });
  const sent = await sendAuthCode(email, code, purpose === FinalidadeOtp.VERIFICAR_EMAIL ? "verification" : "reset");
  if (sent) await prisma.codigoOtp.updateMany({ where: { id: challenge.id, negocioId, hashCodigo, envioPendente: true }, data: { envioPendente: false } });
  return sent;
}

export async function failureWindowBlocked(email: string, purpose: FinalidadeOtp, now = new Date()): Promise<boolean> {
  const throttle = await prisma.limiteEnvioOtp.findUnique({ where: { chave: otpThrottleKey(email, purpose) }, select: { falhasCodigo: true, janelaFalhas: true } });
  return Boolean(throttle?.janelaFalhas && throttle.falhasCodigo >= OTP_MAX_ATTEMPTS && throttle.janelaFalhas.getTime() + OTP_TTL_MS > now.getTime());
}

export async function recordOtpFailure(tx: Prisma.TransactionClient, email: string, purpose: FinalidadeOtp): Promise<number> {
  const key = otpThrottleKey(email, purpose);
  const rows = await tx.$queryRaw<Array<{ falhas_codigo: number }>>`
    INSERT INTO limites_envio_otp (chave, finalidade, envios, janela_inicio, ultimo_envio, falhas_codigo, janela_falhas, updated_at)
    VALUES (${key}, ${purpose}::finalidade_otp, 0, NOW(), NOW() - INTERVAL '1 hour', 1, NOW(), NOW())
    ON CONFLICT (chave) DO UPDATE SET
      falhas_codigo = CASE WHEN limites_envio_otp.janela_falhas IS NULL OR limites_envio_otp.janela_falhas <= NOW() - INTERVAL '10 minutes' THEN 1 ELSE limites_envio_otp.falhas_codigo + 1 END,
      janela_falhas = CASE WHEN limites_envio_otp.janela_falhas IS NULL OR limites_envio_otp.janela_falhas <= NOW() - INTERVAL '10 minutes' THEN NOW() ELSE limites_envio_otp.janela_falhas END,
      updated_at = NOW()
    WHERE limites_envio_otp.janela_falhas IS NULL
       OR limites_envio_otp.janela_falhas <= NOW() - INTERVAL '10 minutes'
       OR limites_envio_otp.falhas_codigo < ${OTP_MAX_ATTEMPTS}
    RETURNING falhas_codigo
  `;
  return rows[0]?.falhas_codigo ?? OTP_MAX_ATTEMPTS;
}

export async function consumeOtp(
  negocioId: string,
  usuarioId: number,
  email: string,
  purpose: FinalidadeOtp,
  code: string,
  apply: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<boolean> {
  const key = otpThrottleKey(email, purpose);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const throttle = await tx.$queryRaw<Array<{ falhas_codigo: number; janela_falhas: Date | null }>>`
      SELECT falhas_codigo, janela_falhas FROM limites_envio_otp WHERE chave = ${key} FOR UPDATE
    `;
    const windowStart = throttle[0]?.janela_falhas;
    const blocked = Boolean(windowStart && windowStart.getTime() + OTP_TTL_MS > now.getTime() && throttle[0].falhas_codigo >= OTP_MAX_ATTEMPTS);
    if (blocked || !throttle[0]) return false;
    const challenge = await tx.codigoOtp.findUnique({
      where: { negocioId_usuarioId_finalidade: { negocioId, usuarioId, finalidade: purpose } },
    });
    if (!challenge || challenge.consumidoEm || challenge.expiraEm <= now || challenge.tentativas >= OTP_MAX_ATTEMPTS) return false;
    const valid = constantEqual(hashOtp(code, purpose, usuarioId), challenge.hashCodigo);
    if (!valid) {
      const changed = await tx.codigoOtp.updateMany({
        where: { id: challenge.id, negocioId, hashCodigo: challenge.hashCodigo, consumidoEm: null, expiraEm: { gt: now }, tentativas: { lt: OTP_MAX_ATTEMPTS } },
        data: { tentativas: { increment: 1 } },
      });
      if (changed.count !== 1) return false;
      await recordOtpFailure(tx, email, purpose);
      return false;
    }
    const consumed = await tx.codigoOtp.updateMany({
      where: { id: challenge.id, negocioId, hashCodigo: challenge.hashCodigo, consumidoEm: null, expiraEm: { gt: now }, tentativas: { lt: OTP_MAX_ATTEMPTS } },
      data: { consumidoEm: now },
    });
    if (consumed.count !== 1) return false;
    await apply(tx);
    return true;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10_000, timeout: 20_000 });
}

export { QUARANTINE_TENANT_ID };
