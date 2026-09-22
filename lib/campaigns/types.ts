export type OrganizationType = "club" | "nonprofit";
export type CampaignStatus = "draft" | "live" | "closed";
export type PortalRole = "admin" | "club" | "athlete";
export type SaleSource = "simulated" | "stripe";
export type BooksSyncStatus = "pending" | "synced" | "stubbed" | "failed";
export type PayoutStatus = "open" | "paid";

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  slug: string;
  contactEmail: string;
  /** Amount Next Point Coffee owes the org per bag, set manually on create — not implied by type. */
  bagShareCents: number;
  createdAt: string;
}

export interface Athlete {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  organizationId: string;
  athleteId: string;
  name: string;
  slug: string;
  story: string;
  goalBags: number;
  status: CampaignStatus;
  createdAt: string;
  publishedAt: string | null;
}

export interface Sale {
  id: string;
  campaignId: string;
  organizationId: string;
  athleteId: string;
  productSlug: string;
  productName: string;
  quantity: number;
  /** Gross sale total. Admin-only in product UI and partner/public APIs. */
  amountCents: number;
  shippingCents: number;
  amountOwedCents: number;
  currency: string;
  buyerName: string;
  buyerEmail: string;
  source: SaleSource;
  stripeSessionId: string | null;
  payoutPeriodId: string | null;
  booksSyncStatus: BooksSyncStatus;
  createdAt: string;
}

export interface PayoutPeriod {
  id: string;
  organizationId: string;
  startDate: string;
  endDate: string;
  status: PayoutStatus;
  amountOwedCents: number;
  saleIds: string[];
  createdAt: string;
  paidAt: string | null;
}

export interface PortalUser {
  id: string;
  role: PortalRole;
  name: string;
  email: string;
  organizationId?: string;
  athleteId?: string;
  /** bcrypt hash. Never send this to the browser. Missing hash means the account cannot sign in. */
  passwordHash?: string;
}

/** Portal user safe to render or return from APIs. */
export type PublicPortalUser = Omit<PortalUser, "passwordHash">;

/** Plaintext password returned once when an account is created. It is not stored. */
export interface IssuedPortalCredential {
  role: PortalRole;
  name: string;
  email: string;
  temporaryPassword: string;
}

export interface BooksEvent {
  id: string;
  type: "sale.recorded" | "payout.computed" | "payout.paid";
  version: 1;
  occurredAt: string;
  payload: Record<string, unknown>;
  syncStatus: BooksSyncStatus;
  lastError: string | null;
}

export type CampaignRequestStatus = "new" | "handled";

export interface CampaignRequest {
  id: string;
  organizationName: string;
  organizationType: OrganizationType;
  contactName: string;
  contactEmail: string;
  phone: string;
  city: string;
  athleteName: string;
  notes: string;
  status: CampaignRequestStatus;
  createdAt: string;
  handledAt: string | null;
}

export interface CampaignStoreState {
  organizations: Organization[];
  athletes: Athlete[];
  campaigns: Campaign[];
  sales: Sale[];
  payouts: PayoutPeriod[];
  users: PortalUser[];
  booksEvents: BooksEvent[];
  campaignRequests: CampaignRequest[];
}

export interface CampaignWithRelations extends Campaign {
  organization: Organization;
  athlete: Athlete;
  bagsSold: number;
  amountOwedCents: number;
}

export interface OrgSummary {
  organization: Organization;
  bagsSold: number;
  amountOwedCents: number;
  amountPaidCents: number;
  amountOpenCents: number;
  campaignCount: number;
  liveCampaignCount: number;
}
