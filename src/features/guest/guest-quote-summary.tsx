import { Money } from "@/components/ops/money";
import { guestQuoteFigures, type QuotePricing } from "@/features/guest/guest-prices";

export function GuestQuoteSummary({
  pricing,
  labels,
  locale,
  currency = "EGP",
}: {
  pricing: QuotePricing;
  labels: {
    subtotal: string;
    discount: string;
    serviceFee: string;
    tax: string;
    total: string;
  };
  locale: "en" | "ar";
  currency?: string;
}) {
  const figures = guestQuoteFigures(pricing);
  const rows = [
    [labels.subtotal, figures.subtotal],
    [labels.discount, figures.discount],
    [labels.serviceFee, figures.serviceFee],
    [labels.tax, figures.tax],
  ] as const;

  return (
    <div className="grid gap-1 text-sm">
      {rows.map(([label, amount]) => (
        <p key={label} className="flex justify-between gap-3">
          <span>{label}</span>
          <Money amount={amount} currency={currency} locale={locale} />
        </p>
      ))}
      <p className="flex justify-between gap-3 text-base font-semibold">
        <span>{labels.total}</span>
        <Money amount={figures.total} currency={currency} locale={locale} />
      </p>
    </div>
  );
}
