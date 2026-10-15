"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { BottomSheet } from "@/features/guest/bottom-sheet";
import { addGuestCartItem, isCartConflict } from "@/features/guest/cart-client";
import {
  cloneSelection,
  configuredLineTotal,
  emptySelection,
  missingGroupName,
  moneyString,
  resizeUnits,
  selectedGroupsPayload,
  selectedOptionIds,
  toggleOption,
  unitIsComplete,
  type ConfigMode,
  type ModifierGroup,
  type UnitSelection,
} from "@/features/guest/item-config";
import { groupChoiceHint } from "@/features/guest/item-options";
import { useOrderingPaused } from "@/features/guest/ordering-status";
import { resumeIfSessionGone } from "@/features/guest/session";
import { guestField, guestPrimaryButton, useGuestCopy } from "@/features/guest/shell";
import { useGuestOrderQuote, type QuoteItemInput } from "@/features/guest/use-guest-quote";
import { asApiError } from "@/lib/api/error";
import { guestApi } from "@/lib/api/guest";
import { formatMoney } from "@/lib/format/money";
import type { components } from "@/lib/api/schema";
import { pickLocale } from "@/lib/i18n/locale-text";
import { mediaUrl } from "@/lib/media";
import { useGuest } from "@/stores/guest";

type MenuItem = components["schemas"]["MenuItemResponse"];

function optionName(value: unknown, locale: "en" | "ar") {
  return pickLocale(value, locale);
}

export function ItemSheet({
  item,
  open,
  onOpenChange,
  currency,
  branchPrice,
  cartVersion,
  triggerRef,
}: {
  item: MenuItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: string;
  branchPrice: string | null;
  cartVersion: number;
  triggerRef?: React.RefObject<HTMLElement | null>;
}) {
  const { t, locale } = useGuestCopy();
  const session = useGuest((state) => state.session);
  const guestName = useGuest((state) => state.guestName);
  const queryClient = useQueryClient();
  const paused = useOrderingPaused();
  const [quantity, setQuantity] = useState(1);
  const [mode, setMode] = useState<ConfigMode>("same");
  const [activeUnit, setActiveUnit] = useState(0);
  const [units, setUnits] = useState<UnitSelection[]>([emptySelection()]);
  const [notes, setNotes] = useState<string[]>([""]);
  const [choiceError, setChoiceError] = useState("");
  const [highlightGroupId, setHighlightGroupId] = useState<string | null>(null);
  const groupRefs = useRef(new Map<string, HTMLElement>());

  const groups = useMemo(
    () => (item?.modifier_groups ?? []) as ModifierGroup[],
    [item?.modifier_groups],
  );
  const base = Number(branchPrice ?? 0);
  const itemId = item?.id ?? null;

  useEffect(() => {
    if (!open || !itemId) return;
    setQuantity(1);
    setMode("same");
    setActiveUnit(0);
    setUnits([emptySelection()]);
    setNotes([""]);
    setChoiceError("");
    setHighlightGroupId(null);
  }, [open, itemId]);

  useEffect(() => {
    setUnits((current) => resizeUnits(current, quantity, mode));
    setNotes((current) => {
      if (mode === "same") return [current[0] ?? ""];
      const next = current.slice(0, quantity);
      while (next.length < quantity) next.push(next[next.length - 1] ?? "");
      return next;
    });
    setActiveUnit((current) => Math.min(current, Math.max(0, quantity - 1)));
  }, [quantity, mode]);

  const workingSelection = units[mode === "same" ? 0 : activeUnit] ?? emptySelection();

  const displayTotal = useMemo(
    () => configuredLineTotal(base, groups, units, quantity, mode),
    [base, groups, units, quantity, mode],
  );

  const allUnitsReady =
    mode === "same"
      ? unitIsComplete(groups, units[0] ?? emptySelection())
      : units.slice(0, quantity).every((selection) => unitIsComplete(groups, selection));

  function updateWorking(next: UnitSelection) {
    setUnits((current) => {
      const copy = current.map(cloneSelection);
      const index = mode === "same" ? 0 : activeUnit;
      copy[index] = next;
      return copy;
    });
  }

  const add = useMutation({
    mutationFn: async () => {
      if (!item) throw new Error(t.oops);
      const name = guestName.trim();
      let version =
        queryClient.getQueryData<{ version?: number }>(["guest-cart", session?.sessionId])?.version ??
        cartVersion;
      let cart = null as Awaited<ReturnType<typeof addGuestCartItem>> | null;

      async function addOne(selection: UnitSelection, qty: number, note: string) {
        const selectedGroups = selectedGroupsPayload(selection);
        const validateBody: components["schemas"]["ValidateItemSelectionRequest"] = {
          item_id: item!.id,
          quantity: qty,
          selected_groups: selectedGroups,
          special_instructions: note || null,
          table_id: session?.tableId,
          guest_label: name || null,
        };
        const validated = await guestApi.POST("/api/v1/menu/validate-item-selection", { body: validateBody });
        if (!validated.response.ok || !validated.data) {
          throw asApiError(validated.error, validated.response, t.oops, locale);
        }
        const body: components["schemas"]["AddCartItemRequest"] = {
          guest_name: name,
          nickname: name,
          item_id: validated.data.item_id,
          item_name: validated.data.item_name,
          unit_price: branchPrice ?? validated.data.base_price,
          quantity: validated.data.quantity,
          notes: note || null,
          modifiers: (validated.data.selected_modifiers ?? []).map((modifier) => ({
            option_id: modifier.option_id,
            name: modifier.name,
            price: modifier.price_delta,
          })),
        };
        cart = await addGuestCartItem(session?.sessionId ?? "", version, body, locale, t.oops);
        version = cart.version;
      }

      if (mode === "same") {
        await addOne(units[0] ?? emptySelection(), quantity, notes[0] ?? "");
      } else {
        for (let index = 0; index < quantity; index += 1) {
          await addOne(units[index] ?? emptySelection(), 1, notes[index] ?? "");
        }
      }
      return cart!;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["guest-cart", session?.sessionId], data);
      toast.success(t.added);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      void resumeIfSessionGone(error).then(async (gone) => {
        if (gone) return;
        if (isCartConflict(error)) {
          await queryClient.invalidateQueries({ queryKey: ["guest-cart"] });
          toast.message(t.cartUpdated);
          return;
        }
        toast.error(error.message);
      });
    },
  });

  const quoteItems = useMemo<QuoteItemInput[] | null>(() => {
    if (!item || mode !== "same" || !allUnitsReady) return null;
    return [
      {
        item_id: item.id,
        quantity,
        selected_option_ids: selectedOptionIds(units[0] ?? emptySelection()),
        special_instructions: notes[0] || null,
      },
    ];
  }, [allUnitsReady, item, mode, notes, quantity, units]);
  const quote = useGuestOrderQuote(quoteItems, t.oops);

  const ctaAmount =
    mode === "same" && quote.data?.total != null ? quote.data.total : moneyString(displayTotal);
  const ctaLabel = t.addWithPrice.replace(
    "{price}",
    formatMoney(ctaAmount, currency, locale),
  );

  function tryAdd() {
    if (!item) return;
    const incompleteIndex =
      mode === "same"
        ? unitIsComplete(groups, units[0] ?? emptySelection())
          ? -1
          : 0
        : units.findIndex((selection, index) => index < quantity && !unitIsComplete(groups, selection));
    if (incompleteIndex >= 0) {
      if (mode === "per") setActiveUnit(incompleteIndex);
      const selection = units[incompleteIndex] ?? emptySelection();
      const missing = missingGroupName(groups, selection, (group) => optionName(group.name, locale));
      const group = groups.find((entry) => optionName(entry.name, locale) === missing);
      setChoiceError(missing ? t.chooseRequired.replace("{name}", missing) : t.pricePending);
      setHighlightGroupId(group?.id ?? null);
      if (group) groupRefs.current.get(group.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setChoiceError("");
    setHighlightGroupId(null);
    add.mutate();
  }

  if (!item) return null;

  const title = optionName(item.name, locale);
  const description = item.description ? optionName(item.description, locale) : "";

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      returnFocusRef={triggerRef}
      footer={
        <div className="flex items-center gap-3">
          <div className="guest-stepper shrink-0">
            <button
              type="button"
              aria-label={t.fewer}
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            >
              −
            </button>
            <span>{quantity}</span>
            <button
              type="button"
              aria-label={t.more}
              onClick={() => setQuantity((current) => current + 1)}
            >
              +
            </button>
          </div>
          <button
            type="button"
            className={`${guestPrimaryButton} !w-auto flex-1`}
            disabled={add.isPending || paused || !guestName.trim()}
            onClick={tryAdd}
          >
            {add.isPending ? t.paying : ctaLabel}
          </button>
        </div>
      }
    >
      <div className="grid gap-4">
        {mediaUrl(item.image_url) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(item.image_url) ?? ""}
            alt=""
            className="guest-thumb max-h-44 w-full object-cover"
          />
        ) : (
          <div className="guest-thumb flex h-32 items-center justify-center text-4xl font-extrabold text-[var(--guest-quiet)]">
            {title.trim().charAt(0).toUpperCase()}
          </div>
        )}
        {description && description !== title ? (
          <p className="guest-body">{description}</p>
        ) : null}
        {branchPrice ? (
          <p className="guest-price guest-price-accent text-base" dir="ltr">
            <Money amount={branchPrice} currency={currency} locale={locale} />
          </p>
        ) : null}

        {quantity > 1 ? (
          <div className="grid gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                data-active={mode === "same" ? "true" : "false"}
                className="guest-cat-tab guest-motion flex-1"
                onClick={() => setMode("same")}
              >
                {t.sameForAll}
              </button>
              <button
                type="button"
                data-active={mode === "per" ? "true" : "false"}
                className="guest-cat-tab guest-motion flex-1"
                onClick={() => setMode("per")}
              >
                {t.customiseEach}
              </button>
            </div>
            {mode === "per" ? (
              <div className="guest-cat-strip flex gap-2 overflow-x-auto">
                {Array.from({ length: quantity }, (_, index) => {
                  const complete = unitIsComplete(groups, units[index] ?? emptySelection());
                  return (
                    <button
                      key={index}
                      type="button"
                      data-active={activeUnit === index ? "true" : "false"}
                      className="guest-cat-tab guest-motion relative shrink-0"
                      onClick={() => setActiveUnit(index)}
                    >
                      {t.itemUnit.replace("{n}", String(index + 1))}
                      {!complete ? (
                        <span className="ms-2 size-2 rounded-full bg-[var(--guest-orange)]" aria-hidden />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {groups.map((group) => {
          const hint = groupChoiceHint(group, {
            required: t.required,
            chooseUpTo: t.chooseUpTo,
            chooseAtLeast: t.chooseAtLeast,
            chooseBetween: t.chooseBetween,
          });
          const highlighted = highlightGroupId === group.id;
          const groupSatisfied = (workingSelection[group.id] ?? []).length >= (group.is_required ? Math.max(1, group.min_choices ?? 1) : (group.min_choices ?? 0));
          const needsBand = Boolean(group.is_required) && !groupSatisfied;
          return (
            <fieldset
              key={group.id}
              ref={(node) => {
                if (node) groupRefs.current.set(group.id, node);
                else groupRefs.current.delete(group.id);
              }}
              className={`grid gap-2 ${needsBand ? "guest-required-band" : ""} ${highlighted ? "outline outline-2 outline-[var(--guest-orange)] outline-offset-2" : ""}`}
            >
              <legend className="grid gap-0.5">
                <span className="guest-title">{optionName(group.name, locale)}</span>
                {hint ? (
                  <span className="guest-caption font-normal">{hint}</span>
                ) : group.is_required ? (
                  <span className="guest-badge guest-badge-accent w-fit">{t.required}</span>
                ) : null}
              </legend>
              <div className={group.max_choices === 1 ? "flex flex-wrap gap-2" : "grid gap-2"}>
                {(group.options ?? []).map((option) => {
                  const soldOut = option.is_available === false;
                  const chosen = (workingSelection[group.id] ?? []).includes(option.id);
                  const delta = Number(option.price_delta);
                  const single = group.max_choices === 1;
                  const showDelta = !soldOut && Number.isFinite(delta) && delta !== 0;
                  return (
                    <label
                      key={option.id}
                      data-selected={chosen ? "true" : "false"}
                      data-active={single && chosen ? "true" : "false"}
                      className={
                        single
                          ? `guest-cat-tab guest-motion inline-flex items-center gap-2 ${soldOut ? "opacity-50" : ""}`
                          : `guest-option-tile guest-motion flex flex-row items-center justify-between gap-3 text-sm ${soldOut ? "opacity-50" : ""}`
                      }
                    >
                      <input
                        type={single ? "radio" : "checkbox"}
                        name={`${group.id}-${mode === "same" ? "all" : activeUnit}`}
                        className="sr-only"
                        checked={chosen}
                        disabled={soldOut}
                        onChange={() => {
                          if (soldOut) return;
                          setChoiceError("");
                          setHighlightGroupId(null);
                          updateWorking(toggleOption(workingSelection, group, option.id));
                        }}
                      />
                      <span>
                        {optionName(option.name, locale)}
                        {soldOut ? ` · ${t.unavailable}` : ""}
                      </span>
                      {showDelta ? (
                        <span className="guest-price text-xs" dir="ltr">
                          + <Money amount={option.price_delta} currency={currency} locale={locale} />
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        <label className="grid gap-1.5 guest-title">
          {t.notes}
          <textarea
            className={`${guestField} min-h-24 py-3`}
            placeholder={t.notes}
            value={mode === "same" ? (notes[0] ?? "") : (notes[activeUnit] ?? "")}
            onChange={(event) => {
              const value = event.target.value;
              setNotes((current) => {
                if (mode === "same") return [value];
                const next = [...current];
                next[activeUnit] = value;
                return next;
              });
            }}
          />
        </label>

        {choiceError ? (
          <p role="alert" className="guest-alert guest-alert-error text-sm">
            {choiceError}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}

export function NicknameSheet({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useGuestCopy();
  const guestName = useGuest((state) => state.guestName);
  const setGuestName = useGuest((state) => state.setGuestName);
  const [draft, setDraft] = useState(guestName);

  useEffect(() => {
    if (open) setDraft(guestName);
  }, [open, guestName]);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t.nicknameTitle}
      footer={
        <button
          type="button"
          className={guestPrimaryButton}
          disabled={!draft.trim()}
          onClick={() => {
            setGuestName(draft.trim());
            onOpenChange(false);
            onSaved();
          }}
        >
          {t.saveNickname}
        </button>
      }
    >
      <p className="guest-body">{t.nicknameBody}</p>
      <input
        className={`${guestField} mt-3`}
        autoComplete="nickname"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    </BottomSheet>
  );
}
