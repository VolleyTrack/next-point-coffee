import { ProductCard } from "@/components/product-card";
import { products, storeLive } from "@/lib/site";

export default function ShopPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-12 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Shop</p>
        <h1 className="mt-2 text-4xl font-black text-np-cream sm:text-5xl">The Lineup</h1>
        <p className="mt-4 text-muted-foreground">
          {storeLive
            ? "First Serve and Second Wind are ready to order now. Half Caff is brewing next."
            : "First Serve and Second Wind are almost here - Half Caff is next up after that. Join the list and we'll email you the moment checkout opens."}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Bag prices include shipping within the United States.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </div>
  );
}
