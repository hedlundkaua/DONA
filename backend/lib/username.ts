import { randomBytes } from "node:crypto";

export function usernameBase(value: string): string {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const base = normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  return base || "usuario";
}

export async function generateUniqueUsername(base: string, exists: (candidate: string) => Promise<boolean>): Promise<string> {
  const prefix = usernameBase(base);
  for (let attempt = 0; attempt < 32; attempt++) {
    const candidate = `${prefix}_${randomBytes(4).toString("hex")}`.slice(0, 50);
    if (!await exists(candidate)) return candidate;
  }
  throw new Error("USERNAME_GENERATION_EXHAUSTED");
}
