/**
 * Helpers de validação reutilizáveis para as rotas da API
 */

/** Validação sintática conservadora: exige domínio com rótulos não vazios. */
export function isValidEmail(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 254) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
  const at = value.indexOf("@");
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!local || !domain || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) return false;
  return true;
}

/** Verifica se um ID de rota é um inteiro válido */
export function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Remove campos undefined de um objeto (para updates parciais) */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

/** Valida se um Decimal string é positivo */
export function isPositiveDecimal(value: unknown): boolean {
  return isValidDecimal(value) && Number(value) >= 0;
}

/** Valida se um Decimal string é estritamente positivo */
export function isStrictlyPositive(value: unknown): boolean {
  return isValidDecimal(value) && Number(value) > 0;
}

/** Decimal finito com no máximo duas casas, aceito como number ou string. */
export function isValidDecimal(value: unknown): boolean {
  if (typeof value !== "number" && typeof value !== "string") return false;
  if (typeof value === "string" && value.trim() === "") return false;
  const n = Number(value);
  return Number.isFinite(n) && /^\d+(\.\d{1,2})?$/.test(String(value).trim());
}

/** Verifies decimal(precision,2) bounds, where maxIntegerDigits = precision - 2. */
export function fitsDecimal(value: unknown, maxIntegerDigits: number): boolean {
  if (!isValidDecimal(value)) return false;
  const normalized = String(value).trim();
  const integerPart = normalized.split(".")[0];
  return integerPart.length <= maxIntegerDigits;
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function isOptionalString(value: unknown, maxLength: number): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.length <= maxLength);
}

/** Lê apenas objetos JSON e torna JSON malformado/tipo inesperado num 400 tratável. */
export async function parseJsonObject(request: Request): Promise<Record<string, any> | null> {
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, any>
      : null;
  } catch {
    return null;
  }
}

export function isValidDateInput(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Parse query date; date-only `ate` is exclusive next midnight to include the full day. */
export function parseDateFilter(value: string, endOfDay = false): { date: Date; exclusive: boolean } | null {
  if (isValidDateInput(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
    return { date, exclusive: endOfDay };
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? { date, exclusive: false } : null;
}
