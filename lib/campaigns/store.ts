import { promises as fs } from "fs";
import path from "path";
import { products } from "@/lib/site";
import { SEED_STATE } from "./seed";
import { earningsPerBagCents, slugify } from "./money";
import {
  DUMMY_PASSWORD_HASH,
  applyPortalPasswordChange,
  generateTemporaryPassword,
  hashPassword,
  verifyPassword,
} from "./passwords";
import { biweeklyWindow } from "./payouts";
import { buildPayoutBooksEvent, buildSaleBooksEvent, pushBooksEvent, syncBooksEvents } from "./books";
import type {
  Athlete,
  BooksEvent,
  Campaign,
  CampaignStoreState,
  CampaignWithRelations,
  IssuedPortalCredential,
  Organization,
  CampaignRequest,
  OrganizationType,
  OrgSummary,
  PayoutPeriod,
  PortalRole,
  PortalUser,
  PublicPortalUser,
  Sale,
  SaleSource,
} from "./types";

const globalForStore = globalThis as unknown as {
  __npcCampaignStore?: CampaignStoreState;
  __npcCampaignStoreQueue?: Promise<unknown>;
};

function dataFilePath(): string {
  if (process.env.CAMPAIGNS_DATA_PATH) return process.env.CAMPAIGNS_DATA_PATH;
  if (process.env.VERCEL) return path.join("/tmp", "npc-campaigns-store.json");
  return path.join(process.cwd(), "data", "campaigns-store.json");
}

function cloneState(state: CampaignStoreState): CampaignStoreState {
  return structuredClone(state);
}

/** True while the public launch flag is off, unless explicitly disabled. */
export function committedDemoPasswordsActive(): boolean {
  if (process.env.PORTAL_ALLOW_DEMO_PASSWORDS === "true") return true;
  if (process.env.PORTAL_ALLOW_DEMO_PASSWORDS === "false") return false;
  return process.env.NEXT_PUBLIC_CAMPAIGNS_LIVE !== "true";
}

function migrateUserFacingCopy(state: CampaignStoreState): void {
  for (const user of state.users) {
    if (user.name === "NPC Admin" || user.id === "user-admin") {
      user.name = "Next Point Coffee Admin";
    }
  }
  const rewrite = (value: string) =>
    value
      .replaceAll("NPC Admin", "Next Point Coffee Admin")
      .replaceAll("NPC admin", "Next Point Coffee admin")
      .replace(/\bNPC\b/g, "Next Point Coffee");
  for (const campaign of state.campaigns) {
    campaign.story = rewrite(campaign.story);
  }
  for (const request of state.campaignRequests ?? []) {
    request.notes = rewrite(request.notes);
  }
}

function migratePasswordHashes(state: CampaignStoreState): void {
  const seedById = new Map(SEED_STATE.users.map((user) => [user.id, user.passwordHash]));
  for (const user of state.users) {
    if (!user.passwordHash) {
      const seeded = seedById.get(user.id);
      if (seeded) user.passwordHash = seeded;
    }
  }
}

/**
 * While campaigns are public, drop password hashes that still match the
 * committed seed so README demo passwords cannot sign in. Accounts created
 * later, and an admin hash set from PORTAL_ADMIN_PASSWORD, are left alone.
 */
function lockCommittedDemoPasswords(state: CampaignStoreState): void {
  if (committedDemoPasswordsActive()) return;
  const seedHashById = new Map(SEED_STATE.users.map((user) => [user.id, user.passwordHash]));
  for (const user of state.users) {
    const seedHash = seedHashById.get(user.id);
    if (seedHash && user.passwordHash === seedHash) {
      user.passwordHash = undefined;
    }
  }
}

async function applyEnvAdminPassword(state: CampaignStoreState): Promise<boolean> {
  const password = process.env.PORTAL_ADMIN_PASSWORD?.trim();
  if (!password) return false;
  const admin = state.users.find((user) => user.role === "admin");
  if (!admin) return false;
  if (admin.passwordHash && (await verifyPassword(password, admin.passwordHash))) return false;
  admin.passwordHash = await hashPassword(password);
  return true;
}

async function readFileState(): Promise<CampaignStoreState | null> {
  try {
    const raw = await fs.readFile(dataFilePath(), "utf8");
    const parsed = JSON.parse(raw) as CampaignStoreState;
    if (!parsed?.organizations || !parsed?.campaigns) return null;
    parsed.athletes ??= [];
    parsed.sales ??= [];
    parsed.payouts ??= [];
    parsed.users ??= [];
    parsed.booksEvents ??= [];
    parsed.campaignRequests ??= [];
    for (const org of parsed.organizations) {
      if (typeof org.bagShareCents !== "number") {
        org.bagShareCents = 0;
      }
    }
    migrateUserFacingCopy(parsed);
    return parsed;
  } catch {
    return null;
  }
}

async function writeFileState(state: CampaignStoreState): Promise<void> {
  const file = dataFilePath();
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    console.warn("Campaign store could not persist to disk:", err);
  }
}

async function loadState(): Promise<CampaignStoreState> {
  if (globalForStore.__npcCampaignStore) {
    const state = globalForStore.__npcCampaignStore;
    migrateUserFacingCopy(state);
    migratePasswordHashes(state);
    lockCommittedDemoPasswords(state);
    return state;
  }
  const fromDisk = await readFileState();
  const state = cloneState(fromDisk ?? SEED_STATE);
  migrateUserFacingCopy(state);
  migratePasswordHashes(state);
  const adminChanged = await applyEnvAdminPassword(state);
  lockCommittedDemoPasswords(state);
  globalForStore.__npcCampaignStore = state;
  if (!fromDisk || adminChanged) await writeFileState(state);
  return state;
}

async function mutate<T>(fn: (state: CampaignStoreState) => T | Promise<T>): Promise<T> {
  const run = async () => {
    const state = await loadState();
    const result = await fn(state);
    globalForStore.__npcCampaignStore = state;
    await writeFileState(state);
    return result;
  };
  const queued = (globalForStore.__npcCampaignStoreQueue ?? Promise.resolve()).then(run, run);
  globalForStore.__npcCampaignStoreQueue = queued.then(
    () => undefined,
    () => undefined
  );
  return queued;
}

export async function getStore(): Promise<CampaignStoreState> {
  return cloneState(await loadState());
}

export async function resetStore(): Promise<CampaignStoreState> {
  return mutate((state) => {
    const next = cloneState(SEED_STATE);
    state.organizations = next.organizations;
    state.athletes = next.athletes;
    state.campaigns = next.campaigns;
    state.sales = next.sales;
    state.payouts = next.payouts;
    state.users = next.users;
    state.booksEvents = next.booksEvents;
    state.campaignRequests = next.campaignRequests;
    return cloneState(state);
  });
}

function uniqueSlug(existing: string[], base: string): string {
  const root = slugify(base);
  if (!existing.includes(root)) return root;
  let i = 2;
  while (existing.includes(`${root}-${i}`)) i += 1;
  return `${root}-${i}`;
}

function hydrateCampaign(state: CampaignStoreState, campaign: Campaign): CampaignWithRelations | null {
  const organization = state.organizations.find((o) => o.id === campaign.organizationId);
  const athlete = state.athletes.find((a) => a.id === campaign.athleteId);
  if (!organization || !athlete) return null;
  const sales = state.sales.filter((s) => s.campaignId === campaign.id);
  return {
    ...campaign,
    organization,
    athlete,
    bagsSold: sales.reduce((sum, s) => sum + s.quantity, 0),
    amountOwedCents: sales.reduce((sum, s) => sum + s.amountOwedCents, 0),
  };
}

export async function listLiveCampaigns(): Promise<CampaignWithRelations[]> {
  const state = await loadState();
  return state.campaigns
    .filter((c) => c.status === "live")
    .map((c) => hydrateCampaign(state, c))
    .filter((c): c is CampaignWithRelations => Boolean(c))
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

export async function getCampaignBySlug(slug: string): Promise<CampaignWithRelations | null> {
  const state = await loadState();
  const campaign = state.campaigns.find((c) => c.slug === slug);
  return campaign ? hydrateCampaign(state, campaign) : null;
}

export async function getCampaignById(id: string): Promise<CampaignWithRelations | null> {
  const state = await loadState();
  const campaign = state.campaigns.find((c) => c.id === id);
  return campaign ? hydrateCampaign(state, campaign) : null;
}

export async function listAllCampaigns(): Promise<CampaignWithRelations[]> {
  const state = await loadState();
  return state.campaigns
    .map((c) => hydrateCampaign(state, c))
    .filter((c): c is CampaignWithRelations => Boolean(c))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Club: every campaign under that org. */
export async function listCampaignsForOrganization(organizationId: string): Promise<CampaignWithRelations[]> {
  return (await listAllCampaigns()).filter((c) => c.organizationId === organizationId);
}

/**
 * Athlete privacy: only campaigns assigned to this athlete.
 * Never return another athlete's campaign, even on the same club.
 */
export async function listCampaignsForAthlete(athleteId: string): Promise<CampaignWithRelations[]> {
  if (!athleteId) return [];
  return (await listAllCampaigns()).filter((c) => c.athleteId === athleteId);
}

export function toPublicPortalUser(user: PortalUser): PublicPortalUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

export async function listUsers(): Promise<PublicPortalUser[]> {
  const state = await loadState();
  return state.users.map((user) => toPublicPortalUser(user));
}

export async function getUserById(id: string): Promise<PublicPortalUser | null> {
  const state = await loadState();
  const user = state.users.find((u) => u.id === id);
  return user ? toPublicPortalUser(user) : null;
}

export async function verifyPortalCredentials(
  email: string,
  password: string
): Promise<PublicPortalUser | null> {
  const normalized = email.trim().toLowerCase();
  const state = await loadState();
  const user = state.users.find((row) => row.email === normalized);
  const ok = await verifyPassword(password, user?.passwordHash || DUMMY_PASSWORD_HASH);
  if (!user?.passwordHash || !ok) return null;
  return toPublicPortalUser(user);
}

export async function changePortalPassword(
  userId: string,
  password: string,
  confirm: string
): Promise<PublicPortalUser> {
  return mutate(async (state) => {
    const user = state.users.find((row) => row.id === userId);
    if (!user) throw new Error("Account not found.");
    await applyPortalPasswordChange(user, password, confirm);
    return toPublicPortalUser(user);
  });
}

async function preparePortalUser(
  state: CampaignStoreState,
  input: {
    role: PortalRole;
    name: string;
    email: string;
    organizationId?: string;
    athleteId?: string;
  },
  reservedEmails: string[] = []
): Promise<{ user: PortalUser; credential: IssuedPortalCredential }> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (
    state.users.some((user) => user.email === email) ||
    reservedEmails.some((reserved) => reserved === email)
  ) {
    throw new Error("That email already has a partner login.");
  }
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const user: PortalUser = {
    id: crypto.randomUUID(),
    role: input.role,
    name,
    email,
    organizationId: input.organizationId,
    athleteId: input.athleteId,
    passwordHash,
    mustChangePassword: true,
  };
  return {
    user,
    credential: {
      role: input.role,
      name,
      email,
      temporaryPassword,
    },
  };
}

export async function listOrganizations(): Promise<Organization[]> {
  return (await loadState()).organizations.map((o) => ({ ...o }));
}

export async function listAthletes(organizationId?: string): Promise<Athlete[]> {
  const state = await loadState();
  return state.athletes
    .filter((a) => !organizationId || a.organizationId === organizationId)
    .map((a) => ({ ...a }));
}

export async function listSales(filter?: {
  organizationId?: string;
  athleteId?: string;
  campaignId?: string;
}): Promise<Sale[]> {
  const state = await loadState();
  return state.sales
    .filter((s) => {
      if (filter?.organizationId && s.organizationId !== filter.organizationId) return false;
      if (filter?.athleteId && s.athleteId !== filter.athleteId) return false;
      if (filter?.campaignId && s.campaignId !== filter.campaignId) return false;
      return true;
    })
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getSaleById(id: string): Promise<Sale | null> {
  if (!id) return null;
  const state = await loadState();
  return state.sales.find((s) => s.id === id) ?? null;
}

/** Gross (`amountCents`) is admin-only. Partner/public receipts omit it. */
export type SaleWithoutGross = Omit<Sale, "amountCents">;

export function omitSaleGross(sale: Sale): SaleWithoutGross {
  const { amountCents: _gross, ...rest } = sale;
  void _gross;
  return rest;
}

export async function listPartnerSales(filter?: {
  organizationId?: string;
  athleteId?: string;
  campaignId?: string;
}): Promise<SaleWithoutGross[]> {
  return (await listSales(filter)).map(omitSaleGross);
}

export async function getBuyerSaleReceipt(id: string): Promise<{
  quantity: number;
  productName: string;
  amountOwedCents: number;
} | null> {
  const sale = await getSaleById(id);
  if (!sale) return null;
  return {
    quantity: sale.quantity,
    productName: sale.productName,
    amountOwedCents: sale.amountOwedCents,
  };
}

/**
 * Athlete privacy: a sale is visible only when
 * 1) it is attributed to this athlete, and
 * 2) it sits on a campaign assigned to this athlete.
 * Next Point Coffee admin / other athletes' rows are never included.
 */
export async function listSalesForAthlete(athleteId: string): Promise<SaleWithoutGross[]> {
  if (!athleteId) return [];
  const state = await loadState();
  const assigned = new Set(
    state.campaigns.filter((c) => c.athleteId === athleteId).map((c) => c.id)
  );
  return state.sales
    .filter((s) => s.athleteId === athleteId && assigned.has(s.campaignId))
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(omitSaleGross);
}

export async function listPayouts(organizationId?: string): Promise<PayoutPeriod[]> {
  const state = await loadState();
  return state.payouts
    .filter((p) => !organizationId || p.organizationId === organizationId)
    .slice()
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function listBooksEvents(): Promise<BooksEvent[]> {
  return (await loadState()).booksEvents.slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function summarizeOrg(state: CampaignStoreState, org: Organization): OrgSummary {
  const sales = state.sales.filter((s) => s.organizationId === org.id);
  const campaigns = state.campaigns.filter((c) => c.organizationId === org.id);
  const paid = state.payouts
    .filter((p) => p.organizationId === org.id && p.status === "paid")
    .reduce((sum, p) => sum + p.amountOwedCents, 0);
  const owed = sales.reduce((sum, s) => sum + s.amountOwedCents, 0);
  return {
    organization: org,
    bagsSold: sales.reduce((sum, s) => sum + s.quantity, 0),
    amountOwedCents: owed,
    amountPaidCents: paid,
    amountOpenCents: Math.max(0, owed - paid),
    campaignCount: campaigns.length,
    liveCampaignCount: campaigns.filter((c) => c.status === "live").length,
  };
}

export async function listOrgSummaries(): Promise<OrgSummary[]> {
  const state = await loadState();
  return state.organizations.map((org) => summarizeOrg(state, org));
}

export async function getOrgSummary(organizationId: string): Promise<OrgSummary | null> {
  const state = await loadState();
  const org = state.organizations.find((o) => o.id === organizationId);
  return org ? summarizeOrg(state, org) : null;
}

export async function createOrganization(input: {
  name: string;
  type: OrganizationType;
  contactEmail: string;
  bagShareCents: number;
}): Promise<{ organization: Organization; credential: IssuedPortalCredential }> {
  return mutate(async (state) => {
    const contactEmail = input.contactEmail.trim().toLowerCase();
    const org: Organization = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      type: input.type,
      slug: uniqueSlug(
        state.organizations.map((o) => o.slug),
        input.name
      ),
      contactEmail,
      bagShareCents: Math.max(0, Math.round(input.bagShareCents)),
      createdAt: new Date().toISOString(),
    };
    const prepared = await preparePortalUser(state, {
      role: "club",
      name: `${org.name} Manager`,
      email: contactEmail,
      organizationId: org.id,
    });
    state.users.push(prepared.user);
    state.organizations.push(org);
    return { organization: { ...org }, credential: prepared.credential };
  });
}

export async function updateOrganization(input: {
  organizationId: string;
  bagShareCents: number;
}): Promise<Organization> {
  return mutate((state) => {
    const org = state.organizations.find((o) => o.id === input.organizationId);
    if (!org) throw new Error("Organization not found.");
    org.bagShareCents = Math.max(0, Math.round(input.bagShareCents));
    return { ...org };
  });
}

export async function createAthlete(input: {
  organizationId: string;
  name: string;
  email: string;
}): Promise<{ athlete: Athlete; credential: IssuedPortalCredential }> {
  return mutate(async (state) => {
    const org = state.organizations.find((o) => o.id === input.organizationId);
    if (!org) throw new Error("Organization not found.");
    const athlete: Athlete = {
      id: crypto.randomUUID(),
      organizationId: org.id,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      createdAt: new Date().toISOString(),
    };
    const prepared = await preparePortalUser(state, {
      role: "athlete",
      name: athlete.name,
      email: athlete.email,
      organizationId: org.id,
      athleteId: athlete.id,
    });
    state.users.push(prepared.user);
    state.athletes.push(athlete);
    return { athlete: { ...athlete }, credential: prepared.credential };
  });
}

export async function listCampaignRequests(): Promise<CampaignRequest[]> {
  const state = await loadState();
  return (state.campaignRequests ?? [])
    .slice()
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "new" ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
}

export async function createCampaignRequest(input: {
  organizationName: string;
  organizationType: OrganizationType;
  contactName: string;
  contactEmail: string;
  phone?: string;
  city?: string;
  athleteName?: string;
  notes?: string;
}): Promise<CampaignRequest> {
  return mutate((state) => {
    state.campaignRequests ??= [];
    const request: CampaignRequest = {
      id: crypto.randomUUID(),
      organizationName: input.organizationName.trim(),
      organizationType: input.organizationType,
      contactName: input.contactName.trim(),
      contactEmail: input.contactEmail.trim().toLowerCase(),
      phone: (input.phone ?? "").trim(),
      city: (input.city ?? "").trim(),
      athleteName: (input.athleteName ?? "").trim(),
      notes: (input.notes ?? "").trim(),
      status: "new",
      createdAt: new Date().toISOString(),
      handledAt: null,
    };
    state.campaignRequests.push(request);
    return { ...request };
  });
}

export async function markCampaignRequestHandled(requestId: string): Promise<CampaignRequest> {
  return mutate((state) => {
    const request = (state.campaignRequests ?? []).find((r) => r.id === requestId);
    if (!request) throw new Error("Campaign request not found.");
    request.status = "handled";
    request.handledAt = new Date().toISOString();
    return { ...request };
  });
}

export async function createSetup(input: {
  organizationName: string;
  type: OrganizationType;
  contactEmail: string;
  bagShareCents: number;
  athleteName: string;
  athleteEmail: string;
  campaignName: string;
  story: string;
  goalBags: number;
  publish?: boolean;
}): Promise<{
  organization: Organization;
  athlete: Athlete;
  campaign: Campaign;
  credentials: IssuedPortalCredential[];
}> {
  return mutate(async (state) => {
    const now = new Date().toISOString();
    const contactEmail = input.contactEmail.trim().toLowerCase();
    const athleteEmail = input.athleteEmail.trim().toLowerCase();
    if (contactEmail === athleteEmail) {
      throw new Error("Club and athlete logins need different email addresses.");
    }
    const organization: Organization = {
      id: crypto.randomUUID(),
      name: input.organizationName.trim(),
      type: input.type,
      slug: uniqueSlug(
        state.organizations.map((o) => o.slug),
        input.organizationName
      ),
      contactEmail,
      bagShareCents: Math.max(0, Math.round(input.bagShareCents)),
      createdAt: now,
    };
    const athlete: Athlete = {
      id: crypto.randomUUID(),
      organizationId: organization.id,
      name: input.athleteName.trim(),
      email: athleteEmail,
      createdAt: now,
    };
    const campaign: Campaign = {
      id: crypto.randomUUID(),
      organizationId: organization.id,
      athleteId: athlete.id,
      name: input.campaignName.trim(),
      slug: uniqueSlug(
        state.campaigns.map((c) => c.slug),
        input.campaignName
      ),
      story: input.story.trim(),
      goalBags: Math.max(1, Math.floor(input.goalBags) || 20),
      status: input.publish ? "live" : "draft",
      createdAt: now,
      publishedAt: input.publish ? now : null,
    };
    const clubLogin = await preparePortalUser(state, {
      role: "club",
      name: `${organization.name} Manager`,
      email: contactEmail,
      organizationId: organization.id,
    });
    const athleteLogin = await preparePortalUser(
      state,
      {
        role: "athlete",
        name: athlete.name,
        email: athleteEmail,
        organizationId: organization.id,
        athleteId: athlete.id,
      },
      [clubLogin.user.email]
    );
    const credentials = [clubLogin.credential, athleteLogin.credential];
    state.users.push(clubLogin.user, athleteLogin.user);
    state.organizations.push(organization);
    state.athletes.push(athlete);
    state.campaigns.push(campaign);
    return {
      organization: { ...organization },
      athlete: { ...athlete },
      campaign: { ...campaign },
      credentials,
    };
  });
}

export async function createCampaign(input: {
  organizationId: string;
  athleteId: string;
  name: string;
  story: string;
  goalBags: number;
}): Promise<{ campaign: Campaign; credentials: IssuedPortalCredential[] }> {
  return mutate(async (state) => {
    const org = state.organizations.find((o) => o.id === input.organizationId);
    const athlete = state.athletes.find((a) => a.id === input.athleteId);
    if (!org) throw new Error("Organization not found.");
    if (!athlete || athlete.organizationId !== org.id) {
      throw new Error("Athlete does not belong to that organization.");
    }
    const prepared: { user: PortalUser; credential: IssuedPortalCredential }[] = [];
    const reserved: string[] = [];
    const clubUser = state.users.find((user) => user.role === "club" && user.organizationId === org.id);
    if (!clubUser) {
      const clubLogin = await preparePortalUser(
        state,
        {
          role: "club",
          name: `${org.name} Manager`,
          email: org.contactEmail,
          organizationId: org.id,
        },
        reserved
      );
      prepared.push(clubLogin);
      reserved.push(clubLogin.user.email);
    }
    const athleteUser = state.users.find((user) => user.role === "athlete" && user.athleteId === athlete.id);
    if (!athleteUser) {
      const athleteLogin = await preparePortalUser(
        state,
        {
          role: "athlete",
          name: athlete.name,
          email: athlete.email,
          organizationId: org.id,
          athleteId: athlete.id,
        },
        reserved
      );
      prepared.push(athleteLogin);
    }
    if (prepared.length > 0) state.users.push(...prepared.map((row) => row.user));
    const credentials = prepared.map((row) => row.credential);
    const campaign: Campaign = {
      id: crypto.randomUUID(),
      organizationId: org.id,
      athleteId: athlete.id,
      name: input.name.trim(),
      slug: uniqueSlug(
        state.campaigns.map((c) => c.slug),
        input.name
      ),
      story: input.story.trim(),
      goalBags: Math.max(1, Math.floor(input.goalBags) || 20),
      status: "draft",
      createdAt: new Date().toISOString(),
      publishedAt: null,
    };
    state.campaigns.push(campaign);
    return { campaign: { ...campaign }, credentials };
  });
}

export async function publishCampaign(campaignId: string): Promise<Campaign> {
  return mutate((state) => {
    const campaign = state.campaigns.find((c) => c.id === campaignId);
    if (!campaign) throw new Error("Campaign not found.");
    campaign.status = "live";
    campaign.publishedAt = new Date().toISOString();
    return { ...campaign };
  });
}

export async function closeCampaign(campaignId: string): Promise<Campaign> {
  return mutate((state) => {
    const campaign = state.campaigns.find((c) => c.id === campaignId);
    if (!campaign) throw new Error("Campaign not found.");
    campaign.status = "closed";
    return { ...campaign };
  });
}

interface RecordSaleInput {
  campaignId: string;
  productSlug: string;
  quantity: number;
  buyerName: string;
  buyerEmail: string;
  source?: SaleSource;
  stripeSessionId?: string | null;
  shippingCents?: number;
}

export async function recordSale(input: RecordSaleInput): Promise<Sale> {
  const sale = await mutate((state) => {
    const campaign = state.campaigns.find((c) => c.id === input.campaignId);
    if (!campaign) throw new Error("Campaign not found.");
    if (campaign.status !== "live") throw new Error("This campaign is not live.");
    const org = state.organizations.find((o) => o.id === campaign.organizationId);
    if (!org) throw new Error("Organization not found.");
    const product = products.find((p) => p.slug === input.productSlug && p.purchasable);
    if (!product) throw new Error("Invalid or unavailable product.");
    const quantity = Math.max(1, Math.min(20, Math.floor(input.quantity) || 1));
    const createdAt = new Date().toISOString();
    const sale: Sale = {
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      organizationId: org.id,
      athleteId: campaign.athleteId,
      productSlug: product.slug,
      productName: product.name,
      quantity,
      amountCents: product.priceCents * quantity,
      shippingCents: input.shippingCents ?? 0,
      amountOwedCents: earningsPerBagCents(org) * quantity,
      currency: "usd",
      buyerName: input.buyerName.trim() || "Anonymous supporter",
      buyerEmail: input.buyerEmail.trim().toLowerCase(),
      source: input.source ?? "simulated",
      stripeSessionId: input.stripeSessionId ?? null,
      payoutPeriodId: null,
      booksSyncStatus: "pending",
      createdAt,
    };
    if (sale.stripeSessionId && state.sales.some((s) => s.stripeSessionId === sale.stripeSessionId)) {
      return state.sales.find((s) => s.stripeSessionId === sale.stripeSessionId)!;
    }
    state.sales.push(sale);
    const event = buildSaleBooksEvent(state, sale);
    pushBooksEvent(state, event);
    return sale;
  });
  await flushBooksSync();
  return sale;
}

export async function computeCurrentPayouts(): Promise<PayoutPeriod[]> {
  const created = await mutate((state) => {
    const { start, end } = biweeklyWindow();
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const created: PayoutPeriod[] = [];

    for (const org of state.organizations) {
      const already = state.payouts.find(
        (p) => p.organizationId === org.id && p.startDate === startIso && p.endDate === endIso
      );
      if (already) continue;

      const saleIds = state.sales
        .filter((s) => {
          if (s.organizationId !== org.id) return false;
          if (s.payoutPeriodId) return false;
          const t = Date.parse(s.createdAt);
          return t >= start.getTime() && t <= end.getTime();
        })
        .map((s) => s.id);

      if (saleIds.length === 0) continue;

      const amountOwedCents = state.sales
        .filter((s) => saleIds.includes(s.id))
        .reduce((sum, s) => sum + s.amountOwedCents, 0);

      const payout: PayoutPeriod = {
        id: crypto.randomUUID(),
        organizationId: org.id,
        startDate: startIso,
        endDate: endIso,
        status: "open",
        amountOwedCents,
        saleIds,
        createdAt: new Date().toISOString(),
        paidAt: null,
      };
      state.payouts.push(payout);
      for (const sale of state.sales) {
        if (saleIds.includes(sale.id)) sale.payoutPeriodId = payout.id;
      }
      const computed = buildPayoutBooksEvent(state, payout.id, "payout.computed", payout.createdAt);
      if (computed) pushBooksEvent(state, computed);
      created.push(payout);
    }
    return created;
  });
  await flushBooksSync();
  return created;
}

export async function markPayoutPaid(payoutId: string): Promise<PayoutPeriod> {
  const payout = await mutate((state) => {
    const row = state.payouts.find((p) => p.id === payoutId);
    if (!row) throw new Error("Payout not found.");
    row.status = "paid";
    row.paidAt = new Date().toISOString();
    const paidEvent = buildPayoutBooksEvent(state, row.id, "payout.paid", row.paidAt);
    if (paidEvent) pushBooksEvent(state, paidEvent);
    return { ...row };
  });
  await flushBooksSync();
  return payout;
}

async function flushBooksSync(): Promise<void> {
  await mutate(async (state) => {
    await syncBooksEvents(state);
  });
}

export async function runBooksSync(): Promise<BooksEvent[]> {
  await flushBooksSync();
  return listBooksEvents();
}
