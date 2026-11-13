import { Prisma } from "@prisma/client";

/** Strict decimal(12,2) parser: accepts decimal strings only, never JS floats. */
export function parseMoney(value: unknown): Prisma.Decimal | null {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(value)) return null;
  try { return new Prisma.Decimal(value); } catch { return null; }
}

export function moneyToString(value: Prisma.Decimal): string { return value.toFixed(2); }

