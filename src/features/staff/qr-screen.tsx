"use client";

import { useQuery } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/ops/page-header";
import { useStaffSession } from "@/components/ops/staff-session";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { PIN_ROLES } from "@/lib/auth/scope";
import { fill } from "@/lib/i18n/dictionary";
import { qrCopy } from "@/lib/i18n/staff/qr";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { DownloadAllQrButton, TableQrCard, copyText, qrButton } from "./qr/table-qr";

export function QrScreen() {
  const t = useStaffSection(qrCopy);
  const branchId = useScope((state) => state.branchId);
  const me = useStaffSession();
  const canSeePin = Boolean(me && PIN_ROLES.includes(me.role));
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const pin = useQuery({
    queryKey: ["access-pin", branchId],
    enabled: Boolean(branchId) && canSeePin,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/access-pin", {
        params: { path: { branch_id: branchId ?? "" } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.pinFailed);
      return result.data;
    },
  });

  const tables = useQuery({
    queryKey: ["branch-tables", branchId],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/tables", {
        params: { path: { branch_id: branchId ?? "" } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.tablesFailed);
      return [...result.data].sort((a, b) => a.table_number.localeCompare(b.table_number, undefined, { numeric: true }));
    },
  });

  const pickupLink = branchId && origin ? `${origin}/b/${branchId}/pickup` : null;
  const list = tables.data ?? [];

  return (
    <div className="grid gap-6">
      <PageHeader title={t.title} />

      {canSeePin ? (
        <section className="grid gap-2 rounded-staff border bg-canvas p-4 border border-border">
          <h2 className="text-lg font-semibold">{t.guestPin}</h2>
          <p className="text-sm text-ink-secondary">{t.guestPinHint}</p>
          {pin.isLoading ? <LoadingState label={t.loadingPin} /> : null}
          {pin.isError ? <p className="text-sm text-danger">{pin.error instanceof Error ? pin.error.message : t.pinFailed}</p> : null}
          {pin.data ? <p className="text-2xl font-semibold tracking-widest">{pin.data.access_pin}</p> : null}
        </section>
      ) : null}

      <section className="grid gap-3 rounded-staff border bg-canvas p-4 border border-border">
        <h2 className="text-lg font-semibold">{t.pickup}</h2>
        <p className="text-sm text-ink-secondary">{t.pickupHint}</p>
        {pickupLink ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 rounded-staff bg-muted px-3 py-2 text-xs break-all">{pickupLink}</code>
            <button type="button" className={qrButton} onClick={() => void copyText(pickupLink, fill(t.copied, { label: t.pickup }), t.copyFailed)}>
              <Copy aria-hidden className="size-4" />
              {t.copy}
            </button>
          </div>
        ) : null}
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{t.tableQr}</h2>
            <p className="text-sm text-ink-secondary">{t.tableQrHint}</p>
          </div>
          {list.length > 0 ? (
            <DownloadAllQrButton tableIds={null} />
          ) : null}
        </div>
        {tables.isLoading ? <LoadingState label={t.loadingTables} /> : null}
        {tables.isError ? <QueryErrorState error={tables.error} screen={t.tableQr} onRetry={() => void tables.refetch()} /> : null}
        {tables.isSuccess && list.length === 0 ? (
          <EmptyState title={t.emptyTitle} body={t.emptyBody} />
        ) : null}
        {list.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((table) => (
              <li key={table.id}>
                <TableQrCard table={table} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
