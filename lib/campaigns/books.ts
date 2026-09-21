import { booksAuthHeaders, booksApiKey } from "./books-auth";
import {
  BOOKS_CONTRACT_VERSION,
  BOOKS_SOURCE,
  type BooksEventEnvelope,
  type BooksLedgerSnapshot,
  type BooksPayoutPayload,
  type BooksSalePayload,
} from "./books-contract";
import type { BooksEvent, CampaignStoreState, Sale } from "./types";

export const BOOKS_EVENT_VERSION = BOOKS_CONTRACT_VERSION;

function salePayload(state: CampaignStoreState, sale: Sale): BooksSalePayload {
  const campaign = state.campaigns.find((c) => c.id === sale.campaignId);
  const athlete = state.athletes.find((a) => a.id === sale.athleteId);
  const organization = state.organizations.find((o) => o.id === sale.organizationId);
  const payout = sale.payoutPeriodId
    ? state.payouts.find((p) => p.id === sale.payoutPeriodId)
    : undefined;

  return {
    saleId: sale.id,
    createdAt: sale.createdAt,
    campaignId: sale.campaignId,
    campaignSlug: campaign?.slug ?? null,
    campaignName: campaign?.name ?? null,
    athleteId: sale.athleteId,
    athleteName: athlete?.name ?? null,
    organizationId: sale.organizationId,
    organizationName: organization?.name ?? null,
    organizationType: organization?.type ?? null,
    bagShareCents: organization?.bagShareCents ?? null,
    productSlug: sale.productSlug,
    productName: sale.productName,
    quantity: sale.quantity,
    amountCents: sale.amountCents,
    shippingCents: sale.shippingCents,
    amountOwedCents: sale.amountOwedCents,
    currency: "usd",
    source: sale.source,
    stripeSessionId: sale.stripeSessionId,
    payoutPeriodId: sale.payoutPeriodId,
    payoutPeriodStart: payout?.startDate ?? null,
    payoutPeriodEnd: payout?.endDate ?? null,
    payoutStatus: payout?.status ?? "unassigned",
    buyerEmail: sale.buyerEmail,
  };
}

function payoutPayload(state: CampaignStoreState, payoutId: string): BooksPayoutPayload | null {
  const payout = state.payouts.find((p) => p.id === payoutId);
  if (!payout) return null;
  const organization = state.organizations.find((o) => o.id === payout.organizationId);
  return {
    payoutId: payout.id,
    organizationId: payout.organizationId,
    organizationName: organization?.name ?? null,
    organizationType: organization?.type ?? null,
    bagShareCents: organization?.bagShareCents ?? null,
    startDate: payout.startDate,
    endDate: payout.endDate,
    amountOwedCents: payout.amountOwedCents,
    status: payout.status,
    paidAt: payout.paidAt,
    saleIds: payout.saleIds,
  };
}

export function buildPayoutBooksEvent(
  state: CampaignStoreState,
  payoutId: string,
  type: "payout.computed" | "payout.paid",
  occurredAt: string
): BooksEvent | null {
  const payload = payoutPayload(state, payoutId);
  if (!payload) return null;
  return {
    id: `evt-${type}-${payoutId}`,
    type,
    version: BOOKS_EVENT_VERSION,
    occurredAt,
    payload: payload as unknown as Record<string, unknown>,
    syncStatus: "pending",
    lastError: null,
  };
}

export function buildSaleBooksEvent(state: CampaignStoreState, sale: Sale): BooksEvent {
  const payload = salePayload(state, sale);
  return {
    id: `evt-${sale.id}`,
    type: "sale.recorded",
    version: BOOKS_EVENT_VERSION,
    occurredAt: sale.createdAt,
    payload: payload as unknown as Record<string, unknown>,
    syncStatus: "pending",
    lastError: null,
  };
}

export function pushBooksEvent(state: CampaignStoreState, event: BooksEvent): void {
  if (state.booksEvents.some((e) => e.id === event.id)) return;
  state.booksEvents.push(event);
}

function envelopeFor(event: BooksEvent): BooksEventEnvelope | null {
  if (event.type === "sale.recorded") {
    return {
      source: BOOKS_SOURCE,
      contractVersion: BOOKS_CONTRACT_VERSION,
      event: event.type,
      id: event.id,
      occurredAt: event.occurredAt,
      data: event.payload as unknown as BooksSalePayload,
    };
  }
  if (event.type === "payout.computed" || event.type === "payout.paid") {
    return {
      source: BOOKS_SOURCE,
      contractVersion: BOOKS_CONTRACT_VERSION,
      event: event.type,
      id: event.id,
      occurredAt: event.occurredAt,
      data: event.payload as unknown as BooksPayoutPayload,
    };
  }
  return null;
}

export async function syncBooksEvents(state: CampaignStoreState): Promise<void> {
  const pending = state.booksEvents.filter((e) => e.syncStatus === "pending" || e.syncStatus === "failed");
  const webhook = process.env.BOOKS_WEBHOOK_URL;

  for (const event of pending) {
    if (!webhook) {
      event.syncStatus = "stubbed";
      event.lastError = booksApiKey()
        ? null
        : "BOOKS_WEBHOOK_URL unset — stubbed for nextpoint-books.";
      if (event.type === "sale.recorded") {
        const sale = state.sales.find((s) => s.id === event.payload.saleId);
        if (sale && sale.booksSyncStatus === "pending") sale.booksSyncStatus = "stubbed";
      }
      continue;
    }

    const body = envelopeFor(event);
    if (!body) {
      event.syncStatus = "failed";
      event.lastError = "Unknown event type";
      continue;
    }

    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: booksAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`Books webhook returned ${res.status}`);
      }
      event.syncStatus = "synced";
      event.lastError = null;
      if (event.type === "sale.recorded") {
        const sale = state.sales.find((s) => s.id === event.payload.saleId);
        if (sale) sale.booksSyncStatus = "synced";
      }
    } catch (err) {
      event.syncStatus = "failed";
      event.lastError = err instanceof Error ? err.message : "Books webhook failed";
      if (event.type === "sale.recorded") {
        const sale = state.sales.find((s) => s.id === event.payload.saleId);
        if (sale) sale.booksSyncStatus = "failed";
      }
    }
  }
}

export function exportBooksLedger(state: CampaignStoreState): BooksLedgerSnapshot {
  return {
    source: BOOKS_SOURCE,
    contractVersion: BOOKS_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    organizations: state.organizations.map((org) => ({
      id: org.id,
      name: org.name,
      type: org.type,
      slug: org.slug,
      contactEmail: org.contactEmail,
      bagShareCents: org.bagShareCents,
      createdAt: org.createdAt,
    })),
    athletes: state.athletes.map((athlete) => ({
      id: athlete.id,
      organizationId: athlete.organizationId,
      name: athlete.name,
      email: athlete.email,
    })),
    campaigns: state.campaigns.map((campaign) => ({
      id: campaign.id,
      organizationId: campaign.organizationId,
      athleteId: campaign.athleteId,
      name: campaign.name,
      slug: campaign.slug,
      status: campaign.status,
      goalBags: campaign.goalBags,
      publishedAt: campaign.publishedAt,
    })),
    sales: state.sales.map((sale) => salePayload(state, sale)),
    payouts: state.payouts
      .map((payout) => payoutPayload(state, payout.id))
      .filter((row): row is BooksPayoutPayload => Boolean(row)),
    events: state.booksEvents.map((event) => ({
      id: event.id,
      type: event.type,
      occurredAt: event.occurredAt,
      syncStatus: event.syncStatus,
    })),
  };
}
