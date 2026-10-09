"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ops/page-header";
import { useStaffSession } from "@/components/ops/staff-session";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { Skeleton } from "@/components/ui/skeleton";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { PIN_ROLES } from "@/lib/auth/scope";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { qrCopy } from "@/lib/i18n/staff/qr";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

type Table = components["schemas"]["TableDetailResponse"];

const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm hover:bg-muted disabled:opacity-50";

async function copyText(text: string, success: string, failed: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(success);
  } catch {
    toast.error(failed);
  }
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileSafe(value: string) {
  return value.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "table";
}

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

  const batch = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/qr-export/batch", {
        body: { table_ids: null, format: "png", scale: 10, include_label: true },
        parseAs: "blob",
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.couldntBuildZip);
      saveBlob(result.data as Blob, "table-qr-codes.zip");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pickupLink = branchId && origin ? `${origin}/b/${branchId}/pickup` : null;
  const list = tables.data ?? [];

  return (
    <div className="grid gap-6">
      <PageHeader title={t.title} />

      {canSeePin ? (
        <section className="grid gap-2 rounded-xl border bg-card p-4 shadow-elev-1">
          <h2 className="text-lg font-semibold">{t.guestPin}</h2>
          <p className="text-sm text-muted-foreground">{t.guestPinHint}</p>
          {pin.isLoading ? <LoadingState label={t.loadingPin} /> : null}
          {pin.isError ? <p className="text-sm text-destructive">{pin.error instanceof Error ? pin.error.message : t.pinFailed}</p> : null}
          {pin.data ? <p className="text-2xl font-semibold tracking-widest">{pin.data.access_pin}</p> : null}
        </section>
      ) : null}

      <section className="grid gap-3 rounded-xl border bg-card p-4 shadow-elev-1">
        <h2 className="text-lg font-semibold">{t.pickup}</h2>
        <p className="text-sm text-muted-foreground">{t.pickupHint}</p>
        {pickupLink ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 rounded-lg bg-muted px-3 py-2 text-xs break-all">{pickupLink}</code>
            <button type="button" className={secondary} onClick={() => void copyText(pickupLink, fill(t.copied, { label: t.pickup }), t.copyFailed)}>
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
            <p className="text-sm text-muted-foreground">{t.tableQrHint}</p>
          </div>
          {list.length > 0 ? (
            <button type="button" className={secondary} disabled={batch.isPending} onClick={() => batch.mutate()}>
              <Download aria-hidden className="size-4" />
              {batch.isPending ? t.preparing : t.downloadAll}
            </button>
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

function TableQrCard({ table }: { table: Table }) {
  const t = useStaffSection(qrCopy);
  const link = useQuery({
    queryKey: ["table-qr-url", table.id],
    staleTime: Infinity,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/qr-export/tables/{table_id}/url", {
        params: { path: { table_id: table.id } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.couldntLoadLink);
      return result.data.signed_url;
    },
  });

  const image = useQuery({
    queryKey: ["table-qr-image", table.id],
    staleTime: Infinity,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/qr-export/tables/{table_id}/image", {
        params: { path: { table_id: table.id }, query: { format: "png", scale: 10, include_label: true } },
        parseAs: "blob",
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.couldntLoadQr);
      return result.data;
    },
  });

  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!image.data) return;
    const url = URL.createObjectURL(image.data);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [image.data]);

  const error = image.error ?? link.error;

  return (
    <article className="grid gap-3 rounded-xl border bg-card p-4 shadow-elev-1">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="text-[length:var(--text-20)] font-semibold">{fill(t.tableTitle, { number: table.table_number })}</h3>
        <span className="truncate text-xs text-muted-foreground">{table.zone_name}</span>
      </header>
      <div className="grid aspect-square place-items-center overflow-hidden rounded-lg border bg-white">
        {src ? (
          // Blob URLs from the QR export are not a remote image host, so next/image cannot optimize them.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={fill(t.qrAlt, { number: table.table_number })} className="size-full object-contain" />
        ) : image.isError ? (
          <p className="p-4 text-center text-sm text-muted-foreground">{t.qrUnavailable}</p>
        ) : (
          <Skeleton className="size-full" />
        )}
      </div>
      {link.data ? (
        <code className="line-clamp-2 rounded-lg bg-muted px-3 py-2 text-xs break-all" title={link.data}>
          {link.data}
        </code>
      ) : link.isLoading ? (
        <Skeleton className="h-9 w-full" />
      ) : null}
      {error instanceof Error ? <p className="text-sm text-destructive">{error.message}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={secondary} disabled={!link.data} onClick={() => link.data && void copyText(link.data, fill(t.copied, { label: t.guestLink }), t.copyFailed)}>
          <Copy aria-hidden className="size-4" />
          {t.copyLink}
        </button>
        <button
          type="button"
          className={secondary}
          disabled={!image.data}
          onClick={() => image.data && saveBlob(image.data, `table-${fileSafe(table.table_number)}-qr.png`)}
        >
          <Download aria-hidden className="size-4" />
          {t.download}
        </button>
      </div>
    </article>
  );
}
