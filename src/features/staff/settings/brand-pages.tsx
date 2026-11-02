"use client";

import { RoleGate } from "@/components/ops/screen";
import { BrandSettingsScreen } from "@/features/staff/brands-screen";
import { PaymobSettings } from "@/features/staff/paymob-settings";
import { settingsCopy } from "@/lib/i18n/staff/settings";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

import { SettingsFrame } from "./frame";

/** Settings → Brand for a brand admin: name, logo, branches and the Qwicoo app listing. */
export function BrandSettingsPage({ brandId, apiOrigin }: { brandId: string | null; apiOrigin: string }) {
  const t = useStaffSection(settingsCopy);
  return (
    <RoleGate href="/app/settings/brand">
      <SettingsFrame item="brand" title={t.items.brand.title} subtitle={t.items.brand.body}>
        {brandId ? <BrandSettingsScreen brandId={brandId} apiOrigin={apiOrigin} embedded /> : null}
      </SettingsFrame>
    </RoleGate>
  );
}

/** Settings → Payments: the brand's Paymob card payments. */
export function CardPaymentsPage({ brandId, apiOrigin }: { brandId: string | null; apiOrigin: string }) {
  const t = useStaffSection(settingsCopy);
  return (
    <RoleGate href="/app/settings/payments">
      <SettingsFrame item="payments" title={t.items.payments.title} subtitle={t.items.payments.body}>
        {brandId ? <PaymobSettings brandId={brandId} apiOrigin={apiOrigin} /> : null}
      </SettingsFrame>
    </RoleGate>
  );
}
