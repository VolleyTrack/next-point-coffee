export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-muted-foreground">
      <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Legal</p>
      <h1 className="mt-2 text-4xl font-black text-np-cream">Privacy Policy</h1>
      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <p>
          Next Point Coffee Co. (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) respects your privacy. This policy explains
          what information we collect and how we use it.
        </p>
        <h2 className="text-lg font-bold text-np-cream">Information We Collect</h2>
        <p>
          When you place an order, sign up for updates, or contact us, we collect your name, email
          address, shipping address, and order details. Payment card information is collected and
          processed directly by Stripe — we never see or store your full card number.
        </p>
        <h2 className="text-lg font-bold text-np-cream">How We Use Your Information</h2>
        <p>
          We use your information to process orders, communicate with you about your purchase or
          fundraiser, send launch updates (only if you opt in), and improve our products and Site.
          We do not sell your personal information to third parties.
        </p>
        <h2 className="text-lg font-bold text-np-cream">Third-Party Services</h2>
        <p>
          We use Stripe for payment processing and Supabase for secure data storage. These
          providers have their own privacy policies governing how they handle your data.
        </p>
        <h2 className="text-lg font-bold text-np-cream">Your Choices</h2>
        <p>
          You can unsubscribe from email updates at any time. To request deletion of your personal
          data, email us at{" "}
          <a href="mailto:info@nextpointcoffee.com" className="text-gold hover:underline">
            info@nextpointcoffee.com
          </a>
          .
        </p>
        <p className="mt-8 rounded-md border border-gold/20 bg-card p-4 text-xs">
          This is a general template and has not been reviewed by an attorney. Please have this
          policy reviewed by legal counsel before relying on it for your business.
        </p>
      </div>
    </div>
  );
}
