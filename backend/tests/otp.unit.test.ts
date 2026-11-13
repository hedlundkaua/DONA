import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { FinalidadeOtp } from "@prisma/client";
import { constantEqual, hashOtp, newOtpCode, normalizeEmail, otpPepper } from "../lib/otp";
import { emailProviderConfigured, sendAuthCode } from "../lib/auth-email";

test("OTP configuration requires an independent 32-byte pepper", () => {
  const priorPepper = process.env.OTP_PEPPER;
  const priorSession = process.env.SESSION_SECRET;
  try {
    delete process.env.OTP_PEPPER;
    assert.throws(() => otpPepper());
    process.env.OTP_PEPPER = randomBytes(32).toString("base64url");
    process.env.SESSION_SECRET = process.env.OTP_PEPPER;
    assert.throws(() => otpPepper());
    process.env.OTP_PEPPER = randomBytes(32).toString("base64url");
    assert.ok(otpPepper().byteLength >= 32);
  } finally {
    if (priorPepper === undefined) delete process.env.OTP_PEPPER;
    else process.env.OTP_PEPPER = priorPepper;
    if (priorSession === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = priorSession;
  }
});

test("mail configuration fails closed and Ethereal test guard is exact", () => {
  const keys = ["NODE_ENV", "EMAIL_PROVIDER", "EMAIL_FROM", "RESEND_API_KEY", "EMAIL_SMTP_HOST", "EMAIL_SMTP_PORT", "EMAIL_SMTP_USER", "EMAIL_SMTP_PASSWORD", "DONA_TEST_MODE", "DATABASE_URL"];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  try {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.EMAIL_PROVIDER = "resend";
    process.env.EMAIL_FROM = "noreply@example.test";
    delete process.env.RESEND_API_KEY;
    assert.equal(emailProviderConfigured(), false);
    process.env.RESEND_API_KEY = "ephemeral-test-key";
    assert.equal(emailProviderConfigured(), true);
    process.env.EMAIL_PROVIDER = "ethereal";
    process.env.DONA_TEST_MODE = "1";
    process.env.DATABASE_URL = "postgresql://user@localhost:5433/dona_test_r5?schema=public";
    process.env.EMAIL_SMTP_HOST = "smtp.ethereal.email";
    process.env.EMAIL_SMTP_PORT = "587";
    process.env.EMAIL_SMTP_USER = "ephemeral-user";
    process.env.EMAIL_SMTP_PASSWORD = "ephemeral-password";
    assert.equal(emailProviderConfigured(), true);
    process.env.DATABASE_URL = "postgresql://user@[::1]:5433/dona_test_r5?schema=public";
    assert.equal(emailProviderConfigured(), true);
    process.env.DATABASE_URL = "postgresql://user@localhost:5433/dona_test_r4?schema=public";
    assert.equal(emailProviderConfigured(), false);
    process.env.DATABASE_URL = "postgresql://user@localhost:5432/dona_test_r5?schema=public";
    assert.equal(emailProviderConfigured(), false);
    process.env.DATABASE_URL = "postgresql://user@remote.example:5433/dona_test_r5?schema=public";
    assert.equal(emailProviderConfigured(), false);
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    process.env.DATABASE_URL = "postgresql://user@remote.example:5433/dona_test_r5?schema=public";
    assert.equal(emailProviderConfigured(), false);
    process.env.EMAIL_PROVIDER = "disabled";
    assert.equal(emailProviderConfigured(), false);
  } finally {
    for (const [key, value] of previous) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test("transient SMTP failure is reported internally without throwing or logging the code", async () => {
  const keys = ["NODE_ENV", "DATABASE_URL", "EMAIL_PROVIDER", "EMAIL_FROM", "EMAIL_SMTP_HOST", "EMAIL_SMTP_PORT", "EMAIL_SMTP_USER", "EMAIL_SMTP_PASSWORD"];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  const server = createServer(() => {
    // Accept the TCP connection but never send the SMTP greeting.
  });
  try {
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    process.env.DATABASE_URL = "postgresql://user@127.0.0.1:5433/dona_test_r5";
    process.env.EMAIL_PROVIDER = "ethereal";
    process.env.EMAIL_FROM = "DONA Test <noreply@example.test>";
    process.env.EMAIL_SMTP_HOST = "127.0.0.1";
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    process.env.EMAIL_SMTP_PORT = String(address.port);
    process.env.EMAIL_SMTP_USER = "ephemeral-user";
    process.env.EMAIL_SMTP_PASSWORD = randomBytes(16).toString("hex");
    const startedAt = Date.now();
    assert.equal(await sendAuthCode("r5@example.test", "123456", "verification"), false);
    assert.ok(Date.now() - startedAt < 5_000, "SMTP greeting timeout must stay below the frontend proxy timeout");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const [key, value] of previous) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test("codes are six digits; keyed hashes are purpose and user bound", () => {
  const code = newOtpCode();
  assert.match(code, /^\d{6}$/);
  assert.equal(normalizeEmail(" User@Example.Test "), "user@example.test");
  const priorPepper = process.env.OTP_PEPPER;
  try {
    process.env.OTP_PEPPER = randomBytes(32).toString("base64url");
    const valid = hashOtp(code, FinalidadeOtp.VERIFICAR_EMAIL, 123);
    assert.equal(constantEqual(valid, hashOtp(code, FinalidadeOtp.VERIFICAR_EMAIL, 123)), true);
    assert.equal(constantEqual(valid, hashOtp(code, FinalidadeOtp.RECUPERAR_SENHA, 123)), false);
    assert.equal(constantEqual(valid, hashOtp(code, FinalidadeOtp.VERIFICAR_EMAIL, 124)), false);
  } finally {
    if (priorPepper === undefined) delete process.env.OTP_PEPPER;
    else process.env.OTP_PEPPER = priorPepper;
  }
});
