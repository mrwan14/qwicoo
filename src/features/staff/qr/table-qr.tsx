"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { qrCopy } from "@/lib/i18n/staff/qr";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

type Table = components["schemas"]["TableDetailResponse"];
type QrText = (typeof qrCopy)["en"];

/** Shared by Settings → Tables & QR and the branch Tables tab so both stay in step. */
/** Side by side when the card has room, stacked when it doesn't. */
const actionRow = "flex flex-wrap gap-2 [&>button]:flex-1 [&>button]:basis-28";

export const qrButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-staff border border-border bg-canvas px-2.5 text-sm whitespace-nowrap text-ink hover:bg-subtle [&_svg]:shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:text-disabled disabled:hover:bg-canvas";

export async function copyText(text: string, success: string, failed: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(success);
  } catch {
    toast.error(failed);
  }
}

export function saveBlob(blob: Blob, filename: string) {
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

export function tableQrFilename(table: Pick<Table, "table_number">) {
  return `table-${fileSafe(table.table_number)}-qr.png`;
}

/** The signed guest link (/t/<token>) for one table. Never built from the table number. */
export function useTableQrLink(tableId: string) {
  const t = useStaffSection(qrCopy);
  return useQuery({
    queryKey: ["table-qr-url", tableId],
    staleTime: Infinity,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/qr-export/tables/{table_id}/url", {
        params: { path: { table_id: tableId } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.couldntLoadLink);
      return result.data.signed_url;
    },
  });
}

function tableQrImageQuery(tableId: string, t: QrText) {
  return {
    queryKey: ["table-qr-image", tableId],
    staleTime: Infinity,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/qr-export/tables/{table_id}/image", {
        params: { path: { table_id: tableId }, query: { format: "png", scale: 10, include_label: true } },
        parseAs: "blob",
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.couldntLoadQr);
      return result.data as Blob;
    },
  };
}

/** The labelled PNG, loaded up front for a printable preview. */
export function useTableQrImage(tableId: string) {
  const t = useStaffSection(qrCopy);
  return useQuery(tableQrImageQuery(tableId, t));
}

/**
 * Zip of every table's QR. With ids, only those tables; without, the API uses the branch in
 * the staff scope header.
 */
export function useDownloadAllQr(tableIds: string[] | null) {
  const t = useStaffSection(qrCopy);
  return useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/qr-export/batch", {
        body: { table_ids: tableIds, format: "png", scale: 10, include_label: true },
        parseAs: "blob",
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.couldntBuildZip);
      saveBlob(result.data as Blob, "table-qr-codes.zip");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function DownloadAllQrButton({ tableIds }: { tableIds: string[] | null }) {
  const t = useStaffSection(qrCopy);
  const batch = useDownloadAllQr(tableIds);
  return (
    <button type="button" className={qrButton} disabled={batch.isPending} onClick={() => batch.mutate()}>
      <Download aria-hidden className="size-4" />
      {batch.isPending ? t.preparing : t.downloadAll}
    </button>
  );
}

/** Guest link line plus Copy link and Download. The PNG loads on the first Download tap. */
export function TableQrActions({ table }: { table: Table }) {
  const t = useStaffSection(qrCopy);
  const queryClient = useQueryClient();
  const link = useTableQrLink(table.id);
  const download = useMutation({
    mutationFn: async () => {
      const blob = await queryClient.fetchQuery(tableQrImageQuery(table.id, t));
      saveBlob(blob, tableQrFilename(table));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid gap-2">
      <GuestLinkLine link={link} />
      <div className={actionRow}>
        <button
          type="button"
          className={qrButton}
          disabled={!link.data}
          onClick={() => link.data && void copyText(link.data, fill(t.copied, { label: t.guestLink }), t.copyFailed)}
        >
          <Copy aria-hidden className="size-4" />
          {t.copyLink}
        </button>
        <button type="button" className={qrButton} disabled={download.isPending} onClick={() => download.mutate()}>
          <Download aria-hidden className="size-4" />
          {download.isPending ? t.preparing : t.download}
        </button>
      </div>
    </div>
  );
}

function GuestLinkLine({ link }: { link: ReturnType<typeof useTableQrLink> }) {
  const t = useStaffSection(qrCopy);
  if (link.data) {
    return (
      <code dir="ltr" className="block truncate rounded-staff bg-subtle px-3 py-2 text-start text-xs text-ink" title={link.data}>
        {link.data}
      </code>
    );
  }
  if (link.isError) {
    return (
      <p role="alert" className="flex flex-wrap items-center gap-x-2 text-sm text-danger">
        {link.error.message}
        <button type="button" className="text-ink underline underline-offset-4" onClick={() => void link.refetch()}>
          {t.retry}
        </button>
      </p>
    );
  }
  return <Skeleton className="h-9 w-full" />;
}

/** Settings → Tables & QR card: the printable preview with the same actions. */
export function TableQrCard({ table }: { table: Table }) {
  const t = useStaffSection(qrCopy);
  const link = useTableQrLink(table.id);
  const image = useTableQrImage(table.id);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!image.data) return;
    const url = URL.createObjectURL(image.data);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [image.data]);

  const error = image.error ?? link.error;

  return (
    <article className="grid gap-3 rounded-staff border border-border bg-canvas p-4">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="text-[length:var(--text-20)] font-semibold">{fill(t.tableTitle, { number: table.table_number })}</h3>
        <span className="truncate text-xs text-ink-secondary">{table.zone_name}</span>
      </header>
      <div className="grid aspect-square place-items-center overflow-hidden rounded-staff border bg-white">
        {src ? (
          // Blob URLs from the QR export are not a remote image host, so next/image cannot optimize them.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={fill(t.qrAlt, { number: table.table_number })} className="size-full object-contain" />
        ) : image.isError ? (
          <p className="p-4 text-center text-sm text-ink-secondary">{t.qrUnavailable}</p>
        ) : (
          <Skeleton className="size-full" />
        )}
      </div>
      {link.data ? (
        <code className="line-clamp-2 rounded-staff bg-muted px-3 py-2 text-xs break-all" title={link.data}>
          {link.data}
        </code>
      ) : link.isLoading ? (
        <Skeleton className="h-9 w-full" />
      ) : null}
      {error instanceof Error ? <p className="text-sm text-danger">{error.message}</p> : null}
      <div className={actionRow}>
        <button type="button" className={qrButton} disabled={!link.data} onClick={() => link.data && void copyText(link.data, fill(t.copied, { label: t.guestLink }), t.copyFailed)}>
          <Copy aria-hidden className="size-4" />
          {t.copyLink}
        </button>
        <button type="button" className={qrButton} disabled={!image.data} onClick={() => image.data && saveBlob(image.data, tableQrFilename(table))}>
          <Download aria-hidden className="size-4" />
          {t.download}
        </button>
      </div>
    </article>
  );
}
