"use client";

import { useMutation } from "@tanstack/react-query";
import { Download, FileSpreadsheet } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ops/page-header";
import { downloadCsv } from "@/features/staff/reports/csv";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { control, InventoryFrame, primaryButton, secondaryButton, useWarehouses, WarehouseSelect } from "./chrome";
import { importCommitAllowed } from "./csv";
import {
  downloadFromApi,
  errorRowsTable,
  importCounts,
  importErrorCode,
  sendImportFile,
  type ImportPreview,
  type ImportPreviewRow,
  type ImportResult,
} from "./files";

const ACTION_TONE: Record<ImportPreviewRow["action"], string> = {
  create: "text-success",
  update: "text-ink",
  same: "text-ink-secondary",
  error: "text-danger font-medium",
};

export function ImportScreen() {
  const t = useStaffSection(inventoryCopy);
  const copy = t.import;
  const { locale } = useLocale();
  const brandId = useScope((state) => state.brandId) ?? "";
  const warehouses = useWarehouses();
  const [warehouseId, setWarehouseId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportPreview | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const selected = warehouseId || warehouses.data?.[0]?.id || "";
  const rows = result?.rows ?? null;
  const allowed = rows ? importCommitAllowed(rows) : false;
  const counts = rows ? importCounts(rows) : null;

  const explain = (row: ImportPreviewRow): string => {
    if (row.action === "same" && row.same_as) return fill(copy.sameAs, { line: row.same_as });
    if (!row.message) return "";
    return copy.messages[row.message] ?? row.message;
  };
  const fileError = (error: unknown): string => {
    const code = importErrorCode(error);
    if (code && copy.fileErrors[code]) return copy.fileErrors[code];
    return error instanceof Error ? error.message : t.loadFailed;
  };

  const preview = useMutation({
    mutationFn: () => sendImportFile<ImportPreview>("preview-file", { brandId, file: file as File, warehouseId: selected }, t.loadFailed, locale),
    onSuccess: (next) => setResult(next),
    onError: (error) => toast.error(fileError(error)),
  });
  const commit = useMutation({
    mutationFn: () => sendImportFile<ImportResult>("commit-file", { brandId, file: file as File, warehouseId: selected }, t.loadFailed, locale),
    onSuccess: (done) => {
      toast.success(fill(copy.result, done));
      setResult(null);
      setFile(null);
      if (input.current) input.current.value = "";
    },
    onError: (error) => toast.error(fileError(error)),
  });
  const template = useMutation({
    mutationFn: (format: "xlsx" | "csv") =>
      downloadFromApi("/inventory/imports/template", { brand_id: brandId, format }, `stock-items-template.${format}`, t.loadFailed, locale),
    onError: (error) => toast.error(fileError(error)),
  });

  const ignored = result?.ignored_columns ?? [];
  const onHandIgnored = ignored.includes("on_hand");

  return (
    <InventoryFrame page="import">
      <PageHeader title={copy.title} detail={copy.detail} />
      <section className="grid gap-3 rounded-[16px] border border-border bg-canvas p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex gap-3">
          <FileSpreadsheet aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-secondary" />
          <div className="grid gap-1">
            <h2 className="text-sm font-semibold">{copy.templateTitle}</h2>
            <p className="text-sm text-ink-secondary">{copy.templateBody}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryButton} disabled={template.isPending} onClick={() => template.mutate("xlsx")}>
            <Download aria-hidden className="size-4" />
            {copy.templateExcel}
          </button>
          <button type="button" className={secondaryButton} disabled={template.isPending} onClick={() => template.mutate("csv")}>
            {copy.templateCsv}
          </button>
        </div>
      </section>

      <section className="grid gap-4 rounded-[16px] border border-border bg-canvas p-5">
        <p className="rounded-[12px] bg-subtle px-4 py-3 text-xs leading-5 text-ink-secondary">{copy.columns}</p>
        <div className="grid items-end gap-3 lg:grid-cols-2">
          {warehouses.data && warehouses.data.length > 0 ? <WarehouseSelect warehouses={warehouses.data} value={selected} onChange={setWarehouseId} /> : null}
          <label className="grid gap-1 text-sm">
            <span>{copy.file}</span>
            <input
              ref={input}
              className={`${control} py-2 file:me-3 file:rounded-full file:border-0 file:bg-subtle file:px-3 file:py-1 file:text-[13px] file:font-medium`}
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setResult(null);
              }}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <button type="button" className={secondaryButton} disabled={!file || preview.isPending} onClick={() => preview.mutate()}>
            {copy.preview}
          </button>
          <button type="button" className={primaryButton} disabled={!allowed || commit.isPending} onClick={() => commit.mutate()}>
            {copy.commit}
          </button>
        </div>

        {counts ? (
          <p className="text-sm font-medium tabular-nums" role="status">
            {fill(copy.summary, counts)}
          </p>
        ) : null}
        {ignored.length ? (
          <p className="rounded-[12px] bg-subtle px-4 py-3 text-sm text-ink-secondary">
            {copy.ignored}{" "}
            <bdi dir="ltr" className="font-mono text-[13px]">
              {ignored.join(", ")}
            </bdi>
            . {onHandIgnored ? copy.onHandIgnored : null}
          </p>
        ) : null}
        {rows && !allowed && counts && counts.errors > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-danger/30 bg-danger/5 px-4 py-3">
            <p className="text-sm text-danger">{copy.blocked}</p>
            <button
              type="button"
              className={secondaryButton}
              onClick={() => {
                const table = errorRowsTable(rows, explain);
                const base = (file?.name ?? "stock-items").replace(/\.(xlsx|csv)$/i, "");
                downloadCsv(`${base}-to-fix.csv`, table.header, table.body);
              }}
            >
              <Download aria-hidden className="size-4" />
              {copy.errorFile}
            </button>
          </div>
        ) : null}

        {rows && rows.length > 0 ? (
          <div className="overflow-x-auto rounded-[12px] border border-border bg-canvas">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  {[copy.line, copy.sku, copy.action, copy.message].map((label) => (
                    <th key={label} className="px-3 py-2 text-start font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.line} className="border-b last:border-b-0">
                    <td className="px-3 py-2 tabular-nums">{row.line}</td>
                    <td className="px-3 py-2" dir="auto">
                      {row.sku}
                    </td>
                    <td className={`px-3 py-2 ${ACTION_TONE[row.action]}`}>{copy.actions[row.action]}</td>
                    <td className="px-3 py-2 text-ink-secondary">{explain(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!rows ? <p className="text-sm text-ink-secondary">{copy.empty}</p> : null}
      </section>
    </InventoryFrame>
  );
}
