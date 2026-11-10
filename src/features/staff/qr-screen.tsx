"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { useStaffSession } from "@/components/ops/staff-session";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { StatusChip } from "@/components/ops/status-chip";
import { ApiError, asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { can } from "@/lib/auth/permissions";
import { PIN_ROLES } from "@/lib/auth/scope";
import { fill } from "@/lib/i18n/dictionary";
import { branchCopy } from "@/lib/i18n/staff/branch";
import { qrCopy } from "@/lib/i18n/staff/qr";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { DownloadAllQrButton, TableQrCard, copyText, qrButton } from "./qr/table-qr";

type TableDetail = components["schemas"]["TableDetailResponse"];
type BranchText = (typeof branchCopy)["en"];
type ChipTone = "available" | "browsing" | "ordered" | "ready" | "soldout" | "neutral";

const card = "grid min-w-0 grid-cols-1 content-start gap-3 rounded-[16px] border border-border bg-canvas p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)]";
const note = "text-xs leading-5 text-ink-secondary";
const control =
  "h-11 w-full rounded-[10px] border border-border bg-canvas px-3 text-sm text-ink outline-none transition-colors hover:border-ink-secondary/50 focus-visible:border-ink";
const primaryButton =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium whitespace-nowrap text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50";

/** Query key shared with anything else that lists this branch's tables. */
export const branchTablesKey = (branchId: string | null) => ["branch-tables", branchId] as const;

/**
 * Settings → Tables & QR: everything about tables for the branch picked in the top bar.
 * Add tables, see their live status, print or copy each QR, the guest PIN and the pickup link.
 */
export function QrScreen() {
  const t = useStaffSection(qrCopy);
  const b = useStaffSection(branchCopy);
  const branchId = useScope((state) => state.branchId);
  const me = useStaffSession();
  const canSeePin = Boolean(me && PIN_ROLES.includes(me.role));
  const canAdd = can(me?.role, "tables.add");
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const tables = useQuery({
    queryKey: branchTablesKey(branchId),
    enabled: Boolean(branchId),
    retry: false,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/tables", {
        params: { path: { branch_id: branchId ?? "" } },
      });
      if (result.response.status === 500) throw new ApiError(500, b.tableListUnavailable);
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.tablesFailed);
      return [...result.data].sort((a, c) => a.table_number.localeCompare(c.table_number, undefined, { numeric: true }));
    },
  });

  const pickupLink = branchId && origin ? `${origin}/b/${branchId}/pickup` : null;
  const list = tables.data ?? [];

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {canSeePin && branchId ? <GuestPinCard branchId={branchId} /> : null}

        <section className={card}>
          <h2 className="text-base font-semibold text-ink">{t.pickup}</h2>
          <p className="text-sm leading-6 text-ink-secondary">{t.pickupHint}</p>
          {pickupLink ? (
            <div className="flex items-center gap-2">
              <code dir="ltr" className="block min-w-0 flex-1 truncate rounded-[10px] bg-subtle px-3 py-2.5 text-xs" title={pickupLink}>
                {pickupLink}
              </code>
              <button type="button" className={qrButton} onClick={() => void copyText(pickupLink, fill(t.copied, { label: t.pickup }), t.copyFailed)}>
                <Copy aria-hidden className="size-4" />
                {t.copy}
              </button>
            </div>
          ) : null}
        </section>
      </div>
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-base font-semibold text-ink">{t.tableQr}</h2>
            <p className="text-sm leading-6 text-ink-secondary">{t.tableQrHint}</p>
          </div>
          {list.length > 0 ? <DownloadAllQrButton tableIds={list.map((table) => table.id)} /> : null}
        </div>

        {canAdd && branchId ? <AddTableForm branchId={branchId} /> : null}

        {tables.isLoading ? <LoadingState label={t.loadingTables} /> : null}
        {tables.isError ? <QueryErrorState error={tables.error} screen={t.tableQr} onRetry={() => void tables.refetch()} /> : null}
        {tables.isSuccess && list.length === 0 ? <EmptyState title={t.emptyTitle} body={canAdd ? b.tablesHint : t.emptyBody} /> : null}
        {list.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {list.map((table) => (
              <li key={table.id}>
                <TableQrCard
                  table={table}
                  status={<StatusChip tone={tableTone(table)}>{tableLabel(table, b.tableStatus)}</StatusChip>}
                  detail={`${table.zone_name} · ${table.capacity === 1 ? b.oneSeat : fill(b.manySeats, { count: table.capacity })}`}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

function AddTableForm({ branchId }: { branchId: string }) {
  const b = useStaffSection(branchCopy);
  const queryClient = useQueryClient();
  const [number, setNumber] = useState("");
  const create = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["TableCreateRequest"] = { table_number: number.trim(), capacity: 4, zone_name: "Indoor" };
      const result = await browserApi.POST("/api/v1/branches/{branch_id}/tables", { params: { path: { branch_id: branchId } }, body });
      if (!result.response.ok) throw asApiError(result.error, result.response, b.couldNotCreateTable);
    },
    onSuccess: () => {
      toast.success(b.tableCreated);
      setNumber("");
      void queryClient.invalidateQueries({ queryKey: branchTablesKey(branchId) });
      void queryClient.invalidateQueries({ queryKey: ["tables", branchId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form
      className="grid gap-1.5 rounded-[12px] bg-subtle/60 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (number.trim()) create.mutate();
      }}
    >
      <div className="flex items-center gap-2">
        <label className="min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">{b.tableNumber}</span>
          <input className={control} placeholder={b.tableNumberPlaceholder} value={number} onChange={(event) => setNumber(event.target.value)} required />
        </label>
        <button className={primaryButton} type="submit" aria-describedby="add-table-hint" disabled={create.isPending || !number.trim()}>
          <Plus aria-hidden className="size-4" />
          {create.isPending ? b.adding : b.addTable}
        </button>
      </div>
      <p id="add-table-hint" className={note}>
        {b.tablesHint}
      </p>
    </form>
  );
}

function GuestPinCard({ branchId }: { branchId: string }) {
  const t = useStaffSection(qrCopy);
  const b = useStaffSection(branchCopy);
  const [confirm, setConfirm] = useState(false);
  const pin = useQuery({
    queryKey: ["access-pin", branchId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/access-pin", { params: { path: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.pinFailed);
      return result.data;
    },
  });
  const rotate = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/branches/{branch_id}/access-pin/rotate", { params: { path: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, b.rotateFailed);
      return result.data;
    },
    onSuccess: () => {
      setConfirm(false);
      void pin.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <section className={card}>
      <h2 className="text-base font-semibold text-ink">{t.guestPin}</h2>
      <p className="text-sm leading-6 text-ink-secondary">{b.pinHint}</p>
      {pin.isLoading ? <LoadingState label={t.loadingPin} /> : null}
      {pin.isError ? <p className="text-sm text-danger">{pin.error instanceof Error ? pin.error.message : t.pinFailed}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {pin.data ? (
          <p dir="ltr" className="rounded-[12px] bg-subtle px-4 py-2 text-2xl font-semibold tracking-[0.3em] tabular-nums">
            {pin.data.access_pin}
          </p>
        ) : (
          <span />
        )}
        <button type="button" className={qrButton} aria-describedby="rotate-pin-hint" disabled={rotate.isPending} onClick={() => setConfirm(true)}>
          <RefreshCw aria-hidden className="size-4" />
          {rotate.isPending ? b.rotating : b.rotatePin}
        </button>
      </div>
      <p id="rotate-pin-hint" className={note}>
        {b.rotateHint}
      </p>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={b.rotateTitle}
        description={b.rotateBody}
        confirmLabel={b.rotate}
        destructive
        onConfirm={() => rotate.mutate()}
      />
    </section>
  );
}

function tableTone(table: TableDetail): ChipTone {
  if (!table.is_active) return "soldout";
  switch (table.status) {
    case "AVAILABLE":
      return "available";
    case "BROWSING":
      return "browsing";
    case "AWAITING_FOOD":
    case "BILL_REQUESTED":
      return "ordered";
    case "EATING":
      return "ready";
    case "NEEDS_CLEANING":
      return "soldout";
    default:
      return "neutral";
  }
}

function tableLabel(table: TableDetail, labels: BranchText["tableStatus"]): string {
  if (!table.is_active) return labels.inactive;
  switch (table.status) {
    case "AVAILABLE":
      return labels.AVAILABLE;
    case "BROWSING":
      return labels.BROWSING;
    case "AWAITING_FOOD":
      return labels.AWAITING_FOOD;
    case "EATING":
      return labels.EATING;
    case "BILL_REQUESTED":
      return labels.BILL_REQUESTED;
    case "NEEDS_CLEANING":
      return labels.NEEDS_CLEANING;
    default:
      return table.status;
  }
}
