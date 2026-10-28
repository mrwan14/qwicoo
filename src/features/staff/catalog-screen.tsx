"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ops/kit/button";
import { Card } from "@/components/ops/kit/card";
import { Field, Input, Select } from "@/components/ops/kit/field";
import { useMenuTree } from "@/features/staff/menu/shared";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { menuCopy } from "@/lib/i18n/staff/menu";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

const COMBO_STATIONS = ["GRILL", "HOT_SIDE", "BEVERAGE", "ASSEMBLY"] as const;

function comboStationLabel(code: string, labels: (typeof menuCopy)["en"]["comboStations"]): string {
  if (code === "GRILL" || code === "HOT_SIDE" || code === "BEVERAGE" || code === "ASSEMBLY") return labels[code];
  return code;
}

/** Menu → Combos: create a combo item, add the items inside it, and manage brand menus. */
export function ComboScreen() {
  const t = useStaffSection(menuCopy);
  const { locale } = useLocale();
  const brandId = useScope((state) => state.brandId);
  const branchId = useScope((state) => state.branchId);
  const queryClient = useQueryClient();
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [parentId, setParentId] = useState("");
  const [comboEn, setComboEn] = useState("");
  const [comboAr, setComboAr] = useState("");
  const [comboPrice, setComboPrice] = useState("0.00");
  const [comboCategoryId, setComboCategoryId] = useState("");
  const [componentId, setComponentId] = useState("");
  const [station, setStation] = useState<(typeof COMBO_STATIONS)[number]>("GRILL");
  const tree = useMenuTree(t.menuFailed);
  const menus = useQuery({
    queryKey: ["menus", brandId],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/menus");
      if (result.response.status === 404) return [];
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.menusFailed);
      return result.data;
    },
  });
  const parts = useQuery({
    queryKey: ["combo", parentId],
    enabled: Boolean(parentId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/menus/items/{item_id}/combo-components", { params: { path: { item_id: parentId } } });
      if (result.response.status === 404) return [];
      if (!result.response.ok || !result.data) return [];
      return result.data;
    },
  });
  const createCombo = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["StaffItemCreate"] = {
        category_id: comboCategoryId,
        name: { en: comboEn, ar: comboAr },
        base_price: comboPrice,
        is_available: true,
        item_type: "COMBO",
      };
      const result = await browserApi.POST("/api/v1/staff/menu/items", { body });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.couldNotCreateCombo);
      return result.data;
    },
    onSuccess: (item) => {
      setParentId(item.id);
      setComboEn("");
      setComboAr("");
      toast.success(t.comboCreated);
      void queryClient.invalidateQueries({ queryKey: ["menu-tree"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const createMenu = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["MenuCreate"] = { name_en: nameEn, name_ar: nameAr, brand_id: brandId, is_active: true, menu_type: "STANDARD" };
      const result = await browserApi.POST("/api/v1/menus", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotCreateMenu);
    },
    onSuccess: () => {
      setNameEn("");
      setNameAr("");
      void queryClient.invalidateQueries({ queryKey: ["menus"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const addComponent = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["ComboComponentCreate"] = { component_item_id: componentId, quantity: 1, target_station: station, is_active: true };
      const result = await browserApi.POST("/api/v1/menus/items/{item_id}/combo-components", { params: { path: { item_id: parentId } }, body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotAddComponent);
    },
    onSuccess: () => {
      setComponentId("");
      void parts.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: async (componentRowId: string) => {
      const result = await browserApi.DELETE("/api/v1/menus/combo-components/{component_id}", { params: { path: { component_id: componentRowId } } });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotRemoveComponent);
    },
    onSuccess: () => void parts.refetch(),
    onError: (error: Error) => toast.error(error.message),
  });

  const categories = tree.data?.categories ?? [];
  const items = categories.flatMap((category) => category.items ?? []);
  const combos = items.filter((item) => item.item_type === "COMBO");
  const nameOf = (id: string) => pickLocale(items.find((item) => item.id === id)?.name, locale) || id.slice(0, 8);

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      {!brandId ? <p className="text-sm text-ink-secondary lg:col-span-2">{t.chooseBrand}</p> : null}
      <Card title={t.newCombo}>
        {!branchId ? <p className="text-sm text-ink-secondary">{t.chooseBranch}</p> : null}
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            createCombo.mutate();
          }}
        >
          <Field label={t.category}>
            <Select value={comboCategoryId} onChange={(event) => setComboCategoryId(event.target.value)} required>
              <option value="">{t.chooseCategory}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {pickLocale(category.name, locale)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t.englishName}>
              <Input value={comboEn} onChange={(event) => setComboEn(event.target.value)} required />
            </Field>
            <Field label={t.arabicName}>
              <Input dir="rtl" value={comboAr} onChange={(event) => setComboAr(event.target.value)} required />
            </Field>
          </div>
          <Field label={t.priceEgp}>
            <Input className="w-40" inputMode="decimal" value={comboPrice} onChange={(event) => setComboPrice(event.target.value)} required />
          </Field>
          <Button type="submit" className="w-fit" disabled={!branchId || createCombo.isPending}>
            {createCombo.isPending ? t.creating : t.createCombo}
          </Button>
        </form>
      </Card>

      <Card title={t.combosHub.components}>
        <Field label={t.combosHub.pickCombo}>
          <Select value={parentId} onChange={(event) => setParentId(event.target.value)}>
            <option value="">{t.combosHub.choose}</option>
            {combos.map((item) => (
              <option key={item.id} value={item.id}>
                {pickLocale(item.name, locale)}
              </option>
            ))}
            {parentId && !combos.some((item) => item.id === parentId) ? <option value={parentId}>{nameOf(parentId)}</option> : null}
          </Select>
        </Field>
        {parentId ? (
          <>
            {(parts.data ?? []).length === 0 ? (
              <p className="text-sm text-ink-secondary">{t.combosHub.noComponents}</p>
            ) : (
              <ul className="-my-1">
                {(parts.data ?? []).map((part) => (
                  <li key={part.id} className="flex min-h-12 items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0">
                    <span className="grid">
                      <span className="font-medium text-ink">{nameOf(part.component_item_id)}</span>
                      <span className="text-xs text-ink-secondary">{comboStationLabel(part.target_station, t.comboStations)}</span>
                    </span>
                    <Button variant="dangerGhost" size="sm" onClick={() => remove.mutate(part.id)} aria-label={`${t.remove} ${nameOf(part.component_item_id)}`}>
                      <Trash2 aria-hidden />
                      {t.remove}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-[1fr_160px]">
              <Field label={t.combosHub.pickComponent}>
                <Select value={componentId} onChange={(event) => setComponentId(event.target.value)}>
                  <option value="">{t.combosHub.choose}</option>
                  {items
                    .filter((item) => item.id !== parentId)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {pickLocale(item.name, locale)}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label={t.station}>
                <Select value={station} onChange={(event) => setStation(event.target.value as typeof station)}>
                  {COMBO_STATIONS.map((value) => (
                    <option key={value} value={value}>
                      {t.comboStations[value]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button variant="secondary" className="w-fit" disabled={!componentId || addComponent.isPending} onClick={() => addComponent.mutate()}>
              {t.addComponent}
            </Button>
          </>
        ) : null}
      </Card>

      <Card title={t.combosHub.menusTitle} className="lg:col-span-2">
        {menus.isError ? <p className="text-sm text-danger">{menus.error.message}</p> : null}
        {(menus.data ?? []).length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {(menus.data ?? []).map((item) => (
              <li key={item.id} className="rounded-staff border border-border bg-subtle px-3 py-2 text-sm text-ink">
                {locale === "ar" ? item.name_ar || item.name_en : item.name_en}
              </li>
            ))}
          </ul>
        ) : null}
        <form
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            createMenu.mutate();
          }}
        >
          <Field label={t.englishName}>
            <Input value={nameEn} onChange={(event) => setNameEn(event.target.value)} placeholder={t.combosHub.newMenu} required />
          </Field>
          <Field label={t.arabicName}>
            <Input dir="rtl" value={nameAr} onChange={(event) => setNameAr(event.target.value)} required />
          </Field>
          <Button type="submit" variant="secondary" size="field" disabled={createMenu.isPending}>
            {t.createMenu}
          </Button>
        </form>
      </Card>
    </div>
  );
}
