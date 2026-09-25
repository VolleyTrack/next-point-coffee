import type Stripe from "stripe";
import { preorderCheckoutCustomText } from "@/lib/preorder";
import {
  clampRetailQuantity,
  grindLabel,
  isGrindId,
  products,
  retailMaxQuantity,
  retailProductTitle,
  type GrindId,
  type Product,
} from "@/lib/site";

export interface ResolvedRetailLine {
  slug: string;
  name: string;
  roast: string;
  tastingNotes: string;
  netWeight: string;
  priceCents: number;
  grind: GrindId;
  form: string;
  quantity: number;
  title: string;
}

export interface RetailCartOk {
  ok: true;
  lines: ResolvedRetailLine[];
}

export interface RetailCartError {
  ok: false;
  status: 400;
  error: string;
}

/** Form captured on a retail Checkout session, one entry per line. */
export interface RetailFormRef {
  product_slug: string;
  product_name: string;
  grind: GrindId;
  form: string;
  quantity: number;
}

const METADATA_VALUE_LIMIT = 500;

export function resolveRetailCart(items: unknown): RetailCartOk | RetailCartError {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, status: 400, error: "Your cart is empty." };
  }

  const lines: ResolvedRetailLine[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") {
      return { ok: false, status: 400, error: "Choose a coffee to continue." };
    }
    const raw = item as { slug?: unknown; grind?: unknown; quantity?: unknown };
    const slug = typeof raw.slug === "string" ? raw.slug : "";
    const product = products.find((entry) => entry.slug === slug);
    if (!product || !product.purchasable) {
      return { ok: false, status: 400, error: "That coffee isn't available." };
    }
    if (!isGrindId(raw.grind)) {
      return { ok: false, status: 400, error: "Choose Ground or Whole bean." };
    }
    lines.push(toRetailLine(product, raw.grind, raw.quantity));
  }

  return { ok: true, lines };
}

export function toStripeLineItem(line: ResolvedRetailLine) {
  return {
    price_data: {
      currency: "usd" as const,
      product_data: {
        name: line.title,
        description: `${line.form}. ${line.roast}. ${line.netWeight}. ${line.tastingNotes}`,
        metadata: {
          product_slug: line.slug,
          product_name: line.name,
          grind: line.grind,
          form: line.form,
        },
      },
      unit_amount: line.priceCents,
    },
    quantity: line.quantity,
    adjustable_quantity: {
      enabled: true,
      minimum: 1,
      maximum: retailMaxQuantity,
    },
  };
}

/**
 * Retail Checkout Session for the shop. Customers can enter a launch promotion
 * code and change the bag count up to retailMaxQuantity. Shipping stays inside
 * the bag price. Hosted Checkout collects the customer email. This collects a
 * US shipping address and does not add a shipping rate.
 */
export function retailCheckoutSessionParams(
  lines: ResolvedRetailLine[],
  origin: string
): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "payment",
    line_items: lines.map(toStripeLineItem),
    allow_promotion_codes: true,
    shipping_address_collection: { allowed_countries: ["US"] },
    custom_text: preorderCheckoutCustomText(),
    success_url: `${origin}/order-confirmed?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/shop`,
    metadata: retailCheckoutMetadata(lines),
  };
}

/**
 * Session metadata for fulfillment. A one-bag checkout also sets flat keys.
 * `items` is a JSON list so a cart with more than one form still round-trips.
 */
export function retailCheckoutMetadata(lines: ResolvedRetailLine[]): Record<string, string> {
  const refs = lines.map(toFormRef);
  const metadata: Record<string, string> = { channel: "retail" };
  const items = JSON.stringify(refs);
  if (items.length <= METADATA_VALUE_LIMIT) metadata.items = items;

  if (lines.length === 1) {
    const line = lines[0];
    metadata.productSlug = line.slug;
    metadata.productName = line.name;
    metadata.grind = line.grind;
    metadata.form = line.form;
    metadata.quantity = String(line.quantity);
  }

  return metadata;
}

/** Copy grind/form onto stored Stripe line items so books retries still see it. */
export function attachRetailForm(
  lineItems: unknown,
  metadata: Record<string, string> | null | undefined
): unknown {
  const forms = retailFormsFromMetadata(metadata);
  if (forms.length === 0 || !Array.isArray(lineItems)) return lineItems;

  return lineItems.map((item, index) => {
    const form = forms[index];
    if (!form || !item || typeof item !== "object") return item;
    return {
      ...(item as Record<string, unknown>),
      product_slug: form.product_slug,
      product_name: form.product_name,
      grind: form.grind,
      form: form.form,
    };
  });
}

export function retailFormsFromMetadata(
  metadata: Record<string, string> | null | undefined
): RetailFormRef[] {
  if (!metadata) return [];

  const fromItems = parseItemsMetadata(metadata.items);
  if (fromItems.length > 0) return fromItems;

  if (!isGrindId(metadata.grind) || !metadata.productSlug?.trim()) return [];
  const grind = metadata.grind;
  const quantity = clampQuantity(metadata.quantity);
  return [
    {
      product_slug: metadata.productSlug.trim(),
      product_name: metadata.productName?.trim() || metadata.productSlug.trim(),
      grind,
      form: metadata.form?.trim() || grindLabel(grind),
      quantity,
    },
  ];
}

function toRetailLine(product: Product, grind: GrindId, quantity: unknown): ResolvedRetailLine {
  const form = grindLabel(grind);
  return {
    slug: product.slug,
    name: product.name,
    roast: product.roast,
    tastingNotes: product.tastingNotes,
    netWeight: product.netWeight,
    priceCents: product.priceCents,
    grind,
    form,
    quantity: clampQuantity(quantity),
    title: retailProductTitle(product.name, grind),
  };
}

function toFormRef(line: ResolvedRetailLine): RetailFormRef {
  return {
    product_slug: line.slug,
    product_name: line.name,
    grind: line.grind,
    form: line.form,
    quantity: line.quantity,
  };
}

function parseItemsMetadata(raw: string | undefined): RetailFormRef[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const forms: RetailFormRef[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as {
      slug?: unknown;
      product_slug?: unknown;
      name?: unknown;
      product_name?: unknown;
      grind?: unknown;
      form?: unknown;
      quantity?: unknown;
    };
    if (!isGrindId(row.grind)) continue;
    const slug = stringValue(row.slug) || stringValue(row.product_slug);
    if (!slug) continue;
    const name = stringValue(row.name) || stringValue(row.product_name) || slug;
    forms.push({
      product_slug: slug,
      product_name: name,
      grind: row.grind,
      form: stringValue(row.form) || grindLabel(row.grind),
      quantity: clampQuantity(row.quantity),
    });
  }
  return forms;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function clampQuantity(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return clampRetailQuantity(parsed);
}
