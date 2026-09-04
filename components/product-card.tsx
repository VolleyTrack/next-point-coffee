import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RoastDots } from "@/components/roast-dots";
import type { Product } from "@/lib/site";
import { cn } from "@/lib/utils";

const accentBar: Record<Product["accent"], string> = {
  gold: "bg-gold",
  green: "bg-[hsl(var(--np-green))]",
  blue: "bg-[hsl(var(--np-blue))]",
};

export function ProductCard({ product }: { product: Product }) {
  return (
    <Card className="overflow-hidden border-gold/20 bg-card">
      <div className={cn("h-1.5 w-full", accentBar[product.accent])} />
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-np-cream">{product.name}</h3>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">{product.roast}</p>
          </div>
          {!product.available && (
            <Badge variant="outline" className="border-gold/50 text-gold">
              Coming Soon
            </Badge>
          )}
        </div>

        <p className="text-sm font-semibold uppercase tracking-widest-plus text-gold">{product.tag}</p>
        <p className="text-sm text-muted-foreground">{product.tastingNotes}</p>

        <div className="flex items-center justify-between border-t border-gold/10 pt-4">
          <RoastDots level={product.roastLevel} />
          <span className="text-xs text-muted-foreground">{product.netWeight}</span>
        </div>
      </CardContent>
    </Card>
  );
}
