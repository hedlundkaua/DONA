export const PASSWORD_MIN_CHARACTERS = 8;
export const PASSWORD_MAX_BYTES = 72;

// Local denylist only; no remote password service or password logging.
export const BLOCKED_COMMON_PASSWORDS = Object.freeze([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "qwerty123",
  "letmein",
  "welcome1",
  "iloveyou",
  "admin123",
  "senha123",
  "abc12345",
] as const);

const blocked = new Set<string>(BLOCKED_COMMON_PASSWORDS);

export function isValidNewPassword(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if ([...value].length < PASSWORD_MIN_CHARACTERS || Buffer.byteLength(value, "utf8") > PASSWORD_MAX_BYTES) return false;
  return !blocked.has(value.toLowerCase());
}
