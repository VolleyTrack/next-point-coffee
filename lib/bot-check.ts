/**
 * Invisible bot screen for public signup and lead forms.
 *
 * Humans get an off-screen honeypot and a form-render timestamp from the client.
 * The API route must call this before storing a lead or sending mail. A blocked
 * submission is not an error response — callers return the same success JSON a
 * real signup gets, so a bot cannot tell that it was dropped.
 */

export const HONEYPOT_FIELD = "company_website";
export const FORM_STARTED_FIELD = "form_started_at";

/**
 * Reject submits faster than this. Two seconds is the low end of the requested
 * window so a one-field waitlist (paste + enter) is less likely to be dropped.
 */
export const MIN_SUBMIT_MS = 2000;

/** Millisecond timestamps below this are seconds, zero, or otherwise unusable. */
const EARLIEST_MS_TIMESTAMP = 1_000_000_000_000;

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"] as const;

export type BotBlockReason = "honeypot" | "too_fast" | "missing_timing" | "junk_email";

export type BotVerdict = { bot: false } | { bot: true; reason: BotBlockReason };

export interface AssessBotOptions {
  now?: number;
  /** Email fields to screen. Omitted or empty values are ignored. */
  emails?: readonly unknown[];
}

export function assessPublicFormSubmission(body: unknown, options: AssessBotOptions = {}): BotVerdict {
  const now = options.now ?? Date.now();
  const record = asRecord(body);

  if (honeypotTripped(record)) return { bot: true, reason: "honeypot" };

  const startedAt = readStartedAt(record);
  if (startedAt == null || startedAt < EARLIEST_MS_TIMESTAMP) {
    return { bot: true, reason: "missing_timing" };
  }
  if (now - startedAt < MIN_SUBMIT_MS) return { bot: true, reason: "too_fast" };

  if ((options.emails ?? []).some((email) => typeof email === "string" && isObviouslyJunkEmail(email))) {
    return { bot: true, reason: "junk_email" };
  }

  return { bot: false };
}

/** Log one short line and report whether the caller should pretend success. */
export function rejectBotSubmission(form: string, verdict: BotVerdict): verdict is { bot: true; reason: BotBlockReason } {
  if (!verdict.bot) return false;
  console.info(`Blocked bot submission (${form}): ${verdict.reason}`);
  return true;
}

/**
 * Conservative junk-email screen. Only all-letter local parts with a 7-consonant
 * run are blocked (the launch-list mash `eghtrhrt`). `y` counts as a vowel.
 * Keyboard-row usernames (`qwerty`, `asdfghjkl`) and ordinary words
 * (`strengths`, `knightsbridge`) pass. Digits, symbols, and short locals pass.
 */
export function isObviouslyJunkEmail(email: string): boolean {
  const at = email.trim().toLowerCase().lastIndexOf("@");
  if (at <= 0) return false;
  let local = email.trim().toLowerCase().slice(0, at);
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  local = local.replace(/\./g, "");
  if (!/^[a-z]{8,}$/.test(local)) return false;
  if (KEYBOARD_ROWS.some((row) => row.includes(local))) return false;

  let run = 0;
  let longest = 0;
  for (const char of local) {
    if ("aeiouy".includes(char)) {
      longest = Math.max(longest, run);
      run = 0;
    } else {
      run += 1;
    }
  }
  longest = Math.max(longest, run);
  return longest >= 7;
}

function asRecord(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

function honeypotTripped(record: Record<string, unknown> | null): boolean {
  if (!record || !(HONEYPOT_FIELD in record)) return false;
  const value = record[HONEYPOT_FIELD];
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

function readStartedAt(record: Record<string, unknown> | null): number | null {
  if (!record) return null;
  const value = record[FORM_STARTED_FIELD];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
