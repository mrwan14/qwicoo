"use client";

import { cn } from "cn";
import type { KeyboardEvent, ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { kitCopy } from "@/lib/i18n/staff/kit";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export type Column<Row> = {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Fixed width in px. Columns without one share the rest. */
  width?: number;
  align?: "start" | "end";
  /** Medium weight, for the identifying column (order number, item name). */
  strong?: boolean;
  /** Cells stay on one line and the table scrolls sideways; set for long free text like notes. */
  wrap?: boolean;
};

const edge = "px-2 first:ps-4 last:pe-4";

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  loading = false,
  empty,
  caption,
  stack = false,
  flush = false,
  className,
}: {
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  onRowClick?: (row: Row) => void;
  selectedKey?: string | null;
  loading?: boolean;
  empty?: ReactNode;
  /** Read by screen readers only. */
  caption?: string;
  /**
   * On phones, show each row as a card (first column as its title, the rest as label and value)
   * instead of a table that scrolls sideways. Wider screens keep the table.
   */
  stack?: boolean;
  /** Inside a Panel: no outer box, and stacked rows become divided rows instead of separate cards. */
  flush?: boolean;
  className?: string;
}) {
  const t = useStaffSection(kitCopy);
  const activate = (event: KeyboardEvent<HTMLElement>, row: Row) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onRowClick?.(row);
  };

  const table = (
    <div className={cn("overflow-x-auto rounded-staff border border-border bg-canvas", flush && "rounded-none border-0", stack && "hidden sm:block", className)}>
      <table className="w-full border-collapse text-sm text-ink">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-border bg-subtle">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={cn(
                  edge,
                  "h-10 text-xs font-semibold whitespace-nowrap text-ink-secondary",
                  column.align === "end" ? "text-end" : "text-start",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            [0, 1, 2].map((index) => (
              <tr key={index} className="border-b border-border last:border-b-0">
                {columns.map((column) => (
                  <td key={column.key} className={cn(edge, "h-[52px]")}>
                    <Skeleton className="h-4 w-3/4 rounded-staff" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-ink-secondary">
                {empty ?? t.nothingYet}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = rowKey(row);
              return (
                <tr
                  key={key}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (event) => activate(event, row) : undefined}
                  data-selected={key === selectedKey || undefined}
                  className={cn(
                    "border-b border-border last:border-b-0 data-selected:bg-subtle",
                    onRowClick &&
                      "cursor-pointer hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        edge,
                        "h-[52px] py-2",
                        column.align === "end" ? "text-end" : "text-start",
                        column.strong && "font-medium",
                        !column.wrap && "whitespace-nowrap",
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
  if (!stack) return table;

  const [title, ...rest] = columns;
  return (
    <>
      {table}
      <div className={cn("grid sm:hidden", flush ? "gap-0" : "gap-2", className)}>
        {caption ? <p className="sr-only">{caption}</p> : null}
        {loading ? (
          [0, 1, 2].map((index) => <Skeleton key={index} className="h-24 w-full rounded-staff" />)
        ) : rows.length === 0 ? (
          <p className="rounded-staff border border-border bg-canvas px-4 py-10 text-center text-sm text-ink-secondary">{empty ?? t.nothingYet}</p>
        ) : (
          <ul className={flush ? "grid divide-y divide-border" : "grid gap-2"}>
            {rows.map((row) => {
              const key = rowKey(row);
              return (
                <li
                  key={key}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (event) => activate(event, row) : undefined}
                  className={cn(
                    "grid gap-2 bg-canvas text-sm text-ink",
                    flush ? "px-4 py-3" : "rounded-staff border border-border p-3",
                    onRowClick && "cursor-pointer hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                  )}
                >
                  {title ? <div className="font-semibold">{title.cell(row)}</div> : null}
                  <dl className="grid gap-1.5">
                    {rest.map((column) => (
                      <div key={column.key} className="flex items-center justify-between gap-3">
                        <dt className="text-xs text-ink-secondary">{column.header}</dt>
                        <dd className="text-end tabular-nums">{column.cell(row)}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
