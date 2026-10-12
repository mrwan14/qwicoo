"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { guestCopy } from "@/features/guest/copy";
import { guestPrimaryButton, guestSecondaryButton } from "@/features/guest/shell";
import { usePollingInterval } from "@/hooks/use-page-visible";
import { guestApi } from "@/lib/api/guest";
import type { components } from "@/lib/api/schema";
import type { LocaleCode } from "@/lib/i18n/locale-text";
import {
  PAY_RESULT_MAX_POLLS,
  PAY_RESULT_POLL_MS,
  orderSettled,
  parseUrlPayStatus,
  resultView,
} from "@/lib/paymob/result";
import { useGuest } from "@/stores/guest";

import "./guest.css";

type GuestOrder = components["schemas"]["OrderResponse"];

export function PayResultScreen({ locale }: { locale: LocaleCode }) {
  const t = guestCopy[locale];
  const dir = locale === "ar" ? "rtl" : "ltr";
  const search = useSearchParams();
  const status = search.get("status");
  const orderId = search.get("order");
  const [polls, setPolls] = useState(0);
  const urlStatus = parseUrlPayStatus(status);
  const interval = usePollingInterval(PAY_RESULT_POLL_MS);

  useEffect(() => {
    void useGuest.persist.rehydrate();
    if (useGuest.getState().locale !== locale) useGuest.getState().setLocale(locale);
  }, [locale]);

  const order = useQuery({
    queryKey: ["guest-active", "pay-result", orderId],
    refetchInterval: (query) => {
      const done = orderSettled(query.state.data, orderId) || polls >= PAY_RESULT_MAX_POLLS;
      return done ? false : interval;
    },
    queryFn: async (): Promise<GuestOrder | null> => {
      setPolls((count) => count + 1);
      const result = await guestApi.GET("/api/v1/orders/active");
      if (result.response.status === 401 || result.response.status === 404) return null;
      if (!result.response.ok || !result.data) return null;
      return result.data;
    },
  });

  const settled = orderSettled(order.data, orderId);

  const timedOut = polls >= PAY_RESULT_MAX_POLLS && !settled;
  const view = resultView({ urlStatus, settled, timedOut });

  return (
    <div dir={dir} lang={locale} className="guest-theme min-h-dvh">
      <div className="guest-phone grid gap-4 px-4 py-8">
        {view === "paid" ? (
          <>
            <h1 className="guest-display text-3xl">{t.paySuccessTitle}</h1>
            <p className="guest-body">{t.paySuccessBody}</p>
            <Link href="/order/track" className={guestPrimaryButton}>
              {t.backToOrder}
            </Link>
          </>
        ) : null}
        {view === "failed" ? (
          <>
            <h1 className="guest-display text-3xl">{t.payFailedTitle}</h1>
            <p className="guest-body">{t.payFailedBody}</p>
            <Link href="/order/track" className={guestPrimaryButton}>
              {t.payTryAgain}
            </Link>
            <Link href="/order/track" className={guestSecondaryButton}>
              {t.payAtCounter}
            </Link>
          </>
        ) : null}
        {view === "confirming" ? (
          <p role="status" className="guest-display text-3xl">
            {t.payConfirming}
          </p>
        ) : null}
        {view === "timeout" ? (
          <>
            <p role="status" className="guest-body">
              {t.payTimeout}
            </p>
            <Link href="/order/track" className={guestPrimaryButton}>
              {t.backToOrder}
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
