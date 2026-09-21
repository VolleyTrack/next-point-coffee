import { site } from "@/lib/site";
import type { OrganizationType } from "./types";

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function earningsPerBagCents(type: OrganizationType): number {
  const dollars = type === "nonprofit" ? site.nonprofitEarningsPerBag : site.clubEarningsPerBag;
  return dollars * 100;
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "campaign";
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
