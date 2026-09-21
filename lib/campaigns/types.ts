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
  /** Amount NPC owes the org per bag, set manually on create — not implied by type. */
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

export interface CampaignStoreState {
  organizations: Organization[];
  athletes: Athlete[];
  campaigns: Campaign[];
  sales: Sale[];
  payouts: PayoutPeriod[];
  users: PortalUser[];
  booksEvents: BooksEvent[];
}

export interface CampaignWithRelations extends Campaign {
  organization: Organization;
  athlete: Athlete;
  bagsSold: number;
  amountCents: number;
  amountOwedCents: number;
}

export interface OrgSummary {
  organization: Organization;
  bagsSold: number;
  amountCents: number;
  amountOwedCents: number;
  amountPaidCents: number;
  amountOpenCents: number;
  campaignCount: number;
  liveCampaignCount: number;
}
