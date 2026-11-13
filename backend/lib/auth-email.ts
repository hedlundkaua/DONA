import nodemailer from "nodemailer";

type CodePurpose = "verification" | "reset";
function etherealTestRuntime(): boolean {
  const allowedMode = process.env.NODE_ENV === "test"
    || (process.env.NODE_ENV === "production" && process.env.DONA_TEST_MODE === "1");
  if (!allowedMode) return false;
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    const database = decodeURIComponent(url.pathname.slice(1));
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    return ["postgres:", "postgresql:"].includes(url.protocol)
      && ["localhost", "127.0.0.1", "::1"].includes(hostname)
      && url.port === "5433"
      && database === "dona_test_r5";
  } catch { return false; }
}

export function emailProviderConfigured(): boolean {
  const provider = process.env.EMAIL_PROVIDER;
  const from = process.env.EMAIL_FROM?.trim();
  if (!from) return false;
  if (provider === "resend") return process.env.NODE_ENV === "production" && Boolean(process.env.RESEND_API_KEY?.trim());
  if (provider === "smtp") {
    const port = Number(process.env.EMAIL_SMTP_PORT ?? "587");
    return process.env.NODE_ENV === "production"
      && process.env.EMAIL_SMTP_HOST?.trim().toLowerCase() === "smtp.gmail.com"
      && [465, 587].includes(port)
      && Boolean(process.env.EMAIL_SMTP_USER?.trim() && process.env.EMAIL_SMTP_PASSWORD);
  }
  if (provider === "ethereal") {
    const port = Number(process.env.EMAIL_SMTP_PORT ?? "587");
    return etherealTestRuntime() && Boolean(process.env.EMAIL_SMTP_HOST?.trim() && process.env.EMAIL_SMTP_USER?.trim() && process.env.EMAIL_SMTP_PASSWORD)
      && Number.isInteger(port) && port > 0 && port <= 65535;
  }
  return false;
}
const purposeText = (purpose: CodePurpose) => purpose === "verification" ? "verificaÃ§Ã£o do e-mail" : "redefiniÃ§Ã£o da senha";

/** Delivers codes only through the selected provider. It never logs message bodies, recipients, or codes. */
export async function sendAuthCode(to: string, code: string, purpose: CodePurpose): Promise<boolean> {
  if (!emailProviderConfigured()) return false;
  const provider = process.env.EMAIL_PROVIDER;
  const subject = purpose === "verification" ? "CÃ³digo de verificaÃ§Ã£o DONA" : "CÃ³digo para redefinir sua senha DONA";
  const text = `Seu cÃ³digo para ${purposeText(purpose)} Ã© ${code}. Ele expira em 10 minutos. Se vocÃª nÃ£o solicitou esta aÃ§Ã£o, ignore esta mensagem.`;
  const html = `<p>Seu cÃ³digo para ${purposeText(purpose)} Ã© <strong>${code}</strong>.</p><p>Ele expira em 10 minutos. Se vocÃª nÃ£o solicitou esta aÃ§Ã£o, ignore esta mensagem.</p>`;

  try {
    if (provider === "ethereal") {
      if (!etherealTestRuntime()) return false;
      const host = process.env.EMAIL_SMTP_HOST;
      const port = Number(process.env.EMAIL_SMTP_PORT ?? "587");
      const user = process.env.EMAIL_SMTP_USER;
      const pass = process.env.EMAIL_SMTP_PASSWORD;
      const from = process.env.EMAIL_FROM;
      if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !pass || !from) return false;
      const transport = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        connectionTimeout: 5_000,
        greetingTimeout: 3_000,
        socketTimeout: 8_000,
      });
      try {
        const info = await transport.sendMail({ from, to, subject, text, html });
        if (process.env.ETHEREAL_TEST_CAPTURE_URL && info.messageId) {
          // Test harness receives only the Ethereal message id; OTP stays in the Ethereal mailbox.
          try {
            await fetch(process.env.ETHEREAL_TEST_CAPTURE_URL, {
              method: "POST", headers: { "content-type": "application/json" },
              body: JSON.stringify({ messageId: info.messageId }), signal: AbortSignal.timeout(1000),
            });
          } catch { /* delivery result is independent of test instrumentation */ }
        }
        return true;
      } finally {
        transport.close();
      }
    }

    if (provider === "resend") {
      if (process.env.NODE_ENV !== "production") return false;
      const key = process.env.RESEND_API_KEY;
      const from = process.env.EMAIL_FROM;
      if (!key || !from) return false;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, text, html }),
        signal: AbortSignal.timeout(8000),
      });
      return response.ok;
    }

    if (provider === "smtp") {
      if (process.env.NODE_ENV !== "production") return false;
      const host = process.env.EMAIL_SMTP_HOST?.trim();
      const port = Number(process.env.EMAIL_SMTP_PORT ?? "587");
      const user = process.env.EMAIL_SMTP_USER?.trim();
      const pass = process.env.EMAIL_SMTP_PASSWORD;
      const from = process.env.EMAIL_FROM?.trim();
      if (host?.toLowerCase() !== "smtp.gmail.com" || ![465, 587].includes(port) || !user || !pass || !from) return false;
      const transport = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        requireTLS: port === 587,
        auth: { user, pass },
        connectionTimeout: 8_000,
        greetingTimeout: 5_000,
        socketTimeout: 12_000,
      });
      try {
        const info = await transport.sendMail({ from, to, subject, text, html });
        return Boolean(info.messageId);
      } finally {
        transport.close();
      }
    }

    // Disabled delivery is allowed only for local development; there is no console fallback.
    return provider === "disabled" && process.env.NODE_ENV !== "production";
  } catch {
    // Never log mail-provider errors: transport diagnostics can contain addresses or message data.
    return false;
  }
}
