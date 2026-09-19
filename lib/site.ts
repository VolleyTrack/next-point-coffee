export const site = {
  name: "Next Point Coffee Co.",
  domain: "nextpointcoffee.com",
  tagline: "You Can't Change the Last Point. Own the Next.",
  mission:
    "Great days aren't built on the last point. They're built on the next one. Next Point Coffee Co. is for the athletes, the leaders, and the everyday competitors who choose to focus forward, fuel up, and own what's next.",
  fundraiserHook: "Fuel Your Team. Fund Your Season.",
  fundraiserBlurb:
    "Premium coffee people actually drink. You promote the link. We roast, pack, and ship. Clubs earn $3 a bag. Nonprofits earn $5 a bag. Bags will retail $18\u2013$22 when we go live.",
  contactEmail: "info@nextpointcoffee.com",
  establishedYear: "2026",
  clubEarningsPerBag: 3,
  nonprofitEarningsPerBag: 5,
  bagPriceRange: "$18\u2013$22",
  roasterPartner: "Jittery Joe's Coffee Roasting Company, Athens, Georgia",
  founder: "Ryan Mullen",
};

// Master switch: keep false until Stripe keys + approved label are both ready.
// Flip to true (env var NEXT_PUBLIC_STORE_LIVE=true in Vercel) to accept real orders.
export const storeLive = process.env.NEXT_PUBLIC_STORE_LIVE === "true";

// Flat shipping fee in cents, charged as a separate Stripe line item.
export const flatShippingCents = 650; // $6.50 placeholder \u2014 update once you have a real carrier quote

export interface Product {
  slug: string;
  name: string;
  roast: string;
  roastLevel: number; // out of 5
  tag: string;
  accent: "gold" | "green" | "blue";
  tastingNotes: string;
  available: boolean;
  purchasable: boolean;
  netWeight: string;
  priceCents: number; // $20.00 = 2000
}

export const products: Product[] = [
  {
    slug: "first-serve",
    name: "First Serve",
    roast: "Medium Roast",
    roastLevel: 3,
    tag: "Start Strong.",
    accent: "gold",
    tastingNotes: "Well-balanced medium roast. Brown sugar sweetness accented by toasted almonds and light citrus.",
    available: true,
    purchasable: true,
    netWeight: "12 OZ (341g)",
    priceCents: 2000,
  },
  {
    slug: "second-wind",
    name: "Second Wind",
    roast: "Dark Roast",
    roastLevel: 4,
    tag: "Bold. Rich. Strong.",
    accent: "green",
    tastingNotes: "Bold and rich \u2014 built for the comeback. Finish strong.",
    available: true,
    purchasable: true,
    netWeight: "12 OZ (341g)",
    priceCents: 2000,
  },
  {
    slug: "half-caff",
    name: "Half Caff",
    roast: "Medium Roast",
    roastLevel: 3,
    tag: "All Flavor. Half the Caffeine.",
    accent: "blue",
    tastingNotes: "All the flavor, half the caffeine. All focus.",
    available: false,
    purchasable: false,
    netWeight: "12 OZ (341g)",
    priceCents: 2000,
  },
];

export const howItWorks = [
  {
    step: 1,
    title: "Commit",
    description: "Sign the short partner agreement. We issue your unique fundraiser link when checkout opens.",
  },
  {
    step: 2,
    title: "Promote",
    description: "Share the link with families, alumni, and fans. We send captions and graphics.",
  },
  {
    step: 3,
    title: "Sell",
    description: "Supporters order online. We roast, pack, and ship. You never warehouse a bag.",
  },
  {
    step: 4,
    title: "Earn",
    description: "Clubs earn $3 a bag. Nonprofits earn $5 a bag. Paid within 30 days after the campaign closes.",
  },
];
