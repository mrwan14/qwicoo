"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BottomSheet } from "@/features/guest/bottom-sheet";
import { guestServiceType } from "@/features/guest/copy";
import { PayOnlineSheet } from "@/features/guest/pay-online-sheet";
import { paymobOffered } from "@/lib/paymob/checkout";
import { useGuest } from "@/stores/guest";
import {
  createGuestServiceRequest,
  fetchActiveServiceRequests,
  hasOpenRequest,
  waiterReasonTypes,
  type ServiceRequestType,
} from "@/features/guest/service-request";
import { guestPrimaryButton, guestSecondaryButton, useGuestCopy } from "@/features/guest/shell";

export function WaiterSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, locale } = useGuestCopy();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<ServiceRequestType>("WAITER_CALL");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const active = useQuery({
    queryKey: ["guest-requests"],
    enabled: open,
    queryFn: fetchActiveServiceRequests,
  });

  useEffect(() => {
    if (open) {
      setSent(false);
      setNote("");
      setReason("WAITER_CALL");
    }
  }, [open]);

  const alreadyOpen = hasOpenRequest(active.data ?? [], reason);

  async function submit() {
    if (alreadyOpen) {
      toast.message(t.requestPending);
      return;
    }
    setPending(true);
    try {
      await createGuestServiceRequest(reason, note, locale, t.oops);
      setSent(true);
      toast.success(t.requestSent);
      void queryClient.invalidateQueries({ queryKey: ["guest-requests"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.oops);
    } finally {
      setPending(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t.callWaiterTitle}
      footer={
        sent || alreadyOpen ? (
          <button type="button" className={guestSecondaryButton} disabled>
            {sent ? t.requestSent : t.requestPending}
          </button>
        ) : (
          <button type="button" className={guestPrimaryButton} disabled={pending} onClick={() => void submit()}>
            {pending ? t.paying : t.sendRequest}
          </button>
        )
      }
    >
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={t.callWaiterTitle}>
        {waiterReasonTypes.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={reason === item}
            data-selected={reason === item ? "true" : "false"}
            className="guest-option-tile guest-motion text-sm font-semibold"
            onClick={() => setReason(item)}
            disabled={sent}
          >
            {guestServiceType[locale][item]}
          </button>
        ))}
      </div>
      <label className="mt-4 grid gap-1.5 guest-title">
        {t.serviceNote}
        <textarea
          className="min-h-20 w-full rounded-[var(--guest-radius-card)] border border-[var(--guest-line)] bg-white px-3 py-2.5 text-base font-normal shadow-[var(--guest-shadow-soft)] outline-none focus:border-[var(--guest-orange)]"
          value={note}
          disabled={sent}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
    </BottomSheet>
  );
}

export function BillSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, locale } = useGuestCopy();
  const session = useGuest((state) => state.session);
  const offered = paymobOffered(session);
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<"cash" | "card">("cash");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const active = useQuery({
    queryKey: ["guest-requests"],
    enabled: open,
    queryFn: fetchActiveServiceRequests,
  });

  useEffect(() => {
    if (open) {
      setSent(false);
      setMethod("cash");
    }
  }, [open]);

  const alreadyOpen = hasOpenRequest(active.data ?? [], "BILL_REQUEST");

  async function submit() {
    if (alreadyOpen) {
      toast.message(t.requestPending);
      return;
    }
    setPending(true);
    try {
      await createGuestServiceRequest(
        "BILL_REQUEST",
        method === "cash" ? t.billCash : t.billCard,
        locale,
        t.oops,
      );
      setSent(true);
      toast.success(t.requestSent);
      void queryClient.invalidateQueries({ queryKey: ["guest-requests"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.oops);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t.billTitle}
      footer={
        sent || alreadyOpen ? (
          <button type="button" className={guestSecondaryButton} disabled>
            {sent ? t.requestSent : t.requestPending}
          </button>
        ) : (
          <button type="button" className={guestPrimaryButton} disabled={pending} onClick={() => void submit()}>
            {pending ? t.paying : t.sendRequest}
          </button>
        )
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          data-selected={method === "cash" ? "true" : "false"}
          className="guest-option-tile guest-motion text-sm font-semibold"
          onClick={() => setMethod("cash")}
          disabled={sent}
        >
          {t.billCash}
        </button>
        <button
          type="button"
          data-selected={method === "card" ? "true" : "false"}
          className="guest-option-tile guest-motion text-sm font-semibold"
          onClick={() => setMethod("card")}
          disabled={sent}
        >
          {t.billCard}
        </button>
      </div>
      {offered && !sent && !alreadyOpen ? (
        <button
          type="button"
          className={`${guestSecondaryButton} mt-4`}
          onClick={() => {
            onOpenChange(false);
            setPayOpen(true);
          }}
        >
          {t.payOnlineCard}
        </button>
      ) : null}
    </BottomSheet>
    <PayOnlineSheet open={payOpen} onOpenChange={setPayOpen} />
    </>
  );
}
