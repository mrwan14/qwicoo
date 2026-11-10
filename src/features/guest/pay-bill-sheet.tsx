"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CircleCheck, CreditCard, Minus, Plus, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Money } from "@/components/ops/money";
import { BottomSheet } from "@/features/guest/bottom-sheet";
import { markVisitEnded } from "@/features/guest/session";
import { guestPrimaryButton, guestSecondaryButton, useGuestCopy } from "@/features/guest/shell";
import {
  fetchTableBill,
  isVisitEndedError,
  payTableBill,
  type BillPayMethod,
  type TableBill,
} from "@/features/guest/visit-api";
import { ApiError } from "@/lib/api/error";
import {
  customAmountValid,
  defaultSplit,
  equalShare,
  splitAmount,
  toCents,
  type SplitMode,
} from "@/lib/guest/bill-split";
import { formatMoney } from "@/lib/format/money";
import { normalizePaymobPhone } from "@/lib/paymob/checkout";
import { useGuest } from "@/stores/guest";

export const BILL_QUERY_KEY = "guest-bill";

/** The live table bill, shared by the table screen and the pay sheet. */
export function useTableBill(options: { enabled?: boolean; refetchInterval?: number | false } = {}) {
  const { t } = useGuestCopy();
  const session = useGuest((state) => state.session);
  const sessionId = session?.sessionId ?? useGuest.getState().endedVisit?.sessionId ?? null;
  return useQuery({
    queryKey: [BILL_QUERY_KEY, sessionId],
    enabled: (options.enabled ?? true) && Boolean(sessionId),
    refetchInterval: options.refetchInterval ?? false,
    refetchIntervalInBackground: true,
    queryFn: () => fetchTableBill(t.oops),
  });
}

const SPLITS: readonly SplitMode[] = ["full", "mine", "equal", "custom"];

export function PayBillSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, locale } = useGuestCopy();
  const queryClient = useQueryClient();
  const guestName = useGuest((state) => state.guestName);
  const hasVisit = useGuest((state) => Boolean(state.session));
  const bill = useTableBill({ enabled: open });
  const data = bill.data;
  const [mode, setMode] = useState<SplitMode>("full");
  const [people, setPeople] = useState(2);
  const [custom, setCustom] = useState("");
  const [method, setMethod] = useState<BillPayMethod>("CASH");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState<string | null>(null);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const primed = useRef(false);

  // Fresh choices each time the sheet opens, starting from what this guest most likely wants.
  useEffect(() => {
    if (!open) {
      primed.current = false;
      return;
    }
    setError(null);
    setRequested(null);
    void bill.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !data || primed.current) return;
    primed.current = true;
    setMode(defaultSplit(data.my_items_due, data.guests_count));
    setPeople(Math.max(2, data.guests_count));
    setCustom("");
    setMethod("CASH");
  }, [open, data]);

  const currency = data?.currency ?? "EGP";
  const money = (amount: string) => formatMoney(amount, currency, locale);
  const amount = data
    ? splitAmount({
        mode,
        total: data.total,
        remaining: data.remaining,
        myItemsDue: data.my_items_due,
        people,
        custom,
      })
    : "0.00";
  const customOk = mode !== "custom" || customAmountValid(custom, data?.remaining ?? "0");
  const nothingLeft = !data || toCents(data.remaining) <= 0;

  const pay = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error(t.oops);
      if (!customOk || toCents(amount) <= 0) throw new Error(t.amountInvalid);
      const normalized = method === "PAYMOB" ? normalizePaymobPhone(phone) : null;
      if (method === "PAYMOB" && !normalized) throw new Error(t.phoneInvalid);
      const fingerprint = `${method}|${amount}|${normalized ?? ""}`;
      if (!attempt.current || attempt.current.fingerprint !== fingerprint) {
        attempt.current = { fingerprint, key: crypto.randomUUID() };
      }
      return payTableBill(
        {
          amount,
          method,
          split_mode: mode,
          ...(guestName.trim() ? { guest_name: guestName.trim() } : {}),
          ...(normalized ? { phone: normalized } : {}),
        },
        attempt.current.key,
        t.oops,
      );
    },
    onMutate: () => setError(null),
    onSuccess: (result) => {
      attempt.current = null;
      if (result.checkout_url) {
        window.location.assign(result.checkout_url);
        return;
      }
      setRequested(result.amount);
      void queryClient.invalidateQueries({ queryKey: [BILL_QUERY_KEY] });
    },
    onError: (failure: Error) => {
      if (isVisitEndedError(failure)) {
        markVisitEnded();
        onOpenChange(false);
        return;
      }
      if (failure instanceof ApiError && failure.code === "PAYMENT_AMOUNT_INVALID") {
        attempt.current = null;
        setError(t.billChanged);
        void bill.refetch();
        return;
      }
      if (failure instanceof ApiError && failure.code === "BILL_ALREADY_COVERED") {
        setError(t.billCovered);
        void bill.refetch();
        return;
      }
      setError(failure.message);
    },
  });

  const splitLabel: Record<SplitMode, string> = {
    full: t.splitFull,
    mine: t.splitMine,
    equal: t.splitEqual,
    custom: t.splitCustom,
  };

  function splitHint(option: SplitMode, bill: TableBill): string | null {
    if (option === "full") return money(bill.remaining);
    if (option === "mine") return toCents(bill.my_items_due) > 0 ? money(bill.my_items_due) : null;
    if (option === "equal") return t.splitPerPerson.replace("{amount}", money(equalShare(bill.total, bill.remaining, people)));
    return null;
  }

  const methods: { value: BillPayMethod; label: string; hint: string; icon: typeof Banknote }[] = [
    { value: "CASH", label: t.methodCash, hint: t.methodCashHint, icon: Banknote },
    { value: "CARD_TERMINAL", label: t.methodTerminal, hint: t.methodTerminalHint, icon: CreditCard },
    ...(data?.card_available
      ? [{ value: "PAYMOB" as const, label: t.methodOnline, hint: t.methodOnlineHint, icon: Smartphone }]
      : []),
  ];

  const footer = requested ? (
    <button type="button" className={`${guestPrimaryButton} w-full`} onClick={() => onOpenChange(false)}>
      {t.done}
    </button>
  ) : nothingLeft ? (
    <button type="button" className={`${guestSecondaryButton} w-full`} onClick={() => onOpenChange(false)}>
      {t.done}
    </button>
  ) : (
    <button
      type="button"
      className={`${guestPrimaryButton} w-full`}
      disabled={pay.isPending || !data || !customOk || toCents(amount) <= 0}
      onClick={() => pay.mutate()}
    >
      {pay.isPending
        ? t.paying
        : (method === "PAYMOB" ? t.payAmountButton : t.requestAmountButton).replace("{amount}", money(amount))}
    </button>
  );

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t.tableBill} footer={footer}>
      {!hasVisit ? (
        <p className="text-sm text-[var(--guest-quiet)]">{t.noOrder}</p>
      ) : !data ? (
        <p className="text-sm text-[var(--guest-quiet)]">{bill.isError ? t.oops : t.loading}</p>
      ) : requested ? (
        <div className="grid justify-items-center gap-3 py-4 text-center" role="status">
          <span className="guest-join-icon">
            <CircleCheck className="size-7" aria-hidden />
          </span>
          <h2 className="guest-sheet-title">{t.payRequestedTitle}</h2>
          <p className="guest-body text-[15px]">{t.payRequestedBody.replace("{amount}", money(requested))}</p>
        </div>
      ) : nothingLeft ? (
        <p role="status" className="guest-alert guest-alert-ok text-sm">
          {toCents(data.held) > 0 ? t.waitingStaffConfirm : t.allPaidTitle}
        </p>
      ) : (
        <div className="grid gap-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="guest-body">{t.leftToPay}</p>
            <span className="guest-price text-[24px]" dir="ltr">
              <Money amount={data.remaining} currency={currency} locale={locale} />
            </span>
          </div>

          <fieldset className="guest-choice">
            <legend className="guest-title pb-2">{t.payWhat}</legend>
            <div className="grid grid-cols-2 gap-2">
              {SPLITS.map((option) => {
                const hint = splitHint(option, data);
                const disabled = option === "mine" && toCents(data.my_items_due) <= 0;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={mode === option}
                    data-selected={mode === option ? "true" : "false"}
                    disabled={disabled}
                    className="guest-option-tile guest-motion grid gap-0.5 text-start disabled:opacity-45"
                    onClick={() => {
                      setMode(option);
                      setError(null);
                    }}
                  >
                    <span className="text-[14.5px] font-semibold">{splitLabel[option]}</span>
                    {hint ? (
                      <span className="guest-caption" dir="auto">
                        {hint}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {mode === "equal" ? (
              <div className="mt-1 flex items-center justify-between gap-3 rounded-2xl bg-[var(--guest-sunken)] px-3 py-2">
                <button
                  type="button"
                  className="guest-hero-btn"
                  aria-label={t.fewerPeople}
                  disabled={people <= 2}
                  onClick={() => setPeople((count) => Math.max(2, count - 1))}
                >
                  <Minus className="size-4" aria-hidden />
                </button>
                <span className="text-[15px] font-semibold" aria-live="polite">
                  {t.splitPeople.replace("{n}", String(people))}
                </span>
                <button
                  type="button"
                  className="guest-hero-btn"
                  aria-label={t.morePeople}
                  disabled={people >= 30}
                  onClick={() => setPeople((count) => Math.min(30, count + 1))}
                >
                  <Plus className="size-4" aria-hidden />
                </button>
              </div>
            ) : null}
            {mode === "custom" ? (
              <label className="mt-1 grid gap-1.5 guest-title">
                {t.payAmount}
                <input
                  className="guest-field"
                  inputMode="decimal"
                  dir="ltr"
                  autoFocus
                  value={custom}
                  placeholder={data.remaining}
                  onChange={(event) => {
                    setCustom(event.target.value);
                    setError(null);
                  }}
                />
              </label>
            ) : null}
          </fieldset>

          <fieldset className="guest-choice">
            <legend className="guest-title pb-2">{t.payHow}</legend>
            <div className="grid gap-2">
              {methods.map(({ value, label, hint, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={method === value}
                  data-selected={method === value ? "true" : "false"}
                  className="guest-option-tile guest-motion flex items-center gap-3 text-start"
                  onClick={() => {
                    setMethod(value);
                    setError(null);
                  }}
                >
                  <Icon className="size-5 shrink-0 text-[var(--guest-brand-text)]" aria-hidden />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="text-[14.5px] font-semibold">{label}</span>
                    <span className="guest-caption">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
            {method === "PAYMOB" ? (
              <label className="mt-1 grid gap-1.5 guest-title">
                {t.payPhone}
                <input
                  className="guest-field"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    setError(null);
                  }}
                />
                <span className="guest-caption font-normal">{t.payPhoneHint}</span>
              </label>
            ) : null}
          </fieldset>

          {error ? (
            <p role="alert" className="guest-alert guest-alert-error text-sm">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </BottomSheet>
  );
}
