/** Stable attachment name so each new-signup alert replaces the same file in the inbox. */
export const SIGNUP_CSV_FILENAME = "next-point-coffee-signups.csv";

export interface SignupCsvRow {
  email: string;
  context: string;
  created_at: string;
}

export interface SignupCsvAttachment {
  filename: typeof SIGNUP_CSV_FILENAME;
  content: string;
  contentType: "text/csv; charset=utf-8";
}

/**
 * Spreadsheet apps execute a cell that starts with one of these (after leading
 * whitespace) as a formula. Prefix a quote so the value stays text.
 */
const FORMULA_RISK = /^[\t\r\n ]*[=+\-@]|^[\t\r]/;

function neutralizeFormula(value: string): string {
  return FORMULA_RISK.test(value) ? `'${value}` : value;
}

/** RFC 4180 field encoding, after formula neutralization. */
export function csvCell(value: string): string {
  const safe = neutralizeFormula(value);
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * Full master list as UTF-8 CSV. Row order is preserved (newest first when
 * rows come from `listSignups`). A leading BOM helps Excel read UTF-8.
 */
export function signupsToCsv(rows: readonly SignupCsvRow[]): string {
  const lines = [
    "email,source,signed_up_at",
    ...rows.map((row) =>
      [csvCell(row.email), csvCell(row.context ?? ""), csvCell(row.created_at ?? "")].join(",")
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/**
 * Attachment for a genuinely new subscriber only. Duplicate alerts must not
 * include a master list, even if a CSV string was passed in by mistake.
 */
export function signupListAttachment(
  alreadySubscribed: boolean,
  signupCsv: string | undefined
): SignupCsvAttachment | undefined {
  if (alreadySubscribed || !signupCsv) return undefined;
  return {
    filename: SIGNUP_CSV_FILENAME,
    content: signupCsv,
    contentType: "text/csv; charset=utf-8",
  };
}
