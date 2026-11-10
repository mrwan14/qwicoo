"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { CalendarClock, Check, Lock, Plus, Radio } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ops/kit/badge";
import { Button } from "@/components/ops/kit/button";
import { ConfirmDialog } from "@/components/ops/kit/confirm-dialog";
import { EmptyState } from "@/components/ops/kit/empty-state";
import { Field, Input, Switch } from "@/components/ops/kit/field";
import { SidePanel } from "@/components/ops/kit/side-panel";
import { useStaffSession } from "@/components/ops/staff-session";
import { useBrandMenus, useMenuTree } from "@/features/staff/menu/shared";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { can } from "@/lib/auth/permissions";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { menuCopy } from "@/lib/i18n/staff/menu";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

type Menu = components["schemas"]["MenuResponse"];
type Copy = (typeof menuCopy)["en"]["menus"];

/** ISO weekdays (1 = Monday … 7 = Sunday), listed from Saturday like a week in Egypt. */
const WEEK = [6, 7, 1, 2, 3, 4, 5] as const;
const SCHEDULING_FEATURE = "MULTI_MENU_SCHEDULING";

type Draft = {
  id: string | null;
  nameEn: string;
  nameAr: string;
  isActive: boolean;
  categoryIds: string[];
  days: number[];
  timeFrom: string;
  timeTo: string;
  startDate: string;
  endDate: string;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");
const hhmm = (value: unknown) => text(value).slice(0, 5);

function rulesOf(menu: Menu) {
  const rules = (menu.schedule_rules ?? {}) as Record<string, unknown>;
  const days = Array.isArray(rules.days_of_week) ? rules.days_of_week.filter((day): day is number => typeof day === "number") : [];
  return { days, timeFrom: hhmm(rules.time_from), timeTo: hhmm(rules.time_to), startDate: text(rules.start_date), endDate: text(rules.end_date) };
}

function draftFrom(menu: Menu | null): Draft {
  if (!menu) {
    return { id: null, nameEn: "", nameAr: "", isActive: true, categoryIds: [], days: [], timeFrom: "", timeTo: "", startDate: "", endDate: "" };
  }
  return { id: menu.id, nameEn: menu.name_en, nameAr: menu.name_ar, isActive: menu.is_active, categoryIds: menu.category_ids ?? [], ...rulesOf(menu) };
}

function hasSchedule(draft: Pick<Draft, "days" | "timeFrom" | "timeTo" | "startDate" | "endDate">) {
  return draft.days.length > 0 || Boolean(draft.timeFrom || draft.timeTo || draft.startDate || draft.endDate);
}

function weekdayName(isoDay: number, locale: string) {
  // 1 Jan 2024 was a Monday, so 1 + offset lines up with ISO weekdays.
  return new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, isoDay)));
}

function dateLabel(value: string, locale: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

/** "Sat, Sun · 07:00–11:00 · From 1 Mar" — or "No schedule" when the menu has none. */
function scheduleSummary(menu: Menu, t: Copy, locale: string) {
  const rules = rulesOf(menu);
  if (!hasSchedule(rules)) return t.always;
  const parts: string[] = [];
  parts.push(rules.days.length === 0 || rules.days.length === 7 ? t.everyDay : WEEK.filter((day) => rules.days.includes(day)).map((day) => weekdayName(day, locale)).join(", "));
  parts.push(rules.timeFrom && rules.timeTo ? `${rules.timeFrom}–${rules.timeTo}` : t.allDay);
  if (rules.startDate) parts.push(fill(t.from, { date: dateLabel(rules.startDate, locale) }));
  if (rules.endDate) parts.push(fill(t.until, { date: dateLabel(rules.endDate, locale) }));
  return parts.join(" · ");
}

/** Plan limits come back as bare codes; turn them into a sentence staff can act on. */
function lockMessage(error: unknown, t: Copy): string | null {
  const detail = error && typeof error === "object" && "detail" in error ? (error as { detail: unknown }).detail : null;
  if (detail === "SCHEDULING_FEATURE_LOCKED") return t.lockedSchedule;
  if (detail === "MULTI_MENU_TIER_REQUIRED") return t.lockedMulti;
  return null;
}

/** Menu → Menus: brand menus that group categories and decide when guests and the till see them. */
export function MenusScreen() {
  const all = useStaffSection(menuCopy);
  const t = all.menus;
  const { locale } = useLocale();
  const me = useStaffSession();
  const brandId = useScope((state) => state.brandId);
  const queryClient = useQueryClient();
  const canEdit = can(me?.role, "menu.sharedItems");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<Menu | null>(null);
  const tree = useMenuTree(all.menuFailed);

  const menus = useBrandMenus(t.loadFailed);
  // Plan check, best effort: if the list can't be read, the server still refuses a locked schedule on save.
  const features = useQuery({
    queryKey: ["features-brand", brandId],
    enabled: Boolean(brandId) && canEdit,
    retry: false,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/features/brand/{brand_id}", { params: { path: { brand_id: brandId ?? "" } } });
      if (!result.response.ok || !result.data) return null;
      return result.data.items;
    },
  });
  const scheduleLocked = features.data ? !features.data.some((feature) => feature.feature_key === SCHEDULING_FEATURE && feature.is_enabled_by_super_admin) : false;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["menus"] });
    void queryClient.invalidateQueries({ queryKey: ["menu-tree"] });
  };

  const save = useMutation({
    mutationFn: async (next: Draft) => {
      const schedule = {
        days_of_week: next.days.length > 0 && next.days.length < 7 ? [...next.days].sort() : null,
        time_from: next.timeFrom || null,
        time_to: next.timeTo || null,
        start_date: next.startDate || null,
        end_date: next.endDate || null,
      };
      const fields = { name_en: next.nameEn.trim(), name_ar: next.nameAr.trim(), is_active: next.isActive };
      let id = next.id;
      if (id) {
        const result = await browserApi.PATCH("/api/v1/menus/{menu_id}", { params: { path: { menu_id: id } }, body: { ...fields, schedule_rules: schedule } });
        if (!result.response.ok) throw new Error(lockMessage(result.error, t) ?? asApiError(result.error, result.response, t.saveFailed).message);
      } else {
        const body: components["schemas"]["MenuCreate"] = { ...fields, brand_id: brandId, menu_type: "STANDARD", schedule_rules: hasSchedule(next) ? schedule : null };
        const result = await browserApi.POST("/api/v1/menus", { body });
        if (!result.response.ok || !result.data) throw new Error(lockMessage(result.error, t) ?? asApiError(result.error, result.response, t.saveFailed).message);
        id = result.data.id;
      }
      const linked = await browserApi.PUT("/api/v1/menus/{menu_id}/categories", { params: { path: { menu_id: id } }, body: { category_ids: next.categoryIds } });
      if (!linked.response.ok) throw asApiError(linked.error, linked.response, t.saveFailed);
    },
    onSuccess: () => {
      toast.success(t.saved);
      setDraft(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ menu, on }: { menu: Menu; on: boolean }) => {
      const result = await browserApi.PATCH("/api/v1/menus/{menu_id}", { params: { path: { menu_id: menu.id } }, body: { is_active: on } });
      if (!result.response.ok) throw new Error(lockMessage(result.error, t) ?? asApiError(result.error, result.response, t.saveFailed).message);
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (menu: Menu) => {
      const result = await browserApi.DELETE("/api/v1/menus/{menu_id}", { params: { path: { menu_id: menu.id } } });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.deleteFailed);
    },
    onSuccess: () => {
      toast.success(t.deleted);
      setDeleting(null);
      setDraft(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const categories = tree.data?.categories ?? [];
  const categoryName = (id: string) => pickLocale(categories.find((category) => category.id === id)?.name, locale);
  const menuName = (menu: Menu) => (locale === "ar" ? menu.name_ar || menu.name_en : menu.name_en || menu.name_ar);
  const list = menus.data ?? [];
  const filtering = list.filter((menu) => menu.is_active && (menu.category_ids ?? []).length > 0);
  const live = filtering.filter((menu) => menu.is_live);

  if (menus.isError) return <p className="text-sm text-danger">{menus.error.message}</p>;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-secondary">{t.intro}</p>
        {canEdit ? (
          <Button onClick={() => setDraft(draftFrom(null))} disabled={!brandId}>
            <Plus aria-hidden />
            {t.newMenu}
          </Button>
        ) : (
          <p className="text-sm text-ink-secondary">{t.readOnly}</p>
        )}
      </div>

      {filtering.length > 0 ? (
        <div className={cn("flex items-start gap-2.5 rounded-staff px-4 py-3 text-sm text-ink", live.length > 0 ? "bg-success-bg" : "bg-well")}>
          <Radio aria-hidden className={cn("mt-0.5 size-4 shrink-0", live.length > 0 ? "text-success" : "text-ink-secondary")} />
          <span>{live.length > 0 ? fill(t.guestsSeeNow, { names: live.map(menuName).join(", ") }) : t.guestsSeeAll}</span>
        </div>
      ) : null}

      {menus.isLoading ? null : list.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t.emptyTitle} body={t.emptyBody} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {list.map((menu) => {
            const ids = menu.category_ids ?? [];
            return (
              <li key={menu.id} className="grid gap-3 rounded-staff bg-canvas p-4 shadow-card ring-1 ring-black/5">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="grid min-w-0 gap-1 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-default"
                    onClick={() => setDraft(draftFrom(menu))}
                    disabled={!canEdit}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-ink">{menuName(menu)}</span>
                      {!menu.is_active ? <Badge>{t.off}</Badge> : menu.is_live ? <Badge tone="success">{t.liveNow}</Badge> : <Badge tone="info">{t.notNow}</Badge>}
                    </span>
                    <span className="flex items-center gap-1.5 text-sm text-ink-secondary">
                      <CalendarClock aria-hidden className="size-3.5 shrink-0" />
                      {scheduleSummary(menu, t, locale)}
                    </span>
                  </button>
                  {canEdit ? (
                    <Switch
                      checked={menu.is_active}
                      onCheckedChange={(on) => toggle.mutate({ menu, on })}
                      disabled={toggle.isPending}
                      aria-label={`${t.onLabel}: ${menuName(menu)}`}
                    />
                  ) : null}
                </div>
                {ids.length === 0 ? (
                  <p className="text-sm text-ink-secondary">{t.noCategories}</p>
                ) : (
                  <div className="grid gap-1.5">
                    <span className="text-xs font-medium text-ink-secondary">{ids.length === 1 ? t.oneCategory : fill(t.categoriesCount, { count: ids.length })}</span>
                    <ul className="flex flex-wrap gap-1.5">
                      {ids.map((id) => (
                        <li key={id} className="rounded-staff bg-well px-2.5 py-1 text-[13px] text-ink">
                          {categoryName(id) || "—"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {list.length > 0 ? <p className="text-xs text-ink-secondary">{t.fullMenuNote}</p> : null}

      {draft ? (
        <MenuEditor
          draft={draft}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSave={() => save.mutate(draft)}
          onDelete={() => setDeleting(list.find((menu) => menu.id === draft.id) ?? null)}
          saving={save.isPending}
          scheduleLocked={scheduleLocked}
          categories={categories.map((category) => ({ id: category.id, name: pickLocale(category.name, locale) }))}
          locale={locale}
          t={t}
          englishName={all.englishName}
          arabicName={all.arabicName}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t.deleteTitle}
        body={t.deleteBody}
        confirmLabel={t.delete}
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  );
}

function MenuEditor({
  draft,
  onChange,
  onClose,
  onSave,
  onDelete,
  saving,
  scheduleLocked,
  categories,
  locale,
  t,
  englishName,
  arabicName,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
  scheduleLocked: boolean;
  categories: { id: string; name: string }[];
  locale: string;
  t: Copy;
  englishName: string;
  arabicName: string;
}) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const toggleIn = (list: number[], value: number) => (list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]);
  const toggleCategory = (id: string) =>
    set({ categoryIds: draft.categoryIds.includes(id) ? draft.categoryIds.filter((entry) => entry !== id) : [...draft.categoryIds, id] });

  const problem = !draft.nameEn.trim() || !draft.nameAr.trim()
    ? t.nameRequired
    : Boolean(draft.timeFrom) !== Boolean(draft.timeTo)
      ? t.timesBoth
      : draft.startDate && draft.endDate && draft.endDate < draft.startDate
        ? t.datesOrder
        : null;
  // A locked plan may keep an existing schedule but not add one.
  const scheduleBlocked = scheduleLocked && hasSchedule(draft);

  const chip = (on: boolean) =>
    cn(
      "inline-flex min-h-10 items-center gap-1.5 rounded-staff border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50",
      on ? "border-brand bg-brand text-on-brand" : "border-border bg-canvas text-ink hover:border-ink/40",
    );

  return (
    <SidePanel
      open
      onOpenChange={(open) => !open && onClose()}
      title={draft.id ? t.editMenu : t.newMenu}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          {draft.id ? (
            <Button variant="dangerGhost" onClick={onDelete}>
              {t.delete}
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={onSave} disabled={saving || Boolean(problem) || scheduleBlocked}>
            {saving ? "…" : t.save}
          </Button>
        </div>
      }
    >
      <div className="grid gap-6">
        <section className="grid gap-3">
          <h3 className="text-sm font-semibold text-ink">{t.name}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={englishName}>
              <Input value={draft.nameEn} onChange={(event) => set({ nameEn: event.target.value })} placeholder="Breakfast" />
            </Field>
            <Field label={arabicName}>
              <Input dir="rtl" value={draft.nameAr} onChange={(event) => set({ nameAr: event.target.value })} placeholder="الفطار" />
            </Field>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-staff bg-well px-3 py-2.5">
            <span className="grid">
              <span className="text-sm font-medium text-ink">{t.onLabel}</span>
              <span className="text-xs text-ink-secondary">{t.onHint}</span>
            </span>
            <Switch checked={draft.isActive} onCheckedChange={(on) => set({ isActive: on })} aria-label={t.onLabel} />
          </div>
        </section>

        <section className="grid gap-2">
          <h3 className="text-sm font-semibold text-ink">{t.whatsIn}</h3>
          <p className="text-xs text-ink-secondary">{t.whatsInHint}</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const on = draft.categoryIds.includes(category.id);
              return (
                <button key={category.id} type="button" aria-pressed={on} className={chip(on)} onClick={() => toggleCategory(category.id)}>
                  {on ? <Check aria-hidden className="size-3.5" /> : null}
                  {category.name}
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            {t.whenLive}
            {scheduleLocked ? <Lock aria-hidden className="size-3.5 text-ink-secondary" /> : null}
          </h3>
          {scheduleLocked ? (
            <p className="flex items-start gap-2 rounded-staff bg-warning-bg px-3 py-2 text-sm text-ink">
              <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              {t.lockedSchedule}
            </p>
          ) : (
            <p className="text-xs text-ink-secondary">{t.whenLiveHint}</p>
          )}
          <fieldset disabled={scheduleLocked && !hasSchedule(draft)} className="grid gap-3 disabled:opacity-60">
            <div role="group" aria-label={t.days} className="grid gap-1.5">
              <span className="text-sm font-medium text-ink">{t.days}</span>
              <div className="flex flex-wrap gap-1.5">
                {WEEK.map((day) => {
                  const on = draft.days.includes(day);
                  return (
                    <button key={day} type="button" aria-pressed={on} className={cn(chip(on), "min-w-14 justify-center px-2")} onClick={() => set({ days: toggleIn(draft.days, day) })}>
                      {weekdayName(day, locale)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t.timeFrom}>
                <Input type="time" value={draft.timeFrom} onChange={(event) => set({ timeFrom: event.target.value })} />
              </Field>
              <Field label={t.timeTo}>
                <Input type="time" value={draft.timeTo} onChange={(event) => set({ timeTo: event.target.value })} />
              </Field>
              <Field label={t.startDate}>
                <Input type="date" value={draft.startDate} onChange={(event) => set({ startDate: event.target.value })} />
              </Field>
              <Field label={t.endDate}>
                <Input type="date" value={draft.endDate} onChange={(event) => set({ endDate: event.target.value })} />
              </Field>
            </div>
          </fieldset>
          <p className="text-xs text-ink-secondary">{t.fullMenuNote}</p>
        </section>

        {problem ? <p className="text-sm text-danger">{problem}</p> : null}
      </div>
    </SidePanel>
  );
}
