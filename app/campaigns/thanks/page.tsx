import Link from "next/link";
import { getSaleById } from "@/lib/campaigns/store";
import { formatUsd } from "@/lib/campaigns/money";
import { CheckCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CampaignThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ sale?: string; campaign?: string }>;
}) {
  const params = await searchParams;
  const sale = params.sale ? await getSaleById(params.sale) : null;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <CheckCircle className="h-12 w-12 text-gold" />
      <h1 className="mt-4 text-3xl font-black text-np-cream">You backed the next point.</h1>
      {sale ? (
        <p className="mt-3 text-muted-foreground">
          {sale.quantity} bag{sale.quantity === 1 ? "" : "s"} of {sale.productName} — {formatUsd(sale.amountCents)}.
          The club is owed {formatUsd(sale.amountOwedCents)} on this sale, attributed to the assigned athlete.
        </p>
      ) : (
        <p className="mt-3 text-muted-foreground">Thanks for the support. We recorded your purchase.</p>
      )}
      <div className="mt-6 flex flex-col gap-3 text-sm font-semibold text-gold">
        {params.campaign && (
          <Link href={`/campaigns/${params.campaign}`} className="hover:underline">
            Back to the campaign
          </Link>
        )}
        <Link href="/shop" className="hover:underline">
          Shop coffee
        </Link>
      </div>
    </div>
  );
}
