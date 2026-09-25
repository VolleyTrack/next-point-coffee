/**
 * Customer email and shipping address captured by hosted Stripe Checkout.
 * Payment mode asks for an email. shipping_address_collection stores the
 * ship-to address on collected_information.shipping_details.
 */

export interface CheckoutCustomerDetails {
  email?: string | null;
  name?: string | null;
  address?: unknown;
}

export interface CheckoutShippingDetails {
  address?: unknown;
  name?: string | null;
}

export interface CheckoutCustomerSource {
  customer_details?: CheckoutCustomerDetails | null;
  customer_email?: string | null;
  collected_information?: {
    shipping_details?: CheckoutShippingDetails | null;
  } | null;
}

export interface CheckoutCustomer {
  customer_email: string;
  customer_name: string | null;
  shipping_address: unknown;
}

const ADDRESS_KEYS = ["line1", "line2", "city", "state", "postal_code", "country"] as const;

/** Keep an address only when Checkout actually collected one. */
export function usableShippingAddress(address: unknown): unknown {
  if (!address || typeof address !== "object") return null;
  const row = address as Record<string, unknown>;
  const hasLine = ADDRESS_KEYS.some((key) => typeof row[key] === "string" && row[key].trim().length > 0);
  return hasLine ? address : null;
}

export function checkoutCustomerFromSession(session: CheckoutCustomerSource): CheckoutCustomer {
  const shipping = session.collected_information?.shipping_details ?? null;
  const details = session.customer_details ?? null;
  const email = firstText(details?.email) || firstText(session.customer_email) || "unknown";
  const name = firstText(details?.name) || firstText(shipping?.name) || null;
  const shippingAddress =
    usableShippingAddress(shipping?.address) ?? usableShippingAddress(details?.address);

  return {
    customer_email: email,
    customer_name: name,
    shipping_address: shippingAddress,
  };
}

function firstText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
