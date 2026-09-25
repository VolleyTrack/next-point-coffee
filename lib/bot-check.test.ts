import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  FORM_STARTED_FIELD,
  HONEYPOT_FIELD,
  MIN_SUBMIT_MS,
  assessPublicFormSubmission,
  isObviouslyJunkEmail,
  rejectBotSubmission,
} from "./bot-check.ts";

const NOW = 1_700_000_000_000;

function humanBody(overrides: Record<string, unknown> = {}) {
  return {
    [HONEYPOT_FIELD]: "",
    [FORM_STARTED_FIELD]: NOW - 10_000,
    email: "ryan@gmail.com",
    ...overrides,
  };
}

function assess(body: unknown, emails?: readonly unknown[], now = NOW) {
  return assessPublicFormSubmission(body, { now, emails });
}

test("accepts an empty honeypot after the minimum wait", () => {
  assert.deepEqual(assess(humanBody(), ["ryan@gmail.com"]), { bot: false });
  assert.deepEqual(
    assess(humanBody({ [FORM_STARTED_FIELD]: NOW - MIN_SUBMIT_MS }), ["ryan@gmail.com"]),
    { bot: false }
  );
});

test("accepts a form left open for days", () => {
  const twoDays = 2 * 24 * 60 * 60 * 1000;
  assert.deepEqual(
    assess(humanBody({ [FORM_STARTED_FIELD]: NOW - twoDays }), ["ryan@gmail.com"]),
    { bot: false }
  );
});

test("blocks a filled honeypot even when timing and email look human", () => {
  const verdict = assess(
    humanBody({ [HONEYPOT_FIELD]: "https://spam.example" }),
    ["ryan@gmail.com"]
  );
  assert.deepEqual(verdict, { bot: true, reason: "honeypot" });
});

test("treats whitespace-only honeypot as empty and non-strings as tripped", () => {
  assert.deepEqual(assess(humanBody({ [HONEYPOT_FIELD]: "   " }), ["ryan@gmail.com"]), { bot: false });
  assert.deepEqual(assess(humanBody({ [HONEYPOT_FIELD]: ["https://spam.example"] })), {
    bot: true,
    reason: "honeypot",
  });
});

test("blocks submits under the minimum wait, including a timestamp from the future", () => {
  assert.deepEqual(
    assess(humanBody({ [FORM_STARTED_FIELD]: NOW - (MIN_SUBMIT_MS - 1) }), ["ryan@gmail.com"]),
    { bot: true, reason: "too_fast" }
  );
  assert.deepEqual(assess(humanBody({ [FORM_STARTED_FIELD]: NOW + 5_000 }), ["ryan@gmail.com"]), {
    bot: true,
    reason: "too_fast",
  });
});

test("blocks a missing, zero, seconds-based, or garbage timestamp", () => {
  const { [FORM_STARTED_FIELD]: _omit, ...withoutTiming } = humanBody();
  assert.deepEqual(assess(withoutTiming, ["ryan@gmail.com"]), { bot: true, reason: "missing_timing" });
  assert.deepEqual(assess(humanBody({ [FORM_STARTED_FIELD]: 0 })), { bot: true, reason: "missing_timing" });
  assert.deepEqual(assess(humanBody({ [FORM_STARTED_FIELD]: 1_700_000_000 })), {
    bot: true,
    reason: "missing_timing",
  });
  assert.deepEqual(assess(humanBody({ [FORM_STARTED_FIELD]: "not-a-time" })), {
    bot: true,
    reason: "missing_timing",
  });
  assert.deepEqual(assess(null), { bot: true, reason: "missing_timing" });
});

test("accepts a numeric-string timestamp that is old enough", () => {
  assert.deepEqual(
    assess(humanBody({ [FORM_STARTED_FIELD]: String(NOW - 10_000) }), ["ryan@gmail.com"]),
    { bot: false }
  );
});

test("honeypot wins over a fast submit and a junk email", () => {
  assert.deepEqual(
    assess(
      humanBody({
        [HONEYPOT_FIELD]: "http://bot.example",
        [FORM_STARTED_FIELD]: NOW,
        email: "eghtrhrt@gmail.com",
      }),
      ["eghtrhrt@gmail.com"]
    ),
    { bot: true, reason: "honeypot" }
  );
});

test("flags the reported keyboard-mash address and obvious consonant runs", () => {
  for (const email of [
    "eghtrhrt@gmail.com",
    "EGHTRhRT@Gmail.com",
    "eghtrhrt+spam@gmail.com",
    "e.g.h.t.r.h.r.t@gmail.com",
    "bcdfghjklmnp@gmail.com",
  ]) {
    assert.equal(isObviouslyJunkEmail(email), true, email);
    assert.deepEqual(assess(humanBody({ email }), [email]), { bot: true, reason: "junk_email" });
  }
});

test("does not flag real gmail users, keyboard-row names, or ordinary words", () => {
  for (const email of [
    "ryan@gmail.com",
    "ryan.mullen@gmail.com",
    "first.last+launch@gmail.com",
    "momof3@gmail.com",
    "qwerty@gmail.com",
    "asdfghjkl@gmail.com",
    "qwertyuiop@gmail.com",
    "info@nextpointcoffee.com",
    "coach@riversidevc.example",
    "jessica.nguyen@gmail.com",
    "strengths@gmail.com",
    "knightsbridge@gmail.com",
    "rhythm@gmail.com",
    "a@gmail.com",
    "johnsmith2024@gmail.com",
    "user_name@gmail.com",
    "j.k.rowling@gmail.com",
  ]) {
    assert.equal(isObviouslyJunkEmail(email), false, email);
    assert.deepEqual(assess(humanBody({ email }), [email]), { bot: false });
  }
});

test("logs one short line and only rejects bot verdicts", () => {
  const lines: string[] = [];
  const original = console.info;
  console.info = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    assert.equal(rejectBotSubmission("waitlist", { bot: false }), false);
    assert.equal(
      rejectBotSubmission("waitlist", { bot: true, reason: "honeypot" }),
      true
    );
    assert.deepEqual(lines, ["Blocked bot submission (waitlist): honeypot"]);
  } finally {
    console.info = original;
  }
});

test("public lead routes enforce the check before storage or alert mail", async () => {
  const waitlist = await readFile(new URL("../app/api/waitlist/route.ts", import.meta.url), "utf8");
  const contact = await readFile(new URL("../app/api/contact/route.ts", import.meta.url), "utf8");
  const request = await readFile(new URL("../app/api/campaigns/request/route.ts", import.meta.url), "utf8");

  assert.ok(waitlist.indexOf("rejectBotSubmission") < waitlist.indexOf("addSignup"));
  assert.ok(waitlist.indexOf("rejectBotSubmission") < waitlist.indexOf("notifyNewSignup"));
  assert.match(waitlist, /success: true, alreadySubscribed: false/);

  assert.ok(contact.indexOf("rejectBotSubmission") < contact.indexOf("notifyContactForm"));
  assert.match(contact, /return NextResponse\.json\(\{ success: true \}\)/);

  assert.ok(request.indexOf("rejectBotSubmission") < request.indexOf("createCampaignRequest"));
  assert.ok(request.indexOf("rejectBotSubmission") < request.indexOf("notifyCampaignRequest"));
  assert.match(request, /unsavedCampaignRequest/);
});

test("public forms render the honeypot off-screen and send the trap fields", async () => {
  const trap = await readFile(new URL("../components/bot-trap.tsx", import.meta.url), "utf8");
  const waitlist = await readFile(new URL("../components/waitlist-form.tsx", import.meta.url), "utf8");
  const contact = await readFile(new URL("../app/contact/page.tsx", import.meta.url), "utf8");
  const request = await readFile(new URL("../components/campaigns/request-form.tsx", import.meta.url), "utf8");

  assert.match(trap, /aria-hidden="true"/);
  assert.match(trap, /tabIndex=\{-1\}/);
  assert.match(trap, /autoComplete="off"/);
  assert.match(trap, /left: "-10000px"/);
  assert.match(trap, /name=\{HONEYPOT_FIELD\}/);
  assert.match(trap, /Company website/);

  for (const source of [waitlist, contact, request]) {
    assert.match(source, /useBotTrap/);
    assert.match(source, /trap\.field/);
    assert.match(source, /trap\.payload\(\)/);
  }
});
