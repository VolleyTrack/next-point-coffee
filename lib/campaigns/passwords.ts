import { compare, hash } from "bcryptjs";
import type { PortalUser } from "./types";

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

export const MIN_PORTAL_PASSWORD_LENGTH = 8;

export function newPasswordRejection(password: string, confirm: string): string | null {
  if (password.length < MIN_PORTAL_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PORTAL_PASSWORD_LENGTH} characters.`;
  }
  if (password !== confirm) {
    return "Those passwords do not match.";
  }
  return null;
}

/**
 * Replace a temporary password. Rejects a short password, a mismatch,
 * an account that is not awaiting a change, and reuse of the current password.
 */
export async function applyPortalPasswordChange(
  user: PortalUser,
  password: string,
  confirm: string
): Promise<void> {
  const rejection = newPasswordRejection(password, confirm);
  if (rejection) throw new Error(rejection);
  if (!user.passwordHash) throw new Error("Account not found.");
  if (!user.mustChangePassword) throw new Error("This account already has a password.");
  if (await verifyPassword(password, user.passwordHash)) {
    throw new Error("Choose a different password than the temporary one.");
  }
  user.passwordHash = await hashPassword(password);
  user.mustChangePassword = false;
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
