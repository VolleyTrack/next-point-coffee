import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { products, retailMaxQuantity, storeLive } from "@/lib/site";

interface CartItem {
  slug: string;
  quantity: number;
}

export async function POST(request: Request) {
  if (!storeLive) {
    return NextResponse.json(
      { error: "The store isn't live yet — check back soon!" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const items: CartItem[] = body?.items ?? [];

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  const line_items = items.map((item) => {
    const product = products.find((p) => p.slug === item.slug);
    if (!product || !product.purchasable) {
      throw new Error(`Invalid or unavailable product: ${item.slug}`);
    }
    const quantity = Math.max(1, Math.min(retailMaxQuantity, Math.floor(item.quantity) || 1));
    return {
      price_data: {
        currency: "usd",
        product_data: {
          name: `${product.name} — ${product.roast}`,
          description: product.tastingNotes,
        },
        unit_amount: product.priceCents,
      },
      quantity,
    };
  });

  try {
    const stripe = getStripe();
    const origin = request.headers.get("origin") || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;

    // Shipping is included in product.priceCents. Collect an address for fulfillment only.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      shipping_address_collection: { allowed_countries: ["US"] },
      success_url: `${origin}/order-confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop`,
      metadata: { channel: "retail" },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout session creation failed:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}
