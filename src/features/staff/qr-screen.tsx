"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useWorkspace } from "@/stores/workspace";

const control = "h-11 w-full rounded-lg border px-3 text-sm";

export function QrScreen() {
  const branchId = useWorkspace((state) => state.branchId);
  const [tableId, setTableId] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [signed, setSigned] = useState<components["schemas"]["SingleTableQRResponse"] | null>(null);

  const generate = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/qr/generate-token", {
        body: { table_id: tableId },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Could not generate a token");
      return result.data;
    },
    onSuccess: (data) => {
      const origin = window.location.origin;
      void navigator.clipboard.writeText(`${origin}/t/${encodeURIComponent(data.token)}`).catch(() => undefined);
      toast.success("Guest link copied");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const loadImage = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/v1/qr-export/tables/${tableId}/image`, { credentials: "include" });
      if (!response.ok) throw new Error("Could not load the QR image");
      const blob = await response.blob();
      setImage(URL.createObjectURL(blob));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const loadUrl = useMutation({
    mutationFn: async () => {
      const result = await browserApi.GET("/api/v1/qr-export/tables/{table_id}/url", {
        params: { path: { table_id: tableId } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "URL failed");
      setSigned(result.data);
      return result.data;
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const verify = useMutation({
    mutationFn: async () => {
      if (!signed || !branchId) throw new Error("Load the signed URL first");
      const result = await browserApi.GET("/api/v1/qr-export/verify", {
        params: {
          query: {
            table_id: signed.table_id,
            branch_id: branchId,
            ts: signed.timestamp,
            sig: signed.signature,
          },
        },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Verify failed");
      return result.data;
    },
    onSuccess: (data) => toast.success(data.valid ? "Signature valid" : "Signature invalid"),
    onError: (error: Error) => toast.error(error.message),
  });

  const batch = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/v1/qr-export/batch", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(branchId ? { "X-Branch-ID": branchId } : {}),
        },
        body: JSON.stringify({
          table_ids: tableId ? [tableId] : null,
          format: "png",
          scale: 10,
          include_label: true,
        }),
      });
      if (!response.ok) throw new Error("Batch failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "table-qr.zip";
      anchor.click();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid max-w-xl gap-3">
      <h1 className="text-[length:var(--text-28)] font-semibold">QR codes</h1>
      <input className={control} placeholder="Table id" value={tableId} onChange={(event) => setTableId(event.target.value)} />
      <button type="button" className="min-h-11 rounded-lg bg-primary text-sm text-primary-foreground" onClick={() => generate.mutate()}>
        Generate guest link
      </button>
      <button type="button" className="min-h-11 rounded-lg border text-sm" onClick={() => loadImage.mutate()}>
        Show QR image
      </button>
      {image ? (
        // Blob URLs from the QR export are not a remote image host, so next/image cannot optimize them.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="Table QR code" className="w-full max-w-sm rounded-xl border" />
      ) : null}
      <button type="button" className="min-h-11 rounded-lg border text-sm" onClick={() => loadUrl.mutate()}>
        Signed URL
      </button>
      {signed ? <p className="break-all text-xs">{signed.signed_url}</p> : null}
      <button type="button" className="min-h-11 rounded-lg border text-sm" onClick={() => verify.mutate()}>
        Verify signature
      </button>
      <button type="button" className="min-h-11 rounded-lg border text-sm" onClick={() => batch.mutate()}>
        Download batch zip
      </button>
      {branchId ? (
        <p className="text-sm text-muted-foreground">
          Pickup link: {window.location.origin}/b/{branchId}/pickup
        </p>
      ) : null}
    </div>
  );
}
