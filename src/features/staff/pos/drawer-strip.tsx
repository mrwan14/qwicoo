"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { Banknote, Lock, LockOpen } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ops/kit/button";
import { Field, Input, Textarea } from "@/components/ops/kit/field";
import { formatAmount } from "@/components/ops/kit/money";
import { SidePanel } from "@/components/ops/kit/side-panel";
import { cairoTime } from "@/features/staff/home/numbers";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { drawerCopy } from "@/lib/i18n/staff/drawer";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

import { cleanAmount } from "./amount";
import { useDrawer } from "./drawer";

type Session = components["schemas"]["CashDrawerSessionResponse"];
type Copy = (typeof drawerCopy)["en"];

/** A small difference (coins, rounding) reads as matching; beyond it, the cashier sees over or short. */
const TOLERANCE = 10;

function OpenPanel({ open, onClose, t }: { open: boolean; onClose: () => void; t: Copy }) {
  const client = useQueryClient();
  const { locale } = useLocale();
  const [cash, setCash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async (amount: string) => {
      const result = await browserApi.POST("/api/v1/financials/drawer/open", { body: { opening_balance: amount } });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.openFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.opened);
      await client.invalidateQueries({ queryKey: ["drawer"] });
      setCash("");
      onClose();
    },
    onError: (failure: Error) => setError(failure.message),
  });
  const submit = () => {
    const amount = cleanAmount(cash || "0");
    if (!amount) return setError(t.needCount);
    setError(null);
    mutation.mutate(amount);
  };
  return (
    <SidePanel
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t.openTitle}
      description={t.openBody}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button disabled={mutation.isPending} onClick={submit}>
            {mutation.isPending ? t.opening : t.openDrawer}
          </Button>
        </div>
      }
    >
      <Field label={t.openingCash} error={error}>
        <Input
          inputMode="decimal"
          autoFocus
          dir="ltr"
          placeholder="0.00"
          value={cash}
          onChange={(event) => setCash(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && submit()}
          className="h-14 text-xl tabular-nums"
        />
      </Field>
    </SidePanel>
  );
}

/** Blind count: the cashier enters what they counted, and only sees the expected amount after closing. */
function ClosePanel({ open, onClose, t }: { open: boolean; onClose: () => void; t: Copy }) {
  const client = useQueryClient();
  const { locale } = useLocale();
  const [cash, setCash] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState<Session | null>(null);
  const mutation = useMutation({
    mutationFn: async (amount: string) => {
      const result = await browserApi.POST("/api/v1/financials/drawer/close", {
        body: { declared_cash_amount: amount, closing_notes: note.trim() || null },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.closeFailed, locale);
      return result.data;
    },
    onSuccess: (session) => {
      setClosed(session);
      void client.invalidateQueries({ queryKey: ["drawer"] });
    },
    onError: (failure: Error) => setError(failure.message),
  });
  const finish = () => {
    setCash("");
    setNote("");
    setClosed(null);
    setError(null);
    onClose();
  };
  const submit = () => {
    const amount = cleanAmount(cash);
    if (!amount) return setError(t.needCount);
    setError(null);
    mutation.mutate(amount);
  };
  const money = (value: string | null | undefined) => formatAmount(value ?? "0", null, locale);
  const variance = Number(closed?.cash_variance ?? 0);
  const off = Math.abs(variance) > TOLERANCE;

  return (
    <SidePanel
      open={open}
      onOpenChange={(next) => !next && (closed ? finish() : onClose())}
      title={closed ? t.doneTitle : t.closeTitle}
      description={closed ? t.doneHint : t.closeBody}
      footer={
        closed ? (
          <div className="flex justify-end">
            <Button onClick={finish}>{t.done}</Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button disabled={mutation.isPending} onClick={submit}>
              <Lock aria-hidden />
              {mutation.isPending ? t.closing : t.closeDrawer}
            </Button>
          </div>
        )
      }
    >
      {closed ? (
        <div className="grid gap-4">
          <dl className="grid divide-y divide-border rounded-staff border border-border text-sm">
            {[
              [t.doneCounted, money(closed.declared_cash_amount)],
              [t.doneExpected, money(closed.calculated_cash_amount)],
              [t.doneDifference, `${variance > 0 ? "+" : ""}${money(closed.cash_variance)}`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <dt className="text-ink-secondary">{label}</dt>
                <dd className="font-semibold text-ink tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p
            role="status"
            className={cn(
              "rounded-staff px-3.5 py-3 text-sm font-medium",
              off ? "border border-warning/40 bg-warning-bg text-ink" : "bg-success-bg text-ink",
            )}
          >
            {!off ? t.matches : fill(variance > 0 ? t.over : t.short, { amount: money(String(Math.abs(variance))) })}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          <Field label={t.counted} hint={t.countHint} error={error}>
            <Input
              inputMode="decimal"
              autoFocus
              dir="ltr"
              placeholder="0.00"
              value={cash}
              onChange={(event) => setCash(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && submit()}
              className="h-14 text-xl tabular-nums"
            />
          </Field>
          <Field label={t.note}>
            <Textarea rows={3} placeholder={t.notePlaceholder} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
        </div>
      )}
    </SidePanel>
  );
}

/**
 * The cash drawer at a glance in POS: open since when and with what float, with Close drawer;
 * or closed, with Open drawer. `?drawer=close` (from the clock-out reminder) opens the close panel.
 */
export function DrawerStrip({ online = true }: { online?: boolean }) {
  const t = useStaffSection(drawerCopy);
  const { locale } = useLocale();
  const drawer = useDrawer({ enabled: online });
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [panel, setPanel] = useState<"open" | "close" | null>(null);
  const asked = params.get("drawer");
  const session = drawer.data;

  useEffect(() => {
    if (asked !== "close" || !drawer.isSuccess) return;
    if (drawer.data) setPanel("close");
    const next = new URLSearchParams(params.toString());
    next.delete("drawer");
    router.replace(next.size ? `${pathname}?${next}` : pathname);
  }, [asked, drawer.isSuccess, drawer.data, params, pathname, router]);

  if (!drawer.allowed || !online || !drawer.isSuccess) return null;
  return (
    <>
      <div
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-staff border ps-3 pe-1.5 text-[13px]",
          session ? "border-border bg-canvas" : "border-warning/40 bg-warning-bg",
        )}
      >
        {session ? <Banknote aria-hidden className="size-4 shrink-0 text-ink-secondary" /> : <Lock aria-hidden className="size-4 shrink-0 text-warning" />}
        <span className="min-w-0 truncate text-ink">
          {session ? (
            <>
              <span className="font-medium">{fill(t.openSince, { time: cairoTime(session.opened_at, locale) })}</span>
              <span className="text-ink-secondary tabular-nums"> · {fill(t.float, { amount: formatAmount(session.opening_balance, null, locale) })}</span>
            </>
          ) : (
            <span className="font-medium">{t.closed}</span>
          )}
        </span>
        <Button size="sm" variant="secondary" className="min-h-8 shrink-0" onClick={() => setPanel(session ? "close" : "open")}>
          {session ? <Lock aria-hidden /> : <LockOpen aria-hidden />}
          {session ? t.closeDrawer : t.openDrawer}
        </Button>
      </div>
      <OpenPanel open={panel === "open"} onClose={() => setPanel(null)} t={t} />
      <ClosePanel open={panel === "close"} onClose={() => setPanel(null)} t={t} />
    </>
  );
}
