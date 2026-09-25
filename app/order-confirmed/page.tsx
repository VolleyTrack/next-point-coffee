import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { OrderConfirmedContent } from "@/components/order-confirmed";
import { preorderCardLine } from "@/lib/preorder";

export default function OrderConfirmedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      }
    >
      <OrderConfirmedContent shipLine={preorderCardLine()} />
    </Suspense>
  );
}
