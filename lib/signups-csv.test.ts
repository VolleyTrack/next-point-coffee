import assert from "node:assert/strict";
import test from "node:test";
import {
  SIGNUP_CSV_FILENAME,
  csvCell,
  signupListAttachment,
  signupsToCsv,
  type SignupCsvRow,
} from "./signups-csv.ts";

const rows: SignupCsvRow[] = [
  {
    email: "new@example.com",
    context: "homepage",
    created_at: "2026-09-22T00:00:00.000Z",
  },
  {
    email: "older@example.com",
    context: "footer",
    created_at: "2026-09-01T12:00:00.000Z",
  },
];

function csvBody(csv: string): string {
  return csv.replace(/^\uFEFF/, "");
}

test("writes a UTF-8 CSV with stable columns, newest-first order preserved", () => {
  const csv = signupsToCsv(rows);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.equal(
    csvBody(csv),
    [
      "email,source,signed_up_at",
      "new@example.com,homepage,2026-09-22T00:00:00.000Z",
      "older@example.com,footer,2026-09-01T12:00:00.000Z",
      "",
    ].join("\r\n")
  );
});

test("escapes quotes, commas, and newlines", () => {
  const csv = csvBody(
    signupsToCsv([
      {
        email: 'ada,"lovelace"@example.com',
        context: "home, page",
        created_at: "2026-09-22T00:00:00.000Z\nnote",
      },
    ])
  );
  assert.equal(
    csv,
    [
      "email,source,signed_up_at",
      '"ada,""lovelace""@example.com","home, page","2026-09-22T00:00:00.000Z\nnote"',
      "",
    ].join("\r\n")
  );
});

test("neutralizes spreadsheet formula injection", () => {
  assert.equal(csvCell("=1+1"), "'=1+1");
  assert.equal(csvCell("+1"), "'+1");
  assert.equal(csvCell("-1"), "'-1");
  assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(csvCell("\t=cmd"), "'\t=cmd");
  assert.equal(csvCell("\r=cmd"), `"'\r=cmd"`);
  assert.equal(csvCell(" =1+1"), "' =1+1");
  assert.equal(csvCell("safe@example.com"), "safe@example.com");

  const csv = csvBody(
    signupsToCsv([
      {
        email: '=HYPERLINK("http://evil.test")',
        context: "+club",
        created_at: "2026-09-22T00:00:00.000Z",
      },
    ])
  );
  assert.match(csv, /"'=HYPERLINK\(""http:\/\/evil\.test""\)",'\+club,/);
});

test("keeps unicode email and source text", () => {
  const csv = csvBody(
    signupsToCsv([
      {
        email: "café@example.com",
        context: "店舗",
        created_at: "2026-09-22T00:00:00.000Z",
      },
    ])
  );
  assert.match(csv, /café@example.com,店舗,2026-09-22T00:00:00.000Z/);
});

test("attaches the master list only for a new signup", () => {
  const csv = signupsToCsv(rows);
  const attached = signupListAttachment(false, csv);
  assert.deepEqual(attached, {
    filename: SIGNUP_CSV_FILENAME,
    content: csv,
    contentType: "text/csv; charset=utf-8",
  });
  assert.equal(SIGNUP_CSV_FILENAME, "next-point-coffee-signups.csv");
  assert.equal(signupListAttachment(true, csv), undefined);
  assert.equal(signupListAttachment(false, undefined), undefined);
  assert.equal(signupListAttachment(false, ""), undefined);
});
