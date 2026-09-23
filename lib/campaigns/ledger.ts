import type {
  Athlete,
  BooksEvent,
  Campaign,
  CampaignRequest,
  CampaignStoreState,
  Organization,
  PayoutPeriod,
  PortalUser,
  Sale,
} from "./types.ts";

/** Single row in public.campaign_store. One document so a create commits users and campaigns together. */
export const CAMPAIGN_STORE_ROW_ID = "ledger";

export interface SupabaseLedgerConfig {
  url: string;
  serviceKey: string;
}

export interface CampaignSnapshot {
  state: CampaignStoreState | null;
  version: number;
}

type FetchLike = typeof fetch;

export function supabaseLedgerConfig(env: NodeJS.ProcessEnv = process.env): SupabaseLedgerConfig | null {
  const url = env.SUPABASE_URL?.trim();
  const serviceKey = env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
}

export function campaignsUseSupabase(env: NodeJS.ProcessEnv = process.env): boolean {
  return supabaseLedgerConfig(env) !== null;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function mergeById<T extends { id: string }>(
  current: T[],
  seed: T[],
  accept: (row: T) => boolean = () => true
): void {
  const ids = new Set(current.map((row) => row.id));
  for (const row of seed) {
    if (ids.has(row.id) || !accept(row)) continue;
    current.push(clone(row));
    ids.add(row.id);
  }
}

/** Fill arrays the JSON file sometimes omitted, without dropping saved rows. */
export function normalizeCampaignState(input: CampaignStoreState): CampaignStoreState {
  const state = clone(input);
  state.organizations ??= [];
  state.athletes ??= [];
  state.campaigns ??= [];
  state.sales ??= [];
  state.payouts ??= [];
  state.users ??= [];
  state.booksEvents ??= [];
  state.campaignRequests ??= [];
  for (const org of state.organizations) {
    if (typeof org.bagShareCents !== "number") org.bagShareCents = 0;
  }
  for (const user of state.users) {
    if (typeof user.mustChangePassword !== "boolean") user.mustChangePassword = false;
  }
  return state;
}

/**
 * Keep saved orgs, campaigns, and partner users, and add seed rows that are
 * not already stored. Seed logins stay available while the launch flag is off.
 * A saved row with the same id wins, so a changed password is not reset.
 */
export function mergeSeedState(
  durable: CampaignStoreState | null,
  seed: CampaignStoreState
): CampaignStoreState {
  if (!durable) return normalizeCampaignState(seed);
  const state = normalizeCampaignState(durable);
  const seedNorm = normalizeCampaignState(seed);

  const orgSlugs = new Set(state.organizations.map((org) => org.slug));
  mergeById<Organization>(state.organizations, seedNorm.organizations, (org) => {
    if (orgSlugs.has(org.slug)) return false;
    orgSlugs.add(org.slug);
    return true;
  });
  const orgIds = new Set(state.organizations.map((org) => org.id));

  mergeById<Athlete>(state.athletes, seedNorm.athletes, (athlete) => orgIds.has(athlete.organizationId));
  const athleteIds = new Set(state.athletes.map((athlete) => athlete.id));

  const campaignSlugs = new Set(state.campaigns.map((campaign) => campaign.slug));
  mergeById<Campaign>(state.campaigns, seedNorm.campaigns, (campaign) => {
    if (campaignSlugs.has(campaign.slug)) return false;
    if (!orgIds.has(campaign.organizationId) || !athleteIds.has(campaign.athleteId)) return false;
    campaignSlugs.add(campaign.slug);
    return true;
  });
  const campaignIds = new Set(state.campaigns.map((campaign) => campaign.id));

  mergeById<Sale>(state.sales, seedNorm.sales, (sale) => campaignIds.has(sale.campaignId));
  mergeById<PayoutPeriod>(state.payouts, seedNorm.payouts, (payout) => orgIds.has(payout.organizationId));

  const emails = new Set(state.users.map((user) => user.email));
  mergeById<PortalUser>(state.users, seedNorm.users, (user) => {
    if (emails.has(user.email)) return false;
    emails.add(user.email);
    return true;
  });

  mergeById<CampaignRequest>(state.campaignRequests, seedNorm.campaignRequests);
  mergeById<BooksEvent>(state.booksEvents, seedNorm.booksEvents);
  return state;
}

function collectionUrl(config: SupabaseLedgerConfig): string {
  return `${config.url.replace(/\/$/, "")}/rest/v1/campaign_store`;
}

function ledgerHeaders(config: SupabaseLedgerConfig, prefer?: string): HeadersInit {
  const headers: Record<string, string> = {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  return headers;
}

async function errorDetail(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (res.status === 404 || /schema cache/i.test(text)) {
    return "Apply supabase/campaigns.sql on the Supabase project.";
  }
  if (res.status === 401 || res.status === 403) {
    return "The Supabase service key was rejected.";
  }
  if (/passwordHash|mustChangePassword/i.test(text)) {
    return "The database rejected the campaign ledger.";
  }
  const trimmed = text.replace(/\s+/g, " ").slice(0, 180);
  return trimmed || "No response body.";
}

function isState(value: unknown): value is CampaignStoreState {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<CampaignStoreState>;
  return Array.isArray(row.organizations) && Array.isArray(row.campaigns);
}

export async function readCampaignSnapshot(
  config: SupabaseLedgerConfig,
  fetchImpl: FetchLike = fetch
): Promise<CampaignSnapshot> {
  const url = `${collectionUrl(config)}?id=eq.${encodeURIComponent(CAMPAIGN_STORE_ROW_ID)}&select=version,state`;
  const res = await fetchImpl(url, {
    headers: ledgerHeaders(config),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Campaign store read failed (${res.status}). ${await errorDetail(res)}`);
  }
  const rows = (await res.json()) as unknown;
  if (!Array.isArray(rows) || rows.length === 0) return { state: null, version: 0 };
  const row = rows[0] as { version?: unknown; state?: unknown };
  if (typeof row.version !== "number" || !isState(row.state)) {
    throw new Error("Campaign store row is invalid.");
  }
  return { state: row.state, version: row.version };
}

/**
 * Insert when expectedVersion is 0. Otherwise patch only the row still at that
 * version. A conflict means another instance saved first; the caller retries.
 */
export async function writeCampaignSnapshot(
  config: SupabaseLedgerConfig,
  state: CampaignStoreState,
  expectedVersion: number,
  fetchImpl: FetchLike = fetch
): Promise<"ok" | "conflict"> {
  const updatedAt = new Date().toISOString();
  if (expectedVersion <= 0) {
    const res = await fetchImpl(collectionUrl(config), {
      method: "POST",
      headers: ledgerHeaders(config, "return=representation"),
      body: JSON.stringify({
        id: CAMPAIGN_STORE_ROW_ID,
        version: 1,
        state,
        updated_at: updatedAt,
      }),
      cache: "no-store",
    });
    if (res.status === 409) return "conflict";
    if (!res.ok) {
      throw new Error(`Campaign store save failed (${res.status}). ${await errorDetail(res)}`);
    }
    return "ok";
  }

  const url = `${collectionUrl(config)}?id=eq.${encodeURIComponent(CAMPAIGN_STORE_ROW_ID)}&version=eq.${expectedVersion}`;
  const res = await fetchImpl(url, {
    method: "PATCH",
    headers: ledgerHeaders(config, "return=representation"),
    body: JSON.stringify({
      version: expectedVersion + 1,
      state,
      updated_at: updatedAt,
    }),
    cache: "no-store",
  });
  if (res.status === 409) return "conflict";
  if (!res.ok) {
    throw new Error(`Campaign store save failed (${res.status}). ${await errorDetail(res)}`);
  }
  const rows = (await res.json()) as unknown;
  if (!Array.isArray(rows) || rows.length === 0) return "conflict";
  return "ok";
}

/**
 * Re-read and re-apply the change when another instance wins the version check.
 * The change function runs on a fresh copy each attempt, so a retry cannot
 * duplicate the previous attempt's rows.
 */
export async function commitCampaignWrite<T>(args: {
  read: () => Promise<{ state: CampaignStoreState; version: number }>;
  write: (state: CampaignStoreState, expectedVersion: number) => Promise<"ok" | "conflict">;
  change: (state: CampaignStoreState) => T | Promise<T>;
  maxAttempts?: number;
}): Promise<T> {
  const maxAttempts = args.maxAttempts ?? 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const loaded = await args.read();
    const state = clone(loaded.state);
    const result = await args.change(state);
    const outcome = await args.write(state, loaded.version);
    if (outcome === "ok") return result;
  }
  throw new Error("Campaign data changed while saving. Try again.");
}
