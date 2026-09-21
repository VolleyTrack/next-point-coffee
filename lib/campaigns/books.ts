import type { BooksEvent, CampaignStoreState, Sale } from "./types";

export const BOOKS_EVENT_VERSION = 1 as const;

export function buildSaleBooksEvent(state: CampaignStoreState, sale: Sale): BooksEvent {
  const campaign = state.campaigns.find((c) => c.id === sale.campaignId);
  const athlete = state.athletes.find((a) => a.id === sale.athleteId);
  const organization = state.organizations.find((o) => o.id === sale.organizationId);
  const payout = sale.payoutPeriodId
    ? state.payouts.find((p) => p.id === sale.payoutPeriodId)
    : undefined;

  return {
    id: `evt-${sale.id}`,
    type: "sale.recorded",
    version: BOOKS_EVENT_VERSION,
    occurredAt: sale.createdAt,
    payload: {
      saleId: sale.id,
      campaignId: sale.campaignId,
      campaignSlug: campaign?.slug ?? null,
      campaignName: campaign?.name ?? null,
      athleteId: sale.athleteId,
      athleteName: athlete?.name ?? null,
      organizationId: sale.organizationId,
      organizationName: organization?.name ?? null,
      organizationType: organization?.type ?? null,
      productSlug: sale.productSlug,
      productName: sale.productName,
      quantity: sale.quantity,
      amountCents: sale.amountCents,
      shippingCents: sale.shippingCents,
      amountOwedCents: sale.amountOwedCents,
      currency: sale.currency,
      source: sale.source,
      stripeSessionId: sale.stripeSessionId,
      payoutPeriodId: sale.payoutPeriodId,
      payoutPeriodStart: payout?.startDate ?? null,
      payoutPeriodEnd: payout?.endDate ?? null,
      buyerEmail: sale.buyerEmail,
    },
    syncStatus: "pending",
    lastError: null,
  };
}

export function pushBooksEvent(state: CampaignStoreState, event: BooksEvent): void {
  if (state.booksEvents.some((e) => e.id === event.id)) return;
  state.booksEvents.push(event);
}

export async function syncBooksEvents(state: CampaignStoreState): Promise<void> {
  const pending = state.booksEvents.filter((e) => e.syncStatus === "pending" || e.syncStatus === "failed");
  const webhook = process.env.BOOKS_WEBHOOK_URL;

  for (const event of pending) {
    if (!webhook) {
      event.syncStatus = "stubbed";
      event.lastError = null;
      if (event.type === "sale.recorded") {
        const sale = state.sales.find((s) => s.id === event.payload.saleId);
        if (sale && sale.booksSyncStatus === "pending") sale.booksSyncStatus = "stubbed";
      }
      continue;
    }

    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: event.type,
          version: event.version,
          occurredAt: event.occurredAt,
          id: event.id,
          data: event.payload,
        }),
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

export function exportBooksLedger(state: CampaignStoreState) {
  return {
    generatedAt: new Date().toISOString(),
    version: BOOKS_EVENT_VERSION,
    sales: state.sales.map((sale) => {
      const campaign = state.campaigns.find((c) => c.id === sale.campaignId);
      const athlete = state.athletes.find((a) => a.id === sale.athleteId);
      const organization = state.organizations.find((o) => o.id === sale.organizationId);
      const payout = sale.payoutPeriodId
        ? state.payouts.find((p) => p.id === sale.payoutPeriodId)
        : undefined;
      return {
        id: sale.id,
        createdAt: sale.createdAt,
        campaignId: sale.campaignId,
        campaignSlug: campaign?.slug ?? null,
        athleteId: sale.athleteId,
        athleteName: athlete?.name ?? null,
        organizationId: sale.organizationId,
        organizationName: organization?.name ?? null,
        organizationType: organization?.type ?? null,
        quantity: sale.quantity,
        amountCents: sale.amountCents,
        amountOwedCents: sale.amountOwedCents,
        payoutPeriodId: sale.payoutPeriodId,
        payoutPeriodStart: payout?.startDate ?? null,
        payoutPeriodEnd: payout?.endDate ?? null,
        payoutStatus: payout?.status ?? "unassigned",
        booksSyncStatus: sale.booksSyncStatus,
        source: sale.source,
      };
    }),
    payouts: state.payouts.map((payout) => {
      const organization = state.organizations.find((o) => o.id === payout.organizationId);
      return {
        id: payout.id,
        organizationId: payout.organizationId,
        organizationName: organization?.name ?? null,
        startDate: payout.startDate,
        endDate: payout.endDate,
        amountOwedCents: payout.amountOwedCents,
        status: payout.status,
        paidAt: payout.paidAt,
        saleIds: payout.saleIds,
      };
    }),
    events: state.booksEvents,
  };
}
