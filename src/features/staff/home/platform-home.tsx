"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, type ReactNode } from "react";

import { Badge } from "@/components/ops/kit/badge";
import { buttonClass } from "@/components/ops/kit/button";
import { Card, KpiCard } from "@/components/ops/kit/card";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { PageHeader } from "@/components/ops/kit/page-header";
import { BrandMark } from "@/components/ops/shell/sidebar";
import { useStaffSession } from "@/components/ops/staff-session";
import { Skeleton } from "@/components/ui/skeleton";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { formatCairoDateTime } from "@/lib/format/time";
import { fill } from "@/lib/i18n/dictionary";
import { formatCount } from "@/lib/i18n/format";
import { useLocale } from "@/lib/i18n/locale-store";
import { homeCopy } from "@/lib/i18n/staff/home";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { navForUser } from "@/lib/nav";

import { AskBox } from "./ask-box";
import { cairoHour, cairoLongDate, greetingKey } from "./numbers";

type Brand = components["schemas"]["BrandResponse"];

function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-[13px] font-medium text-ink underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

function shortDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    timeZone: "Africa/Cairo",
    day: "numeric",
    month: "short",
    year: "numeric",
    numberingSystem: "latn",
  }).format(date);
}

/**
 * App Admin home: every brand and the latest partner leads. The brand API has no plan
 * field, so the design's Plan column is left out rather than guessed.
 */
export function PlatformHome() {
  const t = useStaffSection(homeCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const allowed = new Set(me ? navForUser(me, null).map((item) => item.href) : []);

  const brands = useQuery({
    // Not ["brands"]: other screens cache only the items under that key.
    queryKey: ["home", "brands"],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands", { params: { query: { limit: 100 } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
      return result.data;
    },
  });
  const leads = useQuery({
    queryKey: ["partner-leads"],
    enabled: allowed.has("/app/partner-leads"),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/partner-leads");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed);
      return result.data.items;
    },
  });

  const items = brands.data?.items ?? [];
  const active = items.filter((brand) => brand.is_active).length;
  const branchCount = items.reduce((sum, brand) => sum + (brand.branches?.length ?? 0), 0);
  const latestLead = leads.data?.[0];

  const columns: Column<Brand>[] = [
    {
      key: "brand",
      header: t.platform.brands.brand,
      strong: true,
      cell: (brand) => (
        <span className="flex items-center gap-2.5">
          <BrandMark name={brand.name} logoUrl={brand.logo_url} size="sm" />
          <span className="truncate">{brand.name}</span>
        </span>
      ),
    },
    { key: "branches", header: t.platform.brands.branches, cell: (brand) => formatCount(brand.branches?.length ?? 0, locale), align: "end", width: 110 },
    {
      key: "status",
      header: t.platform.brands.status,
      width: 130,
      cell: (brand) =>
        brand.is_active ? <Badge tone="success">{t.platform.brands.active}</Badge> : <Badge>{t.platform.brands.inactive}</Badge>,
    },
    { key: "since", header: t.platform.brands.since, cell: (brand) => shortDate(brand.created_at, locale), width: 140 },
  ];

  if (!me) return null;
  const firstName = me.full_name.split(/\s+/)[0] ?? me.full_name;

  return (
    <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-5">
      <PageHeader
        title={fill(t.greeting[greetingKey(cairoHour(now.toISOString()) ?? 9)], { name: firstName })}
        subtitle={fill(t.platform.subtitle, { date: cairoLongDate(now, locale) })}
        actions={
          <>
            {allowed.has("/app/invitations") ? (
              <Link href="/app/invitations" className={buttonClass({ variant: "secondary" })}>
                <UserPlus aria-hidden />
                {t.platform.invite}
              </Link>
            ) : null}
            <Link href="/app/brands" className={buttonClass()}>
              <Plus aria-hidden />
              {t.platform.createBrand}
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t.platform.kpis.brands}
          value={brands.data ? formatCount(brands.data.total, locale) : "—"}
          loading={brands.isLoading}
          note={brands.data ? fill(t.platform.kpis.active, { count: active }) : undefined}
        />
        <KpiCard
          label={t.platform.kpis.branches}
          value={brands.data ? formatCount(branchCount, locale) : "—"}
          loading={brands.isLoading}
          note={brands.data ? fill(t.platform.kpis.perBrand, { count: items.length }) : undefined}
        />
        {allowed.has("/app/partner-leads") ? (
          <KpiCard
            label={t.platform.kpis.leads}
            value={leads.data ? formatCount(leads.data.length, locale) : "—"}
            loading={leads.isLoading}
            note={latestLead ? fill(t.platform.kpis.latest, { date: shortDate(latestLead.created_at, locale) }) : undefined}
          />
        ) : null}
        <KpiCard
          label={t.platform.kpis.inactive}
          value={brands.data ? formatCount(items.length - active, locale) : "—"}
          loading={brands.isLoading}
          note={brands.data && items.length - active > 0 ? t.platform.kpis.paused : undefined}
        />
      </div>
      {brands.isError ? <p role="alert" className="text-sm text-danger">{brands.error.message}</p> : null}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card title={t.platform.brands.title} action={<CardLink href="/app/brands">{t.platform.brands.link}</CardLink>}>
          <DataTable
            caption={t.platform.brands.title}
            columns={columns}
            rows={items}
            rowKey={(brand) => brand.id}
            loading={brands.isLoading}
            empty={t.platform.brands.empty}
            onRowClick={(brand) => router.push(`/app/brands/${brand.id}`)}
          />
        </Card>
        <div className="grid grid-cols-1 gap-4">
          {allowed.has("/app/partner-leads") ? (
            <Card title={t.platform.leads.title} action={<CardLink href="/app/partner-leads">{t.platform.leads.link}</CardLink>}>
              {leads.isLoading ? (
                <Skeleton className="h-32 rounded-staff" />
              ) : (leads.data ?? []).length === 0 ? (
                <p className="py-4 text-sm text-ink-secondary">{t.platform.leads.empty}</p>
              ) : (
                <ul className="-my-1">
                  {(leads.data ?? []).slice(0, 5).map((lead) => (
                    <li key={lead.id} className="grid gap-0.5 border-b border-border py-2.5 last:border-b-0">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium text-ink">{lead.restaurant_name}</span>
                        <span className="shrink-0 text-xs text-ink-secondary">{formatCairoDateTime(lead.created_at, locale)}</span>
                      </span>
                      <span className="truncate text-xs text-ink-secondary">
                        {[lead.name, lead.city, fill(t.platform.leads.branches, { count: lead.branches_count })].filter(Boolean).join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
          <AskBox />
        </div>
      </div>
    </div>
  );
}
