const MS_DAY = 24 * 60 * 60 * 1000;
const PERIOD_DAYS = 14;
// Monday 2026-01-05 — biweekly windows stay aligned from this epoch.
const EPOCH = Date.parse("2026-01-05T00:00:00.000Z");

export function biweeklyWindow(at = new Date()): { start: Date; end: Date; key: string } {
  const index = Math.floor((at.getTime() - EPOCH) / (PERIOD_DAYS * MS_DAY));
  const start = new Date(EPOCH + index * PERIOD_DAYS * MS_DAY);
  const end = new Date(start.getTime() + PERIOD_DAYS * MS_DAY - 1);
  return { start, end, key: start.toISOString().slice(0, 10) };
}

export function periodKey(startIso: string): string {
  return startIso.slice(0, 10);
}

export function formatPeriodLabel(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" };
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}`;
}
