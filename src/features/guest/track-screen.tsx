"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BellRing, CircleCheck, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { Money } from "@/components/ops/money";
import { guestServiceStatus, guestServiceType, guestStatus } from "@/features/guest/copy";
import { GuestReveal, OrderWaitingScene } from "@/features/guest/guest-motion";
import { GuestSkeleton } from "@/features/guest/ordering-status";
import { BILL_QUERY_KEY, PayBillSheet, useTableBill } from "@/features/guest/pay-bill-sheet";
import { useOrderReadyAlert } from "@/features/guest/ready-alert";
import { fetchActiveServiceRequests } from "@/features/guest/service-request";
import { WaiterSheet } from "@/features/guest/service-sheets";
import { isGuestSessionGone, markVisitEnded, resumeIfSessionGone } from "@/features/guest/session";
import {
  GuestQueryError,
  PresenceNote,
  guestPrimaryButton,
  guestSecondaryButton,
  useGuestCopy,
} from "@/features/guest/shell";
import { VisitEnded, methodLabel, payerLabel } from "@/features/guest/visit-ended";
import type { BillRound, TableBill } from "@/features/guest/visit-api";
import { usePageVisible } from "@/hooks/use-page-visible";
import { asApiError } from "@/lib/api/error";
import { guestApi } from "@/lib/api/guest";
import type { components } from "@/lib/api/schema";
import { toCents } from "@/lib/guest/bill-split";
import { useGuest } from "@/stores/guest";

type OrderStatus = components["schemas"]["OrderStatus"];

const STEPS: readonly OrderStatus[] = ["SUBMITTED", "PREPARING", "READY", "DELIVERED"];
const GUEST_CANCELLABLE: ReadonlySet<OrderStatus> = new Set(["DRAFT", "PENDING_STAFF_CONFIRMATION"]);
const IN_KITCHEN: ReadonlySet<OrderStatus> = new Set(["SUBMITTED", "PREPARING", "READY"]);

/** Request status colours: amber while waiting, brand once seen, sage when done. */
const REQUEST_TONE: Record<string, string> = {
  PENDING: "var(--guest-amber)",
  ACKNOWLEDGED: "var(--guest-orange)",
  COMPLETED: "var(--guest-sage)",
  DISMISSED: "var(--guest-faint)",
};

function stepIndex(status: OrderStatus): number {
  if (status === "SERVED") return STEPS.indexOf("DELIVERED");
  if (status === "PAID" || status === "CLOSED") return STEPS.length;
  return STEPS.indexOf(status);
}

function statusTone(value: OrderStatus): string {
  if (value === "PREPARING") return "var(--guest-amber)";
  if (value === "CANCELLED") return "var(--guest-faint)";
  if (value === "READY" || value === "SERVED" || value === "DELIVERED" || value === "PAID" || value === "CLOSED") {
    return "var(--guest-sage)";
  }
  return "var(--guest-orange)";
}

function shortStatus(status: OrderStatus, t: ReturnType<typeof useGuestCopy>["t"]): string {
  if (status === "SUBMITTED") return t.stepSent;
  if (status === "PREPARING") return t.stepCooking;
  if (status === "READY") return t.stepReady;
  if (status === "DELIVERED" || status === "SERVED") return t.stepServed;
  if (status === "PAID" || status === "CLOSED") return t.paid;
  if (status === "CANCELLED") return t.rejectedShort;
  return t.waitingShort;
}

function clock(iso: string, locale: "en" | "ar"): string {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { hour: "numeric", minute: "2-digit" }).format(
      new Date(iso),
    );
  } catch {
    return "";
  }
}

/** The round the guest is waiting on: the newest one still with the kitchen or waiting for staff. */
function liveRound(rounds: BillRound[]): BillRound | null {
  for (let index = rounds.length - 1; index >= 0; index -= 1) {
    const round = rounds[index];
    if (IN_KITCHEN.has(round.status) || GUEST_CANCELLABLE.has(round.status)) return round;
  }
  return null;
}

export function TrackScreen() {
  const { t } = useGuestCopy();
  const session = useGuest((state) => state.session);
  const endedVisit = useGuest((state) => state.endedVisit);
  if (!session && endedVisit) return <VisitEnded />;
  if (!session) return null;
  return <TableScreen key={session.sessionId} fallbackTitle={t.yourTable} />;
}

function TableScreen({ fallbackTitle }: { fallbackTitle: string }) {
  const { t, locale } = useGuestCopy();
  const session = useGuest((state) => state.session);
  const queryClient = useQueryClient();
  const visible = usePageVisible();
  const bill = useTableBill({ refetchInterval: visible ? 7000 : 15_000 });
  const [justSent, setJustSent] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("sent") === "1",
  );
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [waiterOpen, setWaiterOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const requests = useQuery({
    queryKey: ["guest-requests"],
    refetchInterval: visible ? 10_000 : false,
    queryFn: () => fetchActiveServiceRequests(),
    retry: false,
  });

  // The visit closed (paid and served, staff, idle): switch to the thank-you screen.
  useEffect(() => {
    if (bill.data && bill.data.visit_open === false) markVisitEnded();
  }, [bill.data]);
  useEffect(() => {
    if (bill.error && isGuestSessionGone(bill.error) && !bill.data) markVisitEnded();
  }, [bill.error, bill.data]);

  useEffect(() => {
    if (!justSent) return;
    const timer = window.setTimeout(() => setJustSent(false), 6000);
    window.history.replaceState(null, "", "/order/track");
    return () => window.clearTimeout(timer);
  }, [justSent]);

  const live = bill.data ? liveRound(bill.data.rounds) : null;
  useOrderReadyAlert(live?.status, guestStatus[locale].READY);

  const cancel = useMutation({
    mutationFn: async (orderId: string) => {
      const body: components["schemas"]["Body_cancel_order_api_v1_orders__order_id__cancel_post"] = {
        reason: "Guest cancelled",
      };
      const result = await guestApi.POST("/api/v1/orders/{order_id}/cancel", {
        params: { path: { order_id: orderId } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.oops, locale);
    },
    onSuccess: () => {
      setConfirmCancel(null);
      toast.success(t.cancelled);
      void queryClient.invalidateQueries({ queryKey: [BILL_QUERY_KEY] });
    },
    onError: (error: Error) => {
      setConfirmCancel(null);
      void resumeIfSessionGone(error).then((gone) => {
        if (!gone) toast.error(error.message);
      });
    },
  });

  const heldError = useRef<unknown>(null);
  if (bill.error) heldError.current = bill.error;
  const showError = bill.isError || (bill.isFetched && bill.isPending && !bill.data && heldError.current);

  if (!session) return null;
  if (bill.isPending && !bill.isFetched) return <GuestSkeleton label={t.loading} />;
  if (showError && !bill.data) {
    return <GuestQueryError error={bill.error ?? heldError.current} onRetry={() => void bill.refetch()} />;
  }
  const data = bill.data;
  if (!data) return null;

  const rounds = data.rounds;
  const tableLabel = session.tableNumber ? `${t.table} ${session.tableNumber}` : null;

  if (rounds.length === 0) {
    return (
      <div className="grid justify-items-center gap-4 py-16 text-center">
        <span className="guest-join-icon">
          <ReceiptText className="size-7" aria-hidden />
        </span>
        <div className="grid gap-1.5">
          <h1 className="guest-sheet-title">{fallbackTitle}</h1>
          <p className="guest-body text-[15px]">{t.noOrder}</p>
        </div>
        <Link href="/order" className={`${guestPrimaryButton} w-full`}>
          {t.backMenu}
        </Link>
      </div>
    );
  }

  const openRequests = (requests.data ?? []).filter(
    (request) => request.status === "PENDING" || request.status === "ACKNOWLEDGED",
  );

  return (
    <GuestReveal className="grid gap-4 pb-8">
      <div data-guest-reveal className="flex items-start gap-2.5 pt-1">
        <Link href="/order" className="guest-hero-btn mt-0.5 shrink-0" aria-label={t.backMenu}>
          <ArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden />
        </Link>
        <div className="min-w-0">
          <h1 className="guest-sheet-title">{t.yourTable}</h1>
          {tableLabel ? <p className="guest-body">{tableLabel}</p> : null}
        </div>
      </div>

      {justSent ? (
        <p role="status" data-guest-reveal className="guest-alert guest-alert-ok flex items-center gap-2 text-sm font-semibold">
          <CircleCheck className="size-4" aria-hidden />
          {t.sentBanner}
        </p>
      ) : null}

      <LiveStatus round={live} rounds={rounds} />

      <BillCard bill={data} onPay={() => setPayOpen(true)} />

      <section data-guest-reveal className="guest-list" aria-label={t.roundsTitle}>
        <p className="pt-4 pb-1 text-[15px] font-semibold">{t.roundsTitle}</p>
        {[...rounds].reverse().map((round) => (
          <RoundBlock
            key={round.order_id}
            round={round}
            currency={data.currency}
            showNumber={rounds.length > 1}
            onCancel={GUEST_CANCELLABLE.has(round.status) ? () => setConfirmCancel(round.order_id) : undefined}
          />
        ))}
      </section>

      <Link data-guest-reveal href="/order" className={`${guestSecondaryButton} w-full`}>
        {t.orderMore}
      </Link>

      {openRequests.length > 0 ? (
        <section data-guest-reveal className="guest-list" aria-label={t.yourRequests}>
          <p className="pt-4 pb-1 text-[15px] font-semibold">{t.yourRequests}</p>
          {openRequests.map((request) => (
            <div key={request.id} className="guest-row" style={{ alignItems: "center" }}>
              <p className="guest-row-name flex-1">{guestServiceType[locale][request.request_type]}</p>
              <span
                className="guest-status-pill"
                style={{ ["--tone" as string]: REQUEST_TONE[request.status] ?? "var(--guest-faint)" }}
              >
                <i aria-hidden />
                {guestServiceStatus[locale][request.status]}
              </span>
            </div>
          ))}
        </section>
      ) : null}

      <section data-guest-reveal className="grid gap-2">
        <p className="px-1 text-[13px] font-semibold text-[var(--guest-quiet)]">{t.needSomething}</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="guest-help-tile guest-motion" onClick={() => setWaiterOpen(true)}>
            <BellRing className="size-5" aria-hidden />
            {t.callWaiterShort}
          </button>
          <button type="button" className="guest-help-tile guest-motion" onClick={() => setPayOpen(true)}>
            <ReceiptText className="size-5" aria-hidden />
            {t.askBillShort}
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmCancel !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmCancel(null);
        }}
        title={t.cancelTitle}
        description={t.cancelBody}
        confirmLabel={t.cancelOrder}
        cancelLabel={t.keepOrder}
        pendingLabel={t.sending}
        destructive
        pending={cancel.isPending}
        onConfirm={() => {
          if (confirmCancel) cancel.mutate(confirmCancel);
        }}
      />
      <WaiterSheet open={waiterOpen} onOpenChange={setWaiterOpen} />
      <PayBillSheet open={payOpen} onOpenChange={setPayOpen} />
    </GuestReveal>
  );
}

function LiveStatus({ round, rounds }: { round: BillRound | null; rounds: BillRound[] }) {
  const { t, locale } = useGuestCopy();
  if (!round) {
    const newest = rounds[rounds.length - 1];
    if (newest?.status === "CANCELLED" && rounds.every((item) => item.status === "CANCELLED")) {
      return (
        <section data-guest-reveal className="grid gap-1.5 pt-2">
          <p className="guest-sheet-title">{t.orderRejected}</p>
          {newest.cancellation_reason ? <p className="guest-body">{newest.cancellation_reason}</p> : null}
        </section>
      );
    }
    return (
      <section data-guest-reveal className="pt-2">
        <p className="guest-sheet-title">{t.enjoyMeal}</p>
      </section>
    );
  }
  const status = round.status;
  const pending = GUEST_CANCELLABLE.has(status);
  const waitingMode = status === "READY" ? "ready" : status === "PREPARING" || status === "SUBMITTED" ? "preparing" : null;
  const current = stepIndex(status);
  return (
    <section data-guest-reveal className="guest-list grid gap-1 pb-4">
      {waitingMode ? (
        <OrderWaitingScene mode={waitingMode} title={guestStatus[locale][status]} />
      ) : (
        <p className="guest-sheet-title pt-4">{guestStatus[locale][status]}</p>
      )}
      {!pending ? (
        <ol className="guest-progress" aria-label={t.track}>
          {[t.stepSent, t.stepCooking, t.stepReady, t.stepServed].map((label, index) => (
            <li
              key={label}
              data-state={index < current ? "done" : index === current ? "now" : "next"}
              aria-current={index === current ? "step" : undefined}
              style={{ ["--step" as string]: statusTone(STEPS[index] ?? "SUBMITTED") }}
            >
              <span className="guest-progress-bar" aria-hidden />
              <span className="guest-progress-label">{label}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="grid gap-2 pt-2">
          <PresenceNote />
          <p className="guest-body">{t.payAfterConfirm}</p>
        </div>
      )}
    </section>
  );
}

function BillCard({ bill, onPay }: { bill: TableBill; onPay: () => void }) {
  const { t, locale } = useGuestCopy();
  if (toCents(bill.total) <= 0) return null;
  const money = (amount: string) => <Money amount={amount} currency={bill.currency} locale={locale} />;
  const left = toCents(bill.remaining);
  const held = toCents(bill.held);
  return (
    <section data-guest-reveal className="guest-pay-card" aria-label={t.tableBill}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-semibold">{left > 0 ? t.leftToPay : t.tableBill}</p>
        <span className="guest-price text-[22px]" dir="ltr">
          {money(left > 0 ? bill.remaining : bill.total)}
        </span>
      </div>
      <dl className="grid gap-1 text-[14px]">
        <div className="flex justify-between gap-3">
          <dt className="guest-body">{t.total}</dt>
          <dd className="guest-price" dir="ltr">
            {money(bill.total)}
          </dd>
        </div>
        {toCents(bill.paid) > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="guest-body">{t.billPaid}</dt>
            <dd className="guest-price" dir="ltr">
              {money(bill.paid)}
            </dd>
          </div>
        ) : null}
        {held > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="guest-body">{t.billBeingPaid}</dt>
            <dd className="guest-price" dir="ltr">
              {money(bill.held)}
            </dd>
          </div>
        ) : null}
      </dl>
      {bill.payments.length ? (
        <ul className="grid gap-1 border-t border-[var(--guest-line)] pt-2 text-[13.5px]">
          {bill.payments.map((payment) => (
            <li key={payment.id} className="flex items-baseline justify-between gap-3">
              <span className="guest-body min-w-0">
                <bdi>{payerLabel(payment, t)}</bdi> · {methodLabel(payment.method, t)}
              </span>
              <span className="guest-price shrink-0" dir="ltr">
                {money(payment.amount)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {left > 0 ? (
        <button type="button" className={`${guestPrimaryButton} mt-1 w-full`} onClick={onPay}>
          {t.payBill}
        </button>
      ) : (
        <p role="status" className="guest-alert guest-alert-ok flex items-center gap-2 text-sm font-semibold">
          <CircleCheck className="size-4" aria-hidden />
          {held > 0 ? t.waitingStaffConfirm : t.allPaidTitle}
        </p>
      )}
    </section>
  );
}

function RoundBlock({
  round,
  currency,
  showNumber,
  onCancel,
}: {
  round: BillRound;
  currency: string;
  showNumber: boolean;
  onCancel?: () => void;
}) {
  const { t, locale } = useGuestCopy();
  const cancelled = round.status === "CANCELLED";
  return (
    <div className="grid gap-0.5 pb-2" data-cancelled={cancelled ? "true" : undefined}>
      <div className="flex items-center justify-between gap-3 pt-3">
        <p className="text-[13px] font-semibold text-[var(--guest-quiet)]">
          {showNumber ? `${t.roundN.replace("{n}", String(round.number))} · ` : ""}
          <span dir="ltr">{clock(round.created_at, locale)}</span>
        </p>
        <span className="guest-status-pill" style={{ ["--tone" as string]: statusTone(round.status) }}>
          <i aria-hidden />
          {shortStatus(round.status, t)}
        </span>
      </div>
      {round.lines.map((line, index) => (
        <div
          key={index}
          className="guest-row"
          style={{ alignItems: "flex-start", opacity: cancelled ? 0.55 : undefined }}
        >
          <div className="guest-row-text">
            <p className="guest-row-name">
              <span className="text-[var(--guest-quiet)]" dir="ltr">
                {line.quantity}×
              </span>{" "}
              <bdi>{line.name}</bdi>
            </p>
            {line.modifiers.length ? <p className="guest-row-desc">{line.modifiers.join(" · ")}</p> : null}
            {line.notes ? <p className="guest-row-desc italic">“{line.notes}”</p> : null}
            {line.is_mine || line.guest_name ? (
              <p className="guest-caption" dir="auto">
                {line.is_mine ? t.you : line.guest_name}
              </p>
            ) : null}
          </div>
          <span className="guest-price shrink-0 text-[14px]" dir="ltr">
            <Money amount={line.subtotal} currency={currency} locale={locale} />
          </span>
        </div>
      ))}
      {cancelled && round.cancellation_reason ? <p className="guest-row-desc">{round.cancellation_reason}</p> : null}
      {onCancel ? (
        <button
          type="button"
          className="justify-self-start min-h-11 text-sm font-semibold text-[var(--guest-quiet)] underline-offset-4 hover:underline"
          onClick={onCancel}
        >
          {t.cancelOrder}
        </button>
      ) : null}
    </div>
  );
}
