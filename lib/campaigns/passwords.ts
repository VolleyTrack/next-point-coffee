import { compare, hash } from "bcryptjs";

const ROUNDS = 10;

/**
 * bcrypt hash of a string that is not a valid partner password.
 * Login compares against this when the account has no hash so unknown
 * emails take about as long as a real check.
 */
export const DUMMY_PASSWORD_HASH =
  "$2b$10$jDIs3VL1TAqwxSmbAcL.ceeTK9OhlZHVV.JQfygAKGFg3wg1ZXNOS";

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (!password || !passwordHash) return false;
  return compare(password, passwordHash);
}

const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Unambiguous temporary password. Shown once to the admin; only the hash is stored. */
export function generateTemporaryPassword(length = 14): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) {
    out += TEMP_PASSWORD_ALPHABET[byte % TEMP_PASSWORD_ALPHABET.length];
  }
  return out;
}
