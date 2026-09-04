import Image from "next/image";
import { ProductCard } from "@/components/product-card";
import { WaitlistForm } from "@/components/waitlist-form";
import { products } from "@/lib/site";

export default function ShopPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-12 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Shop</p>
        <h1 className="mt-2 text-4xl font-black text-np-cream sm:text-5xl">The Lineup</h1>
        <p className="mt-4 text-muted-foreground">
          Three roasts, one mindset: focus forward. First Serve is brewing now — Second Wind and
          Half Caff are next up. Join the list and we&apos;ll email you the moment checkout opens.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>

      <div className="mt-16 grid grid-cols-1 items-center gap-10 rounded-lg border border-gold/20 bg-card p-8 md:grid-cols-2">
        <div>
          <h2 className="text-2xl font-black text-np-cream">First Serve — up close</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            100% Arabica, medium roast, whole bean. Balanced and smooth with notes of caramel,
            toasted nut, and milk chocolate. Roasted and packaged in partnership with Jittery
            Joe&apos;s Coffee Roasting Company in Athens, Georgia.
          </p>
          <div className="mt-6">
            <WaitlistForm ctaLabel="Notify Me at Launch" context="shop-first-serve" />
          </div>
        </div>
        <div className="mx-auto w-full max-w-xs overflow-hidden rounded-lg border border-gold/30">
          <Image
            src="https://g.tlcdn.com/view/0c9364a42a8e430e80c92660e13f0273.png"
            alt="First Serve label detail"
            width={1254}
            height={1254}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
