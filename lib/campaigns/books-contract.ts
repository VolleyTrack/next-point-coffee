/**
 * Integration contract for VolleyTrack/nextpoint-books.
 *
 * This repo (next-point-coffee) is the system of record for campaign sales.
 * nextpoint-books should upsert by the stable ids below — never invent its own
 * sale/payout keys. The private books repo was not readable from this
 * environment (404); these shapes are the handshake until that repo is shared.
 *
 * Target: https://github.com/VolleyTrack/nextpoint-books
 */

export const BOOKS_SOURCE = "next-point-coffee" as const;
export const BOOKS_CONTRACT_VERSION = 1 as const;

export type BooksEventType = "sale.recorded" | "payout.computed" | "payout.paid";

/** Outbound webhook / outbox envelope. Idempotent on `id`. */
export interface BooksEventEnvelope {
  source: typeof BOOKS_SOURCE;
  contractVersion: typeof BOOKS_CONTRACT_VERSION;
  event: BooksEventType;
  id: string;
  occurredAt: string;
  data: BooksSalePayload | BooksPayoutPayload;
}

export interface BooksSalePayload {
  saleId: string;
  createdAt: string;
  campaignId: string;
  campaignSlug: string | null;
  campaignName: string | null;
  athleteId: string;
  athleteName: string | null;
  organizationId: string;
  organizationName: string | null;
  organizationType: "club" | "nonprofit" | null;
  bagShareCents: number | null;
  productSlug: string;
  productName: string;
  quantity: number;
  amountCents: number;
  shippingCents: number;
  amountOwedCents: number;
  currency: "usd";
  source: "simulated" | "stripe";
  stripeSessionId: string | null;
  payoutPeriodId: string | null;
  payoutPeriodStart: string | null;
  payoutPeriodEnd: string | null;
  payoutStatus: "open" | "paid" | "unassigned";
  buyerEmail: string;
}

export interface BooksPayoutPayload {
  payoutId: string;
  organizationId: string;
  organizationName: string | null;
  organizationType: "club" | "nonprofit" | null;
  bagShareCents: number | null;
  startDate: string;
  endDate: string;
  amountOwedCents: number;
  status: "open" | "paid";
  paidAt: string | null;
  saleIds: string[];
}

export interface BooksOrganizationRecord {
  id: string;
  name: string;
  type: "club" | "nonprofit";
  slug: string;
  contactEmail: string;
  bagShareCents: number;
  createdAt: string;
}

export interface BooksAthleteRecord {
  id: string;
  organizationId: string;
  name: string;
  email: string;
}

export interface BooksCampaignRecord {
  id: string;
  organizationId: string;
  athleteId: string;
  name: string;
  slug: string;
  status: "draft" | "live" | "closed";
  goalBags: number;
  publishedAt: string | null;
}

export interface BooksLedgerSnapshot {
  source: typeof BOOKS_SOURCE;
  contractVersion: typeof BOOKS_CONTRACT_VERSION;
  generatedAt: string;
  organizations: BooksOrganizationRecord[];
  athletes: BooksAthleteRecord[];
  campaigns: BooksCampaignRecord[];
  sales: BooksSalePayload[];
  payouts: BooksPayoutPayload[];
  events: Array<{
    id: string;
    type: BooksEventType;
    occurredAt: string;
    syncStatus: "pending" | "synced" | "stubbed" | "failed";
  }>;
}

/**
 * Suggested nextpoint-books mapping (typical double-entry / AP books):
 *
 * | Coffee entity     | Books entity                         | Upsert key        |
 * |-------------------|--------------------------------------|-------------------|
 * | Organization      | Vendor / payee                       | organizationId    |
 * | Sale              | Journal: cash/AR + club payable      | saleId            |
 * | amountCents       | Credit revenue / debit cash          |                   |
 * | amountOwedCents   | Credit AP (org)                      |                   |
 * | PayoutPeriod      | Bill / settlement batch              | payoutId          |
 * | payout.paid       | Bill payment                         | payoutId          |
 * | athleteId         | Dimension / class / tracking category|                   |
 * | campaignId        | Dimension / class                    |                   |
 *
 * Pull: GET /api/books/export  (optional Bearer BOOKS_API_KEY)
 * Push: this app POSTs BooksEventEnvelope to BOOKS_WEBHOOK_URL
 * Discover: GET /api/books/contract
 */
export const BOOKS_CONTRACT_NOTES = {
  source: BOOKS_SOURCE,
  contractVersion: BOOKS_CONTRACT_VERSION,
  booksRepo: "https://github.com/VolleyTrack/nextpoint-books",
  pull: "GET /api/books/export",
  push: "BOOKS_WEBHOOK_URL receives BooksEventEnvelope",
  auth: "If BOOKS_API_KEY is set, send Authorization: Bearer <key> on pull; this app sends the same bearer on push.",
  idempotency: "Upsert sales by saleId, payouts by payoutId, events by id.",
} as const;
