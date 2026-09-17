export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-muted-foreground">
      <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Legal</p>
      <h1 className="mt-2 text-4xl font-black text-np-cream">Terms of Service</h1>
      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <p>
          Welcome to Next Point Coffee Co. ("Next Point," "we," "us," or "our"). By accessing or
          purchasing from nextpointcoffee.com (the "Site"), you agree to these Terms of Service.
        </p>
        <h2 className="text-lg font-bold text-np-cream">Products and Pricing</h2>
        <p>
          All products are subject to availability. We reserve the right to modify prices,
          discontinue products, or limit order quantities at any time without prior notice.
        </p>
        <h2 className="text-lg font-bold text-np-cream">Orders and Payment</h2>
        <p>
          Payments are processed securely through Stripe. By placing an order, you represent that
          you are authorized to use the payment method provided. All sales are subject to our
          Refund Policy.
        </p>
        <h2 className="text-lg font-bold text-np-cream">Team Fundraising Program</h2>
        <p>
          Clubs and organizations participating in our fundraising program earn a commission per
          unit sold as described on our Fundraising page. Program terms are subject to a separate
          agreement between Next Point Coffee Co. and the participating organization.
        </p>
        <h2 className="text-lg font-bold text-np-cream">Limitation of Liability</h2>
        <p>
          Next Point Coffee Co. is not liable for indirect, incidental, or consequential damages
          arising from use of our products or Site, to the fullest extent permitted by law.
        </p>
        <h2 className="text-lg font-bold text-np-cream">Contact</h2>
        <p>
          Questions about these terms? Email us at{" "}
          <a href="mailto:info@nextpointcoffee.com" className="text-gold hover:underline">
            info@nextpointcoffee.com
          </a>
          .
        </p>
        <p className="mt-8 rounded-md border border-gold/20 bg-card p-4 text-xs">
          This is a general template and has not been reviewed by an attorney. Please have these
          terms reviewed by legal counsel before relying on them for your business.
        </p>
      </div>
    </div>
  );
}
