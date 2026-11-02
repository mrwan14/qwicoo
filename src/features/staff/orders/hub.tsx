"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, type ReactNode } from "react";

import { buttonClass } from "@/components/ops/kit/button";
import { PageHeader } from "@/components/ops/kit/page-header";
import { SegmentedControl } from "@/components/ops/kit/segmented";
import { Tabs } from "@/components/ops/kit/tabs";
import { useStaffSession } from "@/components/ops/staff-session";
import { isOpenOrder } from "@/features/staff/home/numbers";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { deliveryBoardCopy } from "@/lib/i18n/staff/delivery-board";
import { ordersCopy } from "@/lib/i18n/staff/orders";
import { paymentsCopy } from "@/lib/i18n/staff/payments";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { navForUser } from "@/lib/nav";
import { useScope } from "@/stores/scope";

import { cairoToday, deliveryBoardQuery, liveOrdersQuery, pendingPaymentsQuery } from "./queries";

export type OrdersTab = "live" | "delivery" | "history" | "payments";
export type OrdersView = "list" | "tables";

const TABS: readonly { value: OrdersTab; href: string }[] = [
  { value: "live", href: "/app/orders" },
  { value: "delivery", href: "/app/orders/delivery" },
  { value: "history", href: "/app/orders/history" },
  { value: "payments", href: "/app/orders/payments" },
];

/** Orders page frame: title, the four tabs (with live counts) and, on Live, the List / Tables switch. */
export function OrdersHub({ tab, view = "list", children }: { tab: OrdersTab; view?: OrdersView; children: ReactNode }) {
  const t = useStaffSection(ordersCopy);
  const delivery = useStaffSection(deliveryBoardCopy);
  const payments = useStaffSection(paymentsCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const router = useRouter();
  const branchId = useScope((state) => state.branchId);
  const today = useMemo(() => cairoToday(), []);
  const allowed = new Set(me ? navForUser(me, branchId).map((item) => item.href) : []);

  const live = useQuery({ ...liveOrdersQuery(branchId, today, t.loadFailed, locale), refetchInterval: 15_000 });
  const pending = useQuery({ ...pendingPaymentsQuery(branchId, payments.loadFailed, locale), enabled: Boolean(branchId) && allowed.has("/app/orders/payments") });
  const board = useQuery({ ...deliveryBoardQuery(branchId, delivery.loadFailed, locale), enabled: Boolean(branchId) && allowed.has("/app/orders/delivery") });

  const open = live.data?.filter(isOpenOrder).length;
  const active = board.data?.filter((order) => order.deliveryStatus !== "delivered").length;
  const counts: Partial<Record<OrdersTab, number | undefined>> = { live: open, delivery: active || undefined, payments: pending.data?.length || undefined };

  const subtitle =
    tab === "live"
      ? open === undefined
        ? undefined
        : open === 1
          ? t.hub.liveOne
          : fill(t.hub.liveMany, { count: open })
      : tab === "delivery"
        ? t.hub.deliverySubtitle
        : tab === "payments"
          ? t.hub.paymentsSubtitle
          : t.hub.historySubtitle;

  return (
    <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-5">
      <PageHeader
        title={t.title}
        subtitle={subtitle}
        actions={
          allowed.has("/app/pos") ? (
            <Link href="/app/pos" className={buttonClass()}>
              <Plus aria-hidden />
              {t.hub.newOrder}
            </Link>
          ) : null
        }
      />
      <div className="flex flex-wrap items-end gap-4">
        <Tabs
          label={t.hub.tabsLabel}
          value={tab}
          className="min-w-0 flex-1"
          items={TABS.filter((item) => allowed.has(item.href)).map((item) => ({
            value: item.value,
            label: t.hub.tabs[item.value],
            href: item.href,
            count: counts[item.value],
          }))}
        />
        {tab === "live" && allowed.has("/app/floor") ? (
          <SegmentedControl
            label={t.hub.view}
            value={view}
            onValueChange={(next) => router.replace(next === "tables" ? "/app/orders?view=tables" : "/app/orders")}
            items={[
              { value: "list", label: t.hub.list },
              { value: "tables", label: t.hub.tables },
            ]}
          />
        ) : null}
      </div>
      {children}
    </div>
  );
}
