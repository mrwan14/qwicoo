"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ops/kit/badge";
import { Button } from "@/components/ops/kit/button";
import { Card } from "@/components/ops/kit/card";
import { Field, Input } from "@/components/ops/kit/field";
import { LocaleText } from "@/components/ops/locale-text";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { menuCopy } from "@/lib/i18n/staff/menu";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { names, stationCode } from "./shared";

/** Kitchen stations: where items are prepared, and which kitchen screen shows them. */
export function StationsTab() {
  const t = useStaffSection(menuCopy);
  const branchId = useScope((state) => state.branchId);
  const [en, setEn] = useState("");
  const code = stationCode(en);
  const stations = useQuery({
    queryKey: ["stations", branchId],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/staff/kitchen-stations");
      if (!result.response.ok || !result.data) return [];
      return result.data;
    },
  });
  const create = useMutation({
    mutationFn: async () => {
      if (!code) throw new Error(t.stationLetters);
      const body: components["schemas"]["CreateKitchenStationRequest"] = { name: names(en, en), code, is_active: true };
      const result = await browserApi.POST("/api/v1/staff/kitchen-stations", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotCreateStation);
    },
    onSuccess: () => {
      toast.success(t.stationSaved);
      setEn("");
      void stations.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card title={t.hub.tabs.stations} description={t.stationIntro}>
        {(stations.data ?? []).length === 0 ? (
          <p className="text-sm text-ink-secondary">{t.hub.none}</p>
        ) : (
          <ul className="-my-1">
            {(stations.data ?? []).map((station) => (
              <li key={station.id} className="flex min-h-12 items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0">
                <span className="font-medium text-ink">
                  <LocaleText value={station.name} />
                </span>
                <Badge>{station.code}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={t.addStation}>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <Field label={t.stationName} hint={code ? fill(t.codeSaved, { code }) : t.codeHint}>
            <Input placeholder={t.stationPlaceholder} value={en} onChange={(event) => setEn(event.target.value)} required />
          </Field>
          <Button type="submit" disabled={!code || create.isPending}>
            {create.isPending ? t.adding : t.addStation}
          </Button>
        </form>
      </Card>
    </div>
  );
}
