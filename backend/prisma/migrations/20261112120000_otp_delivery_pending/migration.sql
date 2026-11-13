-- Delivery failures remain retryable by issuing another OTP after cooldown.
ALTER TABLE "codigos_otp"
  ADD COLUMN "envio_pendente" BOOLEAN NOT NULL DEFAULT TRUE;
