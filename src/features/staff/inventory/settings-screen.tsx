"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ops/page-header";
import { LoadingState, QueryErrorState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { useLocale } from "@/lib/i18n/locale-store";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { InventoryFrame, primaryButton, useStaffNames } from "./chrome";

export function SettingsScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const branchId = useScope((state) => state.branchId) ?? "";
  const names = useStaffNames();
  const [negative, setNegative] = useState(true);
  const [soldOut, setSoldOut] = useState(false);
  const [alerts, setAlerts] = useState<string[]>([]);
  const settings = useQuery({
    queryKey: ["inventory", "settings", branchId],
    enabled: Boolean(branchId),
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
      {settings.data ? (
        <form className="grid max-w-xl gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
          <label className="grid gap-1 text-sm">
            <span className="flex items-center gap-2"><input type="checkbox" checked={negative} onChange={(event) => setNegative(event.target.checked)} />{t.settings.negative}</span>
            <span className="text-muted-foreground">{t.settings.negativeHint}</span>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="flex items-center gap-2"><input type="checkbox" checked={soldOut} onChange={(event) => setSoldOut(event.target.checked)} />{t.settings.soldOut}</span>
            <span className="text-muted-foreground">{t.settings.soldOutHint}</span>
          </label>
          <fieldset className="grid gap-2">
            <legend className="text-sm">{t.settings.alerts}</legend>
            {(names.data ?? []).map((person) => (
              <label key={person.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={alerts.includes(person.id)}
                  onChange={(event) => setAlerts(event.target.checked ? [...alerts, person.id] : alerts.filter((id) => id !== person.id))}
                />
                {person.name}
              </label>
            ))}
          </fieldset>
          <button type="submit" className={primaryButton} disabled={save.isPending}>{t.settings.save}</button>
        </form>
      ) : null}
    </InventoryFrame>
  );
}
