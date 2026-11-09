"use client";

import { useMutation } from "@tanstack/react-query";
import { cn } from "cn";
import { Plus, Trash2 } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ops/kit/button";
import { ConfirmDialog } from "@/components/ops/kit/confirm-dialog";
import { Input, Switch } from "@/components/ops/kit/field";
import { formatAmount } from "@/components/ops/kit/money";
import { SegmentedControl } from "@/components/ops/kit/segmented";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { menuChoicesCopy } from "@/lib/i18n/staff/menu-choices";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

import { MAX_PICKS, PRESET_RULES, cleanPrice, limitsOf, ruleOf, type ChoiceRule } from "./choice-rules";

type Group = components["schemas"]["ModifierGroupResponse"];
type Option = components["schemas"]["ModifierOptionResponse"];
type Copy = (typeof menuChoicesCopy)["en"];

/**
 * The item sheet is itself a form, so these add-rows can't be forms. Enter in one of their fields
 * adds the group or choice instead of saving the whole item.
 */
function onEnter(action: () => void) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    action();
  };
}

function ruleSummary(rule: ChoiceRule, t: Copy): string {
  if (!rule.several) return rule.required ? t.ruleRequiredOne : t.ruleOptionalOne;
  return fill(rule.required ? t.ruleRequiredMany : t.ruleOptionalMany, { max: rule.max });
}

/** Read-only view for people who can see choices but not change them. */
export function ChoicesSummary({ groups }: { groups: readonly Group[] }) {
  const t = useStaffSection(menuChoicesCopy);
  const { locale } = useLocale();
  if (groups.length === 0) return <p className="text-sm text-ink-secondary">{t.empty}</p>;
  return (
    <ul className="grid gap-3">
      {groups.map((group) => (
        <li key={group.id} className="overflow-hidden rounded-staff border border-border">
          <div className="flex items-baseline justify-between gap-3 border-b border-border bg-subtle px-3 py-2">
            <span className="text-sm font-semibold text-ink">{group.name}</span>
            <span className="text-xs text-ink-secondary">{ruleSummary(ruleOf(group.min_choices, group.max_choices), t)}</span>
          </div>
          <ul className="divide-y divide-border">
            {(group.options ?? []).map((option) => (
              <li key={option.id} className={cn("flex justify-between gap-3 px-3 py-2 text-sm", !option.is_available && "text-ink-secondary line-through")}>
                {option.name}
                <span className="tabular-nums text-ink-secondary">{Number(option.price_delta) > 0 ? `+${formatAmount(option.price_delta, undefined, locale)}` : t.free}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/** Add-ons for one saved item: groups with their rules, and the choices inside each. */
export function ChoicesEditor({ itemId, groups, onDone }: { itemId: string; groups: readonly Group[]; onDone: () => void }) {
  const t = useStaffSection(menuChoicesCopy);
  const [groupEn, setGroupEn] = useState("");
  const [groupAr, setGroupAr] = useState("");
  const [rule, setRule] = useState<ChoiceRule>({ required: false, several: false, max: 1 });

  const createGroup = useMutation({
    mutationFn: async (input: { en: string; ar: string; rule: ChoiceRule }) => {
      const result = await browserApi.POST("/api/v1/staff/menu/items/{item_id}/modifier-groups", {
        params: { path: { item_id: itemId } },
        body: { name: { en: input.en, ar: input.ar || input.en }, ...limitsOf(input.rule) },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.groupFailed);
    },
    onSuccess: () => {
      toast.success(t.groupAdded);
      setGroupEn("");
      setGroupAr("");
      setRule({ required: false, several: false, max: 1 });
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const existing = new Set(groups.map((group) => group.name.trim().toLowerCase()));
  const presets = (Object.keys(PRESET_RULES) as (keyof typeof PRESET_RULES)[]).filter(
    (key) => !existing.has(t.presets[key].en.toLowerCase()) && !existing.has(t.presets[key].ar),
  );

  const submit = () => {
    if (!groupEn.trim()) return void toast.error(t.needName);
    if (!createGroup.isPending) createGroup.mutate({ en: groupEn.trim(), ar: groupAr.trim(), rule });
  };

  return (
    <div className="grid gap-4">
      {groups.length === 0 ? <p className="text-sm text-ink-secondary">{t.empty}</p> : null}
      {groups.map((group) => (
        <GroupCard key={group.id} group={group} onDone={onDone} />
      ))}

      <div role="group" aria-label={t.newGroup} onKeyDown={onEnter(submit)} className="grid gap-3 rounded-staff border border-dashed border-ink/20 bg-subtle p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-ink">{t.newGroup}</span>
          {presets.length > 0 ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-ink-secondary">{t.quickStart}</span>
              {presets.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={createGroup.isPending}
                  onClick={() => createGroup.mutate({ en: t.presets[key].en, ar: t.presets[key].ar, rule: PRESET_RULES[key] })}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-canvas px-2.5 text-xs font-medium text-ink transition-colors hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
                >
                  <Plus aria-hidden className="size-3" />
                  {t.presets[key].label}
                </button>
              ))}
            </span>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input aria-label={t.groupEn} placeholder={t.groupEn} value={groupEn} onChange={(event) => setGroupEn(event.target.value)} />
          <Input aria-label={t.groupAr} placeholder={t.groupAr} dir="rtl" value={groupAr} onChange={(event) => setGroupAr(event.target.value)} />
        </div>
        <RuleControls rule={rule} onChange={setRule} />
        <Button size="field" className="w-fit" disabled={!groupEn.trim() || createGroup.isPending} onClick={submit}>
          <Plus aria-hidden />
          {createGroup.isPending ? t.adding : t.addGroup}
        </Button>
      </div>
    </div>
  );
}

function RuleControls({ rule, onChange, disabled = false }: { rule: ChoiceRule; onChange: (rule: ChoiceRule) => void; disabled?: boolean }) {
  const t = useStaffSection(menuChoicesCopy);
  return (
    <div className={cn("flex flex-wrap items-center gap-2", disabled && "pointer-events-none opacity-60")}>
      <SegmentedControl<"required" | "optional">
        label={t.required}
        value={rule.required ? "required" : "optional"}
        onValueChange={(value) => onChange({ ...rule, required: value === "required" })}
        items={[
          { value: "optional", label: t.optional },
          { value: "required", label: t.required },
        ]}
      />
      <SegmentedControl<"one" | "several">
        label={t.pickSeveral}
        value={rule.several ? "several" : "one"}
        onValueChange={(value) => onChange({ ...rule, several: value === "several", max: value === "several" ? Math.max(rule.max, 2) : 1 })}
        items={[
          { value: "one", label: t.pickOne },
          { value: "several", label: t.pickSeveral },
        ]}
      />
      {rule.several ? (
        <label className="inline-flex items-center gap-2 text-sm text-ink-secondary">
          {t.upTo}
          <select
            className="h-9 rounded-staff border border-border bg-canvas px-2 text-sm text-ink tabular-nums"
            value={rule.max}
            onChange={(event) => onChange({ ...rule, max: Number(event.target.value) })}
          >
            {Array.from({ length: MAX_PICKS - 1 }, (_, index) => index + 2).map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

function GroupCard({ group, onDone }: { group: Group; onDone: () => void }) {
  const t = useStaffSection(menuChoicesCopy);
  const options = group.options ?? [];
  const rule = ruleOf(group.min_choices, group.max_choices);
  const [confirming, setConfirming] = useState(false);

  const saveRule = useMutation({
    mutationFn: async (next: ChoiceRule) => {
      const result = await browserApi.PATCH("/api/v1/staff/menu/modifier-groups/{group_id}", { params: { path: { group_id: group.id } }, body: limitsOf(next) });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.rulesFailed);
    },
    onSuccess: () => {
      toast.success(t.rulesSaved);
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: async () => {
      const result = await browserApi.DELETE("/api/v1/staff/menu/modifier-groups/{group_id}", { params: { path: { group_id: group.id } } });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.deleteFailed);
    },
    onSuccess: () => {
      toast.success(t.groupDeleted);
      setConfirming(false);
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="overflow-hidden rounded-staff border border-border bg-canvas shadow-card">
      <header className="grid gap-2.5 border-b border-border bg-subtle px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <h4 className="pt-1 text-sm font-semibold text-ink">{group.name}</h4>
          <Button size="icon" variant="ghost" className="-me-2 -mt-1.5 size-9 text-ink-secondary hover:text-danger" aria-label={t.deleteGroup} title={t.deleteGroup} onClick={() => setConfirming(true)}>
            <Trash2 aria-hidden className="size-4" />
          </Button>
        </div>
        <RuleControls rule={rule} onChange={(next) => saveRule.mutate(next)} disabled={saveRule.isPending} />
      </header>
      {options.length === 0 ? <p className="px-3 pt-3 text-xs text-ink-secondary">{t.noOptions}</p> : null}
      <ul className="divide-y divide-border">
        {options.map((option) => (
          <OptionRow key={option.id} option={option} onDone={onDone} />
        ))}
      </ul>
      <AddOption groupId={group.id} onDone={onDone} />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={fill(t.deleteGroupTitle, { name: group.name })}
        body={fill(t.deleteGroupBody, { count: options.length })}
        confirmLabel={t.deleteGroup}
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </section>
  );
}

function OptionRow({ option, onDone }: { option: Option; onDone: () => void }) {
  const t = useStaffSection(menuChoicesCopy);
  const [price, setPrice] = useState(Number(option.price_delta) ? option.price_delta : "");
  const [bad, setBad] = useState(false);

  const savePrice = useMutation({
    mutationFn: async (value: string) => {
      const result = await browserApi.PATCH("/api/v1/staff/menu/modifier-options/{option_id}", { params: { path: { option_id: option.id } }, body: { price_delta: value } });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.priceFailed);
    },
    onSuccess: () => {
      toast.success(t.priceSaved);
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const toggle = useMutation({
    mutationFn: async (is_available: boolean) => {
      const result = await browserApi.PATCH("/api/v1/staff/menu/modifier-options/{option_id}/availability", { params: { path: { option_id: option.id } }, body: { is_available } });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.priceFailed);
    },
    onSuccess: () => onDone(),
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: async () => {
      const result = await browserApi.DELETE("/api/v1/staff/menu/modifier-options/{option_id}", { params: { path: { option_id: option.id } } });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.deleteFailed);
    },
    onSuccess: () => {
      toast.success(t.choiceDeleted);
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Saves when the field is left or Enter is pressed, only if the price really changed.
  const commit = () => {
    const value = cleanPrice(price);
    setBad(value === null);
    if (value === null || Number(value) === Number(option.price_delta)) return;
    savePrice.mutate(value);
  };

  return (
    <li className={cn("flex items-center gap-2 px-3 py-2", !option.is_available && "bg-subtle")}>
      <span className={cn("min-w-0 flex-1 truncate text-sm", option.is_available ? "text-ink" : "text-ink-secondary line-through")}>{option.name}</span>
      <label className="relative w-28 shrink-0">
        <span className="sr-only">{fill(t.extraPriceFor, { name: option.name })}</span>
        <span aria-hidden className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-ink-secondary">
          +
        </span>
        <Input
          className="h-9 ps-6 tabular-nums"
          inputMode="decimal"
          placeholder={t.free}
          value={price}
          aria-invalid={bad || undefined}
          title={bad ? t.badPrice : undefined}
          onChange={(event) => {
            setBad(false);
            setPrice(event.target.value);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
        />
      </label>
      <span className="flex shrink-0 items-center gap-1.5" title={option.is_available ? t.available : t.soldOut}>
        <Switch checked={option.is_available} disabled={toggle.isPending} onCheckedChange={(next) => toggle.mutate(next)} aria-label={fill(t.availableFor, { name: option.name })} />
      </span>
      <Button
        size="icon"
        variant="ghost"
        className="size-9 shrink-0 text-ink-secondary hover:text-danger"
        aria-label={fill(t.deleteChoice, { name: option.name })}
        title={fill(t.deleteChoice, { name: option.name })}
        disabled={remove.isPending}
        onClick={() => remove.mutate()}
      >
        <Trash2 aria-hidden className="size-4" />
      </Button>
    </li>
  );
}

function AddOption({ groupId, onDone }: { groupId: string; onDone: () => void }) {
  const t = useStaffSection(menuChoicesCopy);
  const [en, setEn] = useState("");
  const [ar, setAr] = useState("");
  const [price, setPrice] = useState("");
  const create = useMutation({
    mutationFn: async (value: string) => {
      const result = await browserApi.POST("/api/v1/staff/menu/modifier-groups/{group_id}/options", {
        params: { path: { group_id: groupId } },
        body: { name: { en: en.trim(), ar: ar.trim() || en.trim() }, price_delta: value, is_available: true },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.choiceFailed);
    },
    onSuccess: () => {
      toast.success(t.choiceAdded);
      setEn("");
      setAr("");
      setPrice("");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const submit = () => {
    if (!en.trim()) return void toast.error(t.needName);
    const value = cleanPrice(price);
    if (value === null) return void toast.error(t.badPrice);
    if (!create.isPending) create.mutate(value);
  };
  return (
    <div
      role="group"
      aria-label={t.addChoice}
      onKeyDown={onEnter(submit)}
      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 border-t border-border px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_auto]"
    >
      <Input className="h-9" aria-label={t.choiceEn} placeholder={t.choiceEn} value={en} onChange={(event) => setEn(event.target.value)} />
      <Input className="h-9" aria-label={t.choiceAr} placeholder={t.choiceAr} dir="rtl" value={ar} onChange={(event) => setAr(event.target.value)} />
      <label className="relative">
        <span className="sr-only">{t.extraPrice}</span>
        <span aria-hidden className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-ink-secondary">
          +
        </span>
        <Input className="h-9 ps-6 tabular-nums" inputMode="decimal" placeholder={t.free} value={price} onChange={(event) => setPrice(event.target.value)} />
      </label>
      <Button variant="secondary" size="sm" className="h-9" disabled={!en.trim() || create.isPending} onClick={submit}>
        <Plus aria-hidden />
        {t.addChoice}
      </Button>
    </div>
  );
}
