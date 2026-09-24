import { formatMoney } from "@/lib/format/money";

export function Money({
  amount,
  currency = "EGP",
  locale = "en",
}: {
  amount: string;
  currency?: string;
  locale?: string;
}) {
  return (
    <span className="tabular-nums">{formatMoney(amount, currency, locale)}</span>
  );
}
