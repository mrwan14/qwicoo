"use client";

import { formatMoney } from "@/lib/format/money";
import { useLocale } from "@/lib/i18n/locale-store";

export function Money({
  amount,
  currency = "EGP",
  locale,
}: {
  amount: string;
  currency?: string;
  locale?: string;
}) {
  const current = useLocale().locale;
  return (
    <span className="tabular-nums">{formatMoney(amount, currency, locale ?? current)}</span>
  );
}
