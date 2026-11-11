"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ops/kit/field";
import { PageHeader } from "@/components/ops/page-header";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { formatCairoDateTime } from "@/lib/format/time";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { canOpenInventoryPage } from "./access";
import { InventoryFrame, primaryButton, useStaffNames } from "./chrome";

export function SettingsScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const allowed = Boolean(me && canOpenInventoryPage(me.role, "settings"));
  const branchId = useScope((state) => state.branchId) ?? "";
  const names = useStaffNames();
  const [negative, setNegative] = useState(true);
  const [soldOut, setSoldOut] = useState(false);
  const [alerts, setAlerts] = useState<string[]>([]);
  const soldOutItems = useQuery({
    queryKey: ["inventory", "sold-out", branchId],
    enabled: allowed && Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/branches/{branch_id}/sold-out", {
        params: { path: { branch_id: branchId } as unknown as undefined },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const settings = useQuery({
    queryKey: ["inventory", "settings", branchId],
    enabled: allowed && Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/branches/{branch_id}/settings", {
        params: { path: { branch_id: branchId } as unknown as undefined },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data;
    },
  });
  useEffect(() => {
    if (!settings.data) return;
    setNegative(settings.data.allow_negative_stock);
    setSoldOut(settings.data.auto_sold_out);
    setAlerts(settings.data.alert_user_ids ?? []);
  }, [settings.data]);
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      const result = await browserApi.PUT("/api/v1/inventory/branches/{branch_id}/settings", {
        params: { path: { branch_id: branchId } as unknown as undefined },
        body: { allow_negative_stock: negative, auto_sold_out: soldOut, alert_user_ids: alerts },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.saved);
      await queryClient.invalidateQueries({ queryKey: ["inventory", "settings", branchId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });

  return (
    <InventoryFrame page="settings">
      <PageHeader title={t.settings.title} detail={t.settings.detail} />
      {settings.isLoading ? <LoadingState label={t.loading} /> : null}
      {settings.isError ? <QueryErrorState error={settings.error} screen={t.tabs.settings} onRetry={() => void settings.refetch()} /> : null}
      <div className="grid items-start gap-4 xl:grid-cols-2">
        {settings.data ? (
          <form
            className="grid gap-4 rounded-[16px] border border-border bg-canvas p-5"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <ul className="grid divide-y divide-border overflow-hidden rounded-[12px] border border-border">
              {(
                [
                  [t.settings.negative, t.settings.negativeHint, negative, setNegative],
                  [t.settings.soldOut, t.settings.soldOutHint, soldOut, setSoldOut],
                ] as const
              ).map(([label, help, value, set]) => (
                <li key={label} className="flex items-start justify-between gap-4 px-4 py-3">
                  <span className="grid gap-0.5">
                    <span className="text-sm font-medium text-ink">{label}</span>
                    <span className="text-xs leading-5 text-ink-secondary">{help}</span>
                  </span>
                  <Switch aria-label={label} checked={value} onCheckedChange={set} className="mt-0.5" />
                </li>
              ))}
            </ul>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium text-ink">{t.settings.alerts}</legend>
              <div className="flex flex-wrap gap-2">
                {(names.data ?? []).map((person) => {
                  const on = alerts.includes(person.id);
                  return (
                    <label
                      key={person.id}
                      className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus ${on ? "border-brand bg-brand text-on-brand" : "border-border hover:bg-subtle"}`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        onChange={(event) => setAlerts(event.target.checked ? [...alerts, person.id] : alerts.filter((id) => id !== person.id))}
                      />
                      {person.name}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="flex justify-end border-t border-border pt-4">
              <button type="submit" className={`${primaryButton} rounded-full`} disabled={save.isPending}>
                {t.settings.save}
              </button>
            </div>
          </form>
        ) : null}
        <section className="grid gap-3 rounded-[16px] border border-border bg-canvas p-5">
          <h2 className="text-sm font-semibold">{t.settings.forced}</h2>
          {soldOutItems.isLoading ? <LoadingState label={t.loading} /> : null}
          {soldOutItems.isError ? <QueryErrorState error={soldOutItems.error} screen={t.tabs.settings} onRetry={() => void soldOutItems.refetch()} /> : null}
          {soldOutItems.data && soldOutItems.data.length === 0 ? <EmptyState title={t.settings.forcedEmpty} body={t.settings.soldOutHint} /> : null}
          {soldOutItems.data && soldOutItems.data.length > 0 ? (
            <ul className="grid gap-1 text-sm">
              {soldOutItems.data.map((item) => (
                <li key={item.menu_item_id} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0">
                  <span>{pickLocale(item.name, locale)}</span>
                  <span className="text-ink-secondary">
                    {t.settings.since} {formatCairoDateTime(item.since, locale)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </InventoryFrame>
  );
}
