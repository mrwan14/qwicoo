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
import { useScope } from "@/stores/scope";

type Table = components["schemas"]["TableDetailResponse"];

const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm hover:bg-muted disabled:opacity-50";

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Couldn't copy. Select the link and copy it manually.");
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
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "PIN failed");
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
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Tables failed");
      return [...result.data].sort((a, b) => a.table_number.localeCompare(b.table_number, undefined, { numeric: true }));
    },
  });

  const batch = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/qr-export/batch", {
        body: { table_ids: null, format: "png", scale: 10, include_label: true },
        parseAs: "blob",
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Couldn't build the QR zip");
      saveBlob(result.data as Blob, "table-qr-codes.zip");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pickupLink = branchId && origin ? `${origin}/b/${branchId}/pickup` : null;
  const list = tables.data ?? [];

  return (
    <div className="grid gap-6">
      <PageHeader title="QR codes" />

      {canSeePin ? (
        <section className="grid gap-2 rounded-xl border bg-card p-4 shadow-elev-1">
          <h2 className="text-lg font-semibold">Guest PIN</h2>
          <p className="text-sm text-muted-foreground">Guests enter this PIN after they scan a table QR.</p>
          {pin.isLoading ? <LoadingState label="Loading PIN" /> : null}
          {pin.isError ? <p className="text-sm text-destructive">{pin.error instanceof Error ? pin.error.message : "PIN failed"}</p> : null}
          {pin.data ? <p className="text-2xl font-semibold tracking-widest">{pin.data.access_pin}</p> : null}
        </section>
      ) : null}

      <section className="grid gap-3 rounded-xl border bg-card p-4 shadow-elev-1">
        <h2 className="text-lg font-semibold">Pickup link</h2>
        <p className="text-sm text-muted-foreground">Guests use this to order ahead for pickup.</p>
        {pickupLink ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 rounded-lg bg-muted px-3 py-2 text-xs break-all">{pickupLink}</code>
            <button type="button" className={secondary} onClick={() => void copyText(pickupLink, "Pickup link")}>
              <Copy aria-hidden className="size-4" />
              Copy
            </button>
          </div>
        ) : null}
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Table QR codes</h2>
            <p className="text-sm text-muted-foreground">Print one per table. Guests scan it to open the menu at that table.</p>
          </div>
          {list.length > 0 ? (
            <button type="button" className={secondary} disabled={batch.isPending} onClick={() => batch.mutate()}>
              <Download aria-hidden className="size-4" />
              {batch.isPending ? "Preparing…" : "Download all (zip)"}
            </button>
          ) : null}
        </div>
        {tables.isLoading ? <LoadingState label="Loading tables" /> : null}
        {tables.isError ? <QueryErrorState error={tables.error} screen="Table QR codes" onRetry={() => void tables.refetch()} /> : null}
        {tables.isSuccess && list.length === 0 ? (
          <EmptyState title="No tables yet" body="Add tables in this branch's settings, then come back to print their QR codes." />
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
  const link = useQuery({
    queryKey: ["table-qr-url", table.id],
    staleTime: Infinity,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/qr-export/tables/{table_id}/url", {
        params: { path: { table_id: table.id } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Couldn't load the guest link");
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
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Couldn't load the QR code");
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
        <h3 className="text-[length:var(--text-20)] font-semibold">Table {table.table_number}</h3>
        <span className="truncate text-xs text-muted-foreground">{table.zone_name}</span>
      </header>
      <div className="grid aspect-square place-items-center overflow-hidden rounded-lg border bg-white">
        {src ? (
          // Blob URLs from the QR export are not a remote image host, so next/image cannot optimize them.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`QR code for table ${table.table_number}`} className="size-full object-contain" />
        ) : image.isError ? (
          <p className="p-4 text-center text-sm text-muted-foreground">QR code unavailable</p>
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
        <button type="button" className={secondary} disabled={!link.data} onClick={() => link.data && void copyText(link.data, "Guest link")}>
          <Copy aria-hidden className="size-4" />
          Copy link
        </button>
        <button
          type="button"
          className={secondary}
          disabled={!image.data}
          onClick={() => image.data && saveBlob(image.data, `table-${fileSafe(table.table_number)}-qr.png`)}
        >
          <Download aria-hidden className="size-4" />
          Download
        </button>
      </div>
    </article>
  );
}
