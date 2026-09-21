import QRCode from "qrcode";

export async function campaignQrDataUrl(absoluteUrl: string): Promise<string> {
  return QRCode.toDataURL(absoluteUrl, {
    margin: 1,
    width: 280,
    color: {
      dark: "#1c1610",
      light: "#f4ead8",
    },
  });
}

export function campaignAbsoluteUrl(slug: string, origin?: string): string {
  const base =
    origin ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://nextpointcoffee.com");
  return `${base.replace(/\/$/, "")}/campaigns/${slug}`;
}
