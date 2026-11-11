"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleCheck, Star } from "lucide-react";
import { useState } from "react";

import { Money } from "@/components/ops/money";
import { GuestReveal } from "@/features/guest/guest-motion";
import { GuestSkeleton } from "@/features/guest/ordering-status";
import { useTableBill } from "@/features/guest/pay-bill-sheet";
import { startNewVisit } from "@/features/guest/session";
import { guestPrimaryButton, guestSecondaryButton, useBrandName, useGuestCopy } from "@/features/guest/shell";
import { fetchMyReview, submitReview, type BillPayment, type TableBill } from "@/features/guest/visit-api";
import { toCents } from "@/lib/guest/bill-split";
import { useGuest } from "@/stores/guest";

function startOver() {
  const token = startNewVisit();
  window.location.assign(token ? `/t/${encodeURIComponent(token)}` : "/order");
}

export function methodLabel(method: string, t: ReturnType<typeof useGuestCopy>["t"]): string {
  if (method === "CASH") return t.methodCash;
  if (method === "PAYMOB" || method === "ONLINE_CARD") return t.methodOnlineShort;
  return t.methodCardShort;
}

export function payerLabel(payment: BillPayment, t: ReturnType<typeof useGuestCopy>["t"]): string {
  if (payment.status === "pending") {
    return payment.is_mine ? t.youArePaying : t.payingNow.replace("{name}", payment.guest_name || t.someoneAtTable);
  }
  return payment.is_mine ? t.youPaid : t.paidBy.replace("{name}", payment.guest_name || t.someoneAtTable);
}

function fullyPaid(bill: TableBill): boolean {
  const ordered = bill.rounds.some((round) => round.status !== "CANCELLED");
  return ordered && toCents(bill.remaining) <= 0 && toCents(bill.held) <= 0;
}

/** What the guest sees once the table visit closed: thanks, the receipt, and a rating. */
export function VisitEnded() {
  const { t, locale } = useGuestCopy();
  const brandName = useBrandName();
  const bill = useTableBill();

  if (bill.isPending && !bill.isError) return <GuestSkeleton label={t.loading} />;
  const data = bill.data;
  const paid = data ? fullyPaid(data) : false;
  const place = brandName || t.restaurant;

  return (
    <GuestReveal className="grid gap-5 pb-8 pt-4">
      <div data-guest-reveal className="grid justify-items-center gap-3 text-center">
        <span className="guest-join-icon">
          <CircleCheck className="size-7" aria-hidden />
        </span>
        <h1 className="guest-sheet-title">{paid || !data ? t.thanksTitle : t.visitClosedTitle}</h1>
        <p className="guest-body text-[15px]">
          {paid || !data ? t.thanksBody.replace("{place}", place) : t.visitClosedBody}
        </p>
      </div>

      {data && paid ? <RateVisit /> : null}
      {data ? <Receipt bill={data} locale={locale} /> : null}

      <button data-guest-reveal type="button" className={`${guestSecondaryButton} w-full`} onClick={startOver}>
        {t.startNewOrder}
      </button>
    </GuestReveal>
  );
}

function Receipt({ bill, locale }: { bill: TableBill; locale: "en" | "ar" }) {
  const { t } = useGuestCopy();
  const lines = bill.rounds.filter((round) => round.status !== "CANCELLED").flatMap((round) => round.lines);
  if (lines.length === 0) return null;
  const money = (amount: string) => <Money amount={amount} currency={bill.currency} locale={locale} />;
  const extra: [string, string][] = [
    [t.discount, toCents(bill.discount_total) > 0 ? `-${bill.discount_total}` : ""],
    [t.serviceFee, toCents(bill.service_fee_total) > 0 ? bill.service_fee_total : ""],
    [t.tax, toCents(bill.tax_total) > 0 ? bill.tax_total : ""],
  ];
  return (
    <section data-guest-reveal className="guest-list" aria-label={t.receipt}>
      <p className="pt-4 pb-1 text-[15px] font-semibold">{t.receipt}</p>
      {lines.map((line, index) => (
        <div key={index} className="guest-row" style={{ alignItems: "flex-start" }}>
          <div className="guest-row-text">
            <p className="guest-row-name">
              <span className="text-[var(--guest-quiet)]" dir="ltr">
                {line.quantity}×
              </span>{" "}
              <bdi>{line.name}</bdi>
            </p>
            {line.modifiers.length ? <p className="guest-row-desc">{line.modifiers.join(" · ")}</p> : null}
          </div>
          <span className="guest-price shrink-0 text-[14px]" dir="ltr">
            {money(line.subtotal)}
          </span>
        </div>
      ))}
      <div className="guest-row" style={{ alignItems: "baseline" }}>
        <p className="guest-body flex-1">{t.subtotal}</p>
        <span className="guest-price text-[14px]" dir="ltr">
          {money(bill.subtotal)}
        </span>
      </div>
      {extra
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <div key={label} className="guest-row" style={{ alignItems: "baseline" }}>
            <p className="guest-body flex-1">{label}</p>
            <span className="guest-price text-[14px]" dir="ltr">
              {value.startsWith("-") ? <>−{money(value.slice(1))}</> : money(value)}
            </span>
          </div>
        ))}
      <div className="guest-row" style={{ alignItems: "baseline" }}>
        <p className="flex-1 text-[15px] font-semibold">{t.total}</p>
        <span className="guest-price text-[17px]" dir="ltr">
          {money(bill.total)}
        </span>
      </div>
      {bill.payments.length ? (
        <>
          <p className="pt-4 pb-1 text-[15px] font-semibold">{t.payments}</p>
          {bill.payments.map((payment) => (
            <div key={payment.id} className="guest-row" style={{ alignItems: "baseline" }}>
              <p className="guest-body flex-1">
                <bdi>{payerLabel(payment, t)}</bdi> · {methodLabel(payment.method, t)}
              </p>
              <span className="guest-price text-[14px]" dir="ltr">
                {money(payment.amount)}
              </span>
            </div>
          ))}
        </>
      ) : null}
    </section>
  );
}

function RateVisit() {
  const { t } = useGuestCopy();
  const guestName = useGuest((state) => state.guestName);
  const mine = useQuery({ queryKey: ["guest-review"], queryFn: () => fetchMyReview(t.oops), retry: false });
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () =>
      submitReview(
        {
          rating,
          ...(comment.trim() ? { comment: comment.trim() } : {}),
          ...(guestName.trim() ? { guest_name: guestName.trim() } : {}),
        },
        t.oops,
      ),
    onMutate: () => setError(null),
    onSuccess: () => {
      setEditing(false);
      void mine.refetch();
    },
    onError: (failure: Error) => setError(failure.message),
  });

  if (mine.isPending) return null;
  const saved = mine.data;
  if (saved && !editing) {
    return (
      <section data-guest-reveal className="guest-pay-card text-center" role="status">
        <Stars value={saved.rating} />
        <p className="guest-body">{t.rateThanks}</p>
        <button
          type="button"
          className="mx-auto min-h-11 px-3 text-sm font-semibold text-[var(--guest-brand-text)]"
          onClick={() => {
            setRating(saved.rating);
            setComment(saved.comment ?? "");
            setEditing(true);
          }}
        >
          {t.rateEdit}
        </button>
      </section>
    );
  }

  return (
    <section data-guest-reveal className="guest-pay-card">
      <p className="text-center text-[15px] font-semibold">{t.rateTitle}</p>
      <Stars value={rating} onChange={(value) => setRating(value)} />
      {rating > 0 ? (
        <>
          <label className="grid gap-1.5 guest-title">
            <span className="guest-caption font-normal">{t.rateComment}</span>
            <textarea
              className="guest-note-field min-h-20"
              maxLength={1000}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </label>
          <button type="button" className={`${guestPrimaryButton} w-full`} disabled={send.isPending} onClick={() => send.mutate()}>
            {send.isPending ? t.sending : t.rateSend}
          </button>
        </>
      ) : null}
      {error ? (
        <p role="alert" className="guest-alert guest-alert-error text-sm">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function Stars({ value, onChange }: { value: number; onChange?: (value: number) => void }) {
  const { t } = useGuestCopy();
  const readOnly = !onChange;
  return (
    <div
      className="flex justify-center gap-1.5"
      role={readOnly ? "img" : "radiogroup"}
      aria-label={readOnly ? t.rateStar.replace("{n}", String(value)) : t.rateTitle}
      dir="ltr"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const on = star <= value;
        const icon = (
          <Star
            className="size-8"
            strokeWidth={1.6}
            style={{ color: on ? "var(--guest-amber)" : "var(--guest-faint)", fill: on ? "var(--guest-amber)" : "none" }}
            aria-hidden
          />
        );
        if (readOnly) return <span key={star}>{icon}</span>;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={t.rateStar.replace("{n}", String(star))}
            className="grid size-11 place-items-center rounded-full guest-motion"
            onClick={() => onChange(star)}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}
