export function normalizeWhatsapp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const hadPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    // already in Brazil E.164 form
  } else if (!hadPlus && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`;
  } else return null;
  const national = digits.slice(2);
  const ddd = Number(national.slice(0, 2));
  if (ddd < 11 || ddd > 99 || (national.length !== 10 && national.length !== 11)) return null;
  return `+${digits}`;
}

export function normalizeInstagram(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/^@/, "");
  if (normalized.length > 30 || !/^[A-Za-z0-9._]{1,30}$/.test(normalized)) return undefined;
  return normalized;
}

export function validCustomerName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 2 && value.trim().length <= 150;
}
