"use client";

import { Radio } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ops/kit/card";
import { useBrandMenus } from "@/features/staff/menu/shared";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { menuCopy } from "@/lib/i18n/staff/menu";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

/** Home card: which brand menu guests and the till see right now. Hidden when the brand uses no menus. */
export function LiveMenuCard({ canOpen }: { canOpen: boolean }) {
  const t = useStaffSection(menuCopy).menus;
  const { locale } = useLocale();
  const menus = useBrandMenus(t.loadFailed);
  const filtering = (menus.data ?? []).filter((menu) => menu.is_active && (menu.category_ids ?? []).length > 0);
  if (filtering.length === 0) return null;
  const live = filtering.filter((menu) => menu.is_live);
  const label = (menu: (typeof live)[number]) => {
    const name = locale === "ar" ? menu.name_ar || menu.name_en : menu.name_en;
    const until = typeof menu.schedule_rules?.time_to === "string" ? menu.schedule_rules.time_to.slice(0, 5) : "";
    return until ? fill(t.liveUntil, { name, time: until }) : name;
  };
  return (
    <Card
      title={t.homeTitle}
      action={
        canOpen ? (
          <Link href="/app/menu/menus" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
            {t.homeLink}
          </Link>
        ) : undefined
      }
    >
      <p className="flex items-start gap-2 text-sm text-ink">
        <Radio aria-hidden className={live.length > 0 ? "mt-0.5 size-4 shrink-0 text-success" : "mt-0.5 size-4 shrink-0 text-ink-secondary"} />
        {live.length > 0 ? live.map(label).join(" · ") : t.guestsSeeAll}
      </p>
    </Card>
  );
}
