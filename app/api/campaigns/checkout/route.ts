import { NextResponse } from "next/server";
import { flatShippingCents, products, storeLive } from "@/lib/site";
import { getStripe } from "@/lib/stripe";
import { getCampaignBySlug, recordSale } from "@/lib/campaigns/store";
import { canAccessCampaigns, campaignsUnavailableResponse } from "@/lib/campaigns/preview-access";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await canAccessCampaigns())) {
    return campaignsUnavailableResponse();
  }

  const body = await request.json().catch(() => ({}));
  const slug = String(body.campaignSlug ?? "");
  const productSlug = String(body.productSlug ?? "");
  const quantity = Number(body.quantity);
  const buyerName = String(body.buyerName ?? "").trim();
  const buyerEmail = String(body.buyerEmail ?? "").trim();
  const simulate = body.simulate === true || !storeLive || !process.env.STRIPE_SECRET_KEY;

  const campaign = await getCampaignBySlug(slug);
  if (!campaign || campaign.status !== "live") {
    return NextResponse.json({ error: "That campaign is not live." }, { status: 404 });
  }

  const product = products.find((p) => p.slug === productSlug && p.purchasable);
  if (!product) {
    return NextResponse.json({ error: "Choose a coffee that is available." }, { status: 400 });
  }
  if (!buyerEmail.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const qty = Math.max(1, Math.min(20, Math.floor(quantity) || 1));
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https");
  const origin =
    request.headers.get("origin") ||
    (host ? `${proto}://${host}` : `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "nextpointcoffee.com"}`);

  if (simulate) {
    try {
      const sale = await recordSale({
        campaignId: campaign.id,
        productSlug: product.slug,
        quantity: qty,
        buyerName,
        buyerEmail,
        source: "simulated",
        shippingCents: 0,
      });
      return NextResponse.json({
        simulated: true,
        url: `${origin}/campaigns/thanks?sale=${sale.id}&campaign=${campaign.slug}`,
      });
    } catch (err) {
      console.error("Simulated campaign checkout failed:", err);
      return NextResponse.json({ error: "Could not record that purchase." }, { status: 500 });
    }
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: buyerEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${product.name} — ${product.roast}`,
              description: `Supports ${campaign.athlete.name} · ${campaign.organization.name}`,
            },
            unit_amount: product.priceCents,
          },
          quantity: qty,
        },
      ],
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: flatShippingCents, currency: "usd" },
            display_name: "Standard Shipping",
          },
        },
      ],
      metadata: {
        channel: "campaign",
        campaignId: campaign.id,
        campaignName: campaign.name,
        campaignSlug: campaign.slug,
        athleteId: campaign.athleteId,
        organizationId: campaign.organizationId,
        productSlug: product.slug,
        quantity: String(qty),
        buyerName,
      },
      success_url: `${origin}/campaigns/thanks?session_id={CHECKOUT_SESSION_ID}&campaign=${campaign.slug}`,
      cancel_url: `${origin}/campaigns/${campaign.slug}`,
    });

    return NextResponse.json({ url: session.url, simulated: false });
  } catch (err) {
    console.error("Campaign Stripe checkout failed:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}
