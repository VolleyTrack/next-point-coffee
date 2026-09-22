export default function ShippingReturnsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-muted-foreground">
      <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Legal</p>
      <h1 className="mt-2 text-4xl font-black text-np-cream">Shipping & Returns</h1>
      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <h2 className="text-lg font-bold text-np-cream">Shipping</h2>
        <p>
          Orders are typically processed within 1-3 business days. Standard domestic shipping
          takes an additional 3-7 business days. Shipping is included in the listed bag price.
          We currently ship within the United States only.
        </p>
        <h2 className="text-lg font-bold text-np-cream">Returns & Refunds</h2>
        <p>
          Because our products are consumable food items, we do not accept returns once a bag has
          been opened. If your order arrives damaged, incorrect, or defective, contact us within 7
          days of delivery at{" "}
          <a href="mailto:info@nextpointcoffee.com" className="text-gold hover:underline">
            info@nextpointcoffee.com
          </a>{" "}
          with your order number and a photo of the issue, and we'll make it right with a
          replacement or refund.
        </p>
        <h2 className="text-lg font-bold text-np-cream">Order Issues</h2>
        <p>
          If your order hasn't arrived within the estimated delivery window, please reach out and
          we'll help track it down.
        </p>
        <p className="mt-8 rounded-md border border-gold/20 bg-card p-4 text-xs">
          This is a general template and has not been reviewed by an attorney. Please have this
          policy reviewed by legal counsel before relying on it for your business.
        </p>
      </div>
    </div>
  );
}
