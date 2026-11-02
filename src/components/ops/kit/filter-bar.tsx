"use client";

import { cn } from "cn";
import { Calendar, Download, Search } from "lucide-react";

import { Button } from "@/components/ops/kit/button";
import { DATE_PRESETS, withPreset, type DateFilter, type DatePreset } from "@/components/ops/kit/date-range";
import { Input, Select } from "@/components/ops/kit/field";
import { SegmentedControl } from "@/components/ops/kit/segmented";
import { kitCopy } from "@/lib/i18n/staff/kit";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export type FilterOption = { value: string; label: string };

export type FilterDropdown = {
  /** Read by screen readers; the selected option is what shows. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly FilterOption[];
};

export type FilterBarProps = {
  search?: { value: string; onChange: (value: string) => void; placeholder?: string };
  date?: {
    value: DateFilter;
    onChange: (value: DateFilter) => void;
    /** `presets` is the button row from the report frames; `select` is the compact list from Orders and Stock. */
    variant?: "presets" | "select";
    presets?: readonly DatePreset[];
  };
  branch?: FilterDropdown;
  /** Two at most, so the bar stays on one line. */
  dropdowns?: readonly [FilterDropdown] | readonly [FilterDropdown, FilterDropdown];
  onApply?: () => void;
  onExport?: () => void;
  exportLabel?: string;
  className?: string;
};

export function FilterBar({ search, date, branch, dropdowns, onApply, onExport, exportLabel, className }: FilterBarProps) {
  const t = useStaffSection(kitCopy);
  const presets = date?.presets ?? DATE_PRESETS;
  const pick = (preset: DatePreset) => date?.onChange(withPreset(date.value, preset));
  const lists = [branch, ...(dropdowns ?? [])].filter((list): list is FilterDropdown => Boolean(list));

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {search ? (
        <Input
          icon={Search}
          type="search"
          value={search.value}
          onChange={(event) => search.onChange(event.target.value)}
          placeholder={search.placeholder ?? t.search}
          aria-label={search.placeholder ?? t.search}
          className="min-w-52 flex-1"
        />
      ) : null}
      {date && (date.variant ?? "presets") === "presets" ? (
        <SegmentedControl
          label={t.dateRange}
          value={date.value.preset}
          onValueChange={pick}
          items={presets.map((preset) => ({
            value: preset,
            label: t.presets[preset],
            icon: preset === "custom" ? Calendar : undefined,
          }))}
        />
      ) : null}
      {date && date.variant === "select" ? (
        <Select
          icon={Calendar}
          aria-label={t.dateRange}
          value={date.value.preset}
          onChange={(event) => pick(event.target.value as DatePreset)}
          className="w-[170px]"
        >
          {presets.map((preset) => (
            <option key={preset} value={preset}>
              {t.presets[preset]}
            </option>
          ))}
        </Select>
      ) : null}
      {date?.value.preset === "custom" ? (
        <>
          <Input
            type="date"
            aria-label={t.from}
            value={date.value.from}
            max={date.value.to || undefined}
            onChange={(event) => date.onChange({ ...date.value, from: event.target.value })}
            className="w-40"
          />
          <Input
            type="date"
            aria-label={t.to}
            value={date.value.to}
            min={date.value.from || undefined}
            onChange={(event) => date.onChange({ ...date.value, to: event.target.value })}
            className="w-40"
          />
        </>
      ) : null}
      {lists.map((list) => (
        <Select
          key={list.label}
          aria-label={list.label}
          value={list.value}
          onChange={(event) => list.onChange(event.target.value)}
          className="w-[170px]"
        >
          {list.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      ))}
      {search ? null : <span aria-hidden className="hidden flex-1 md:block" />}
      {onApply ? (
        <Button variant="secondary" size="field" onClick={onApply}>
          {t.apply}
        </Button>
      ) : null}
      {onExport ? (
        <Button variant="secondary" size="field" onClick={onExport}>
          <Download aria-hidden />
          {exportLabel ?? t.export}
        </Button>
      ) : null}
    </div>
  );
}
