"use client";

import { Minus, Plus } from "lucide-react";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";

/** Badges the restaurant can set on an item. Unknown ones are shown as written. */
const BADGE_LABELS: Record<string, { en: string; ar: string }> = {
  vegan: { en: "Vegan", ar: "نباتي صرف" },
  vegetarian: { en: "Vegetarian", ar: "نباتي" },
  spicy: { en: "Spicy", ar: "حار" },
  gluten_free: { en: "Gluten free", ar: "خالٍ من الجلوتين" },
  popular: { en: "Popular", ar: "الأكثر طلبًا" },
  bestseller: { en: "Best seller", ar: "الأكثر مبيعًا" },
  new: { en: "New", ar: "جديد" },
  healthy: { en: "Healthy", ar: "صحي" },
  halal: { en: "Halal", ar: "حلال" },
};

/** A restaurant marks the hero item of a category with one of these badges. */
const FEATURE_BADGES = new Set(["signature", "featured", "chef", "chef_pick", "chefs_pick"]);

function key(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function isFeaturedItem(badges: readonly string[] | null | undefined): boolean {
  return (badges ?? []).some((badge) => FEATURE_BADGES.has(key(badge)));
}

export function badgeLabels(badges: readonly string[] | null | undefined, locale: "en" | "ar"): string[] {
  return (badges ?? [])
    .filter((badge) => !FEATURE_BADGES.has(key(badge)))
    .map((badge) => BADGE_LABELS[key(badge)]?.[locale] ?? badge.replace(/_/g, " "))
    .filter(Boolean)
    .slice(0, 3);
}

type TapHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>, run: () => void) => void;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>, run: () => void) => void;
};

/** Outlined "+" until the guest has this item; then a filled −/qty/+ pill. */
export function AddControl({
  qty,
  disabled,
  busy,
  labels,
  tap,
  onAdd,
  onLess,
  onMore,
  triggerRef,
}: {
  qty: number;
  disabled: boolean;
  busy: boolean;
  labels: { add: string; fewer: string; more: string };
  tap: TapHandlers;
  onAdd: () => void;
  onLess?: () => void;
  onMore?: () => void;
  triggerRef?: (node: HTMLButtonElement | null) => void;
}) {
  if (qty > 0 && onLess && onMore) {
    return (
      <div className="guest-qty" data-busy={busy ? "true" : "false"}>
        <button
          type="button"
          aria-label={labels.fewer}
          disabled={disabled || busy}
          onPointerDown={tap.onPointerDown}
          onPointerUp={(event) => tap.onPointerUp(event, onLess)}
          onClick={(event) => tap.onClick(event, onLess)}
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <span aria-live="polite">{qty}</span>
        <button
          type="button"
          aria-label={labels.more}
          disabled={disabled || busy}
          onPointerDown={tap.onPointerDown}
          onPointerUp={(event) => tap.onPointerUp(event, onMore)}
          onClick={(event) => tap.onClick(event, onMore)}
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      ref={triggerRef}
      className="guest-add-ring guest-motion"
      data-count={qty > 0 ? qty : undefined}
      aria-label={labels.add}
      disabled={disabled || busy}
      onPointerDown={tap.onPointerDown}
      onPointerUp={(event) => tap.onPointerUp(event, onAdd)}
      onClick={(event) => tap.onClick(event, onAdd)}
    >
      {qty > 0 ? <span className="text-sm font-bold">{qty}</span> : <Plus className="size-5" aria-hidden />}
    </button>
  );
}

/** One menu line. The whole row opens the item; the add control sits above that tap target. */
export function ItemRow({
  title,
  description,
  image,
  badges,
  price,
  note,
  deal,
  soldOut,
  soldOutLabel,
  action,
  onOpen,
}: {
  title: string;
  description: string;
  image: string | null;
  badges: string[];
  price: ReactNode;
  note?: ReactNode;
  deal: string | null;
  soldOut: boolean;
  soldOutLabel: string;
  action: ReactNode;
  onOpen: () => void;
}) {
  return (
    <li className="guest-row" data-soldout={soldOut ? "true" : "false"} data-has-image={image ? "true" : "false"}>
      <button type="button" className="guest-row-hit" aria-label={title} onClick={onOpen} disabled={soldOut} />
      <div className="guest-row-text">
        <p className="guest-row-name">{title}</p>
        {description ? <p className="guest-row-desc">{description}</p> : null}
        {badges.length > 0 || deal ? (
          <div className="guest-row-tags">
            {deal ? <span className="guest-tag guest-tag-deal">{deal}</span> : null}
            {badges.map((badge) => (
              <span key={badge} className="guest-tag">
                {badge}
              </span>
            ))}
          </div>
        ) : null}
        <div className="guest-row-price">{soldOut ? <span className="guest-soldout">{soldOutLabel}</span> : price}</div>
        {note && !soldOut ? note : null}
      </div>
      {image ? (
        <div className="guest-row-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" loading="lazy" />
          {soldOut ? null : <div className="guest-row-media-action">{action}</div>}
        </div>
      ) : soldOut ? null : (
        <div className="guest-row-action">{action}</div>
      )}
    </li>
  );
}

/** A category's hero item, when the restaurant marks one with a "signature" badge. */
export function FeaturedCard({
  title,
  description,
  image,
  label,
  price,
  action,
  onOpen,
}: {
  title: string;
  description: string;
  image: string | null;
  label: string;
  price: ReactNode;
  action: ReactNode;
  onOpen: () => void;
}) {
  return (
    <div className="guest-feature" data-has-image={image ? "true" : "false"}>
      <button type="button" className="guest-row-hit" aria-label={title} onClick={onOpen} />
      {image ? (
        <div className="guest-feature-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" loading="lazy" />
        </div>
      ) : null}
      <div className="guest-feature-copy">
        <span className="guest-tag guest-tag-brand">★ {label}</span>
        <p className="guest-feature-name">{title}</p>
        {description ? <p className="guest-row-desc">{description}</p> : null}
        <div className="flex items-center justify-between gap-3">
          <div className="guest-row-price">{price}</div>
          <div className="relative z-[2]">{action}</div>
        </div>
      </div>
    </div>
  );
}
