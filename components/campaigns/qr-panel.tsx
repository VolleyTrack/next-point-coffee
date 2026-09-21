import { campaignQrDataUrl } from "@/lib/campaigns/qr";
import { CopyButton } from "./copy-button";

export async function QrPanel({ url, title = "Share this campaign" }: { url: string; title?: string }) {
  const src = await campaignQrDataUrl(url);

  return (
    <div className="rounded-lg border border-gold/30 bg-card p-6">
      <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">{title}</p>
      <p className="mt-2 break-all text-sm text-muted-foreground">{url}</p>
      <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="QR code for this campaign link"
          className="h-40 w-40 rounded-md border border-gold/20"
        />
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Print or screenshot this QR. It opens the same public campaign page.
          </p>
          <CopyButton value={url} />
        </div>
      </div>
    </div>
  );
}
