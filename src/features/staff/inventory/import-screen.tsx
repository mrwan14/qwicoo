"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ops/page-header";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { importCommitAllowed } from "./csv";
import { control, InventoryFrame, primaryButton, secondaryButton, useWarehouses, WarehouseSelect } from "./chrome";

type PreviewRow = components["schemas"]["ImportPreviewRow"];

export function ImportScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const brandId = useScope((state) => state.brandId) ?? "";
  const warehouses = useWarehouses();
  const [warehouseId, setWarehouseId] = useState("");
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const selected = warehouseId || warehouses.data?.[0]?.id || "";
  const allowed = rows ? importCommitAllowed(rows) : false;

  const preview = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/imports/preview", {
        params: { query: { brand_id: brandId } },
        body: { csv_text: csvText, warehouse_id: selected || null },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.rows;
    },
    onSuccess: (next) => setRows(next),
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  const commit = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/imports/commit", {
        params: { query: { brand_id: brandId } },
        body: { csv_text: csvText, warehouse_id: selected || null },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data;
    },
    onSuccess: (result) => {
      toast.success(fill(t.import.result, result));
      setRows(null);
      setCsvText("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });

  return (
    <InventoryFrame page="import">
      <PageHeader title={t.import.title} detail={t.import.detail} />
      <section className="grid gap-4 rounded-[16px] border border-border bg-canvas p-5">
        <p className="rounded-[12px] bg-subtle px-4 py-3 text-xs leading-5 text-ink-secondary">{t.import.columns}</p>
        <div className="grid items-end gap-3 lg:grid-cols-2">
          {warehouses.data && warehouses.data.length > 0 ? <WarehouseSelect warehouses={warehouses.data} value={selected} onChange={setWarehouseId} /> : null}
          <label className="grid gap-1 text-sm">
            <span>{t.import.file}</span>
            <input
              className={`${control} py-2 file:me-3 file:rounded-full file:border-0 file:bg-subtle file:px-3 file:py-1 file:text-[13px] file:font-medium`}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void file.text().then((text) => {
                  setCsvText(text);
                  setRows(null);
                });
              }}
            />
          </label>
        </div>
        <div className="flex gap-2 border-t border-border pt-4">
          <button type="button" className={secondaryButton} disabled={!csvText || preview.isPending} onClick={() => preview.mutate()}>
            {t.import.preview}
          </button>
          <button type="button" className={primaryButton} disabled={!allowed || commit.isPending} onClick={() => commit.mutate()}>
            {t.import.commit}
          </button>
        </div>
        {rows && !allowed ? <p className="text-sm text-danger">{t.import.blocked}</p> : null}
        {rows && rows.length > 0 ? (
          <div className="overflow-x-auto rounded-[12px] border border-border bg-canvas">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  {[t.import.line, t.import.sku, t.import.action, t.import.message].map((label) => (
                    <th key={label} className="px-3 py-2 text-start font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.line} className="border-b">
                    <td className="px-3 py-2 tabular-nums">{row.line}</td>
                    <td className="px-3 py-2">{row.sku}</td>
                    <td className="px-3 py-2">{t.import.actions[row.action]}</td>
                    <td className="px-3 py-2">{row.message ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!rows ? <p className="text-sm text-ink-secondary">{t.import.empty}</p> : null}
      </section>
    </InventoryFrame>
  );
}
