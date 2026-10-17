"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { StatusChip } from "@/components/ops/status-chip";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  deliveredCashCollected,
  deliveryStatusLabel,
  mapLink,
  parseDeliveryOrders,
  type DeliveryOrder,
} from "@/features/staff/delivery";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { formatMoney } from "@/lib/format/money";
import { formatCairoDateTime } from "@/lib/format/time";
import { pollUnlessRoleDenied, usePollingInterval } from "@/hooks/use-page-visible";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { deliveryBoardCopy } from "@/lib/i18n/staff/delivery-board";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { paymentMethodLabel } from "@/lib/status-labels";
import { useScope } from "@/stores/scope";

const COLUMNS = ["awaiting_dispatch", "on_the_way", "delivered"] as const;

const button = "min-h-11 border-0 bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50";
const quiet = "min-h-11 border bg-background px-3 text-sm";

function addressLines(order: DeliveryOrder): string[] {
  const address = order.address;
  if (!address) return [];
  return [address.label, address.street, address.building, address.floor, address.apartment, address.landmark].filter(Boolean);
}

export function DeliveryBoard() {
  const t = useStaffSection(deliveryBoardCopy);
  const { locale } = useLocale();
  const branchId = useScope((state) => state.branchId);
  const queryClient = useQueryClient();
  const interval = usePollingInterval(15_000);
  const [cashFor, setCashFor] = useState<DeliveryOrder | null>(null);
  const [cashChecked, setCashChecked] = useState(false);
  const [needsDrawer, setNeedsDrawer] = useState(false);

  const board = useQuery({
    queryKey: ["delivery-board", branchId],
    enabled: Boolean(branchId),
    refetchInterval: pollUnlessRoleDenied(interval),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/orders/delivery");
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return parseDeliveryOrders(result.data);
    },
  });

  const move = useMutation({
    mutationFn: async (input: { order: DeliveryOrder; step: "on-the-way" | "delivered"; cashCollected?: boolean }) => {
      const params = { path: { order_id: input.order.id } };
      const result = input.step === "on-the-way"
        ? await browserApi.POST("/api/v1/orders/{order_id}/delivery/on-the-way", { params })
        : await browserApi.POST("/api/v1/orders/{order_id}/delivery/delivered", {
          params,
          body: { cash_collected: input.cashCollected ?? false },
        });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.moveFailed, locale);
    },
    onSuccess: () => {
      setCashFor(null);
      setCashChecked(false);
      setNeedsDrawer(false);
      void queryClient.invalidateQueries({ queryKey: ["delivery-board"] });
    },
    onError: (error: Error & { code?: string | null }) => {
      setNeedsDrawer(error.code === "DELIVERY_DRAWER_NOT_OPEN");
      toast.error(error.message);
    },
  });

  if (!branchId) return null;
  if (board.isLoading) return <LoadingState label={t.loading} />;
  if (board.isError) return <QueryErrorState error={board.error} screen={t.screen} onRetry={() => void board.refetch()} />;

  const rows = board.data ?? [];
  const headings = { awaiting_dispatch: t.awaiting, on_the_way: t.onTheWay, delivered: t.delivered };

  function askDelivered(order: DeliveryOrder) {
    if (order.isPaid) {
      move.mutate({ order, step: "delivered", cashCollected: deliveredCashCollected(true) });
      return;
    }
    setCashChecked(false);
    setCashFor(order);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-[length:var(--text-28)] font-semibold">{t.title}</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t.hint}</p>
        </div>
        <Link href="/app/orders" className="text-sm underline-offset-2 hover:underline">{t.orders}</Link>
      </div>
      {needsDrawer ? (
        <p className="border bg-card px-4 py-3 text-sm">
          <Link href="/app/financials" className={`${button} inline-flex items-center`}>{t.openTill}</Link>
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((column) => {
          const cards = rows.filter((order) => order.deliveryStatus === column);
          return (
            <section key={column} className="grid content-start gap-3 border bg-card p-3">
              <h2 className="text-sm font-medium">{headings[column]}</h2>
              {cards.length === 0 ? <EmptyState title={t.empty} body="" /> : cards.map((order) => {
                const lines = addressLines(order);
                const maps = mapLink(order.address);
                const phone = order.address?.phone;
                const label = deliveryStatusLabel(order.deliveryStatus, locale) ?? order.status;
                const pending = move.isPending && move.variables?.order.id === order.id;
                return (
                  <article key={order.id} className="grid gap-2 border bg-background p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-semibold tabular-nums">{fill(t.order, { number: order.displayNumber || order.id.slice(0, 8) })}</h3>
                      <StatusChip tone={order.isPaid ? "available" : "ordered"}>{order.isPaid ? t.paid : t.unpaid}</StatusChip>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatCairoDateTime(order.createdAt, locale)}</p>
                    <p className="text-sm font-medium"><Money amount={order.total} /></p>
                    <p className="text-sm">{label}</p>
                    {order.customerName ? <p className="text-sm">{t.customer}: {order.customerName}</p> : null}
                    {order.customerPhone ? (
                      <p className="text-sm">
                        {t.phone}: <a className="underline-offset-2 hover:underline" href={`tel:${order.customerPhone}`}>{order.customerPhone}</a>
                      </p>
                    ) : null}
                    {order.deliveryFee ? <p className="text-sm">{t.fee}: <Money amount={order.deliveryFee} /></p> : null}
                    {order.paymentMethod ? <p className="text-sm">{t.payment}: {paymentMethodLabel(order.paymentMethod, locale)}</p> : null}
                    {lines.length > 0 || phone ? (
                      <div className="grid gap-1 text-sm">
                        <p className="font-medium">{t.address}</p>
                        {lines.map((line) => <p key={line}>{line}</p>)}
                        {phone ? <a className="underline-offset-2 hover:underline" href={`tel:${phone}`}>{phone}</a> : null}
                        {maps ? <a className="underline-offset-2 hover:underline" href={maps} target="_blank" rel="noreferrer">{t.map}</a> : null}
                      </div>
                    ) : null}
                    {order.items && order.items.length > 0 ? (
                      <ul className="grid gap-1 text-sm">
                        <li className="font-medium">{t.items}</li>
                        {order.items.map((item) => (
                          <li key={`${item.name}-${item.quantity}`} className="flex flex-wrap items-center gap-2">
                            <span className="tabular-nums">{item.quantity} ×</span> {item.name}
                            {item.badge === "Store" ? <span className="border px-1.5 py-0.5 text-xs font-medium">{t.store}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {column === "awaiting_dispatch" ? (
                      <button type="button" className={button} disabled={pending} onClick={() => move.mutate({ order, step: "on-the-way" })}>
                        {pending ? t.marking : t.markOnTheWay}
                      </button>
                    ) : null}
                    {column === "on_the_way" ? (
                      <button type="button" className={button} disabled={pending} onClick={() => askDelivered(order)}>
                        {pending ? t.marking : t.markDelivered}
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
      <AlertDialog open={cashFor !== null} onOpenChange={(open) => { if (!open) { setCashFor(null); setCashChecked(false); } }}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>{cashFor ? fill(t.cashTitle, { total: formatMoney(cashFor.total, "EGP", locale) }) : ""}</AlertDialogTitle>
            <AlertDialogDescription>{t.cashCheck}</AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={cashChecked}
              onChange={(event) => setCashChecked(event.target.checked)}
            />
            {t.cashCheck}
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel className={quiet}>{t.back}</AlertDialogCancel>
            <button
              type="button"
              className={button}
              disabled={!cashChecked || move.isPending}
              onClick={() => {
                if (cashFor) move.mutate({ order: cashFor, step: "delivered", cashCollected: true });
              }}
            >
              {move.isPending ? t.marking : t.confirmDelivered}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
