import { formatMoney } from "@/lib/domain/money";
import { cn } from "@/lib/utils";

export function Price({ amount, currency, className }: { amount: number; currency: string; className?: string }) {
  return <span className={cn("font-bold tabular-nums", className)}>{formatMoney(amount, currency)}</span>;
}
