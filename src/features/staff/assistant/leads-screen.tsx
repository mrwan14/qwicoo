"use client";

import { useQuery } from "@tanstack/react-query";

import { ErrorState, LoadingState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { formatCairoDateTime } from "@/lib/format/time";
import { fill } from "@/lib/i18n/dictionary";
import { formatCount } from "@/lib/i18n/format";
import { useLocale } from "@/lib/i18n/locale-store";
import { assistantCopy } from "@/lib/i18n/staff/assistant";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export function PartnerLeadsScreen() {
  const t = useStaffSection(assistantCopy).leads;
  const { locale } = useLocale();
  const leads = useQuery({
    queryKey: ["partner-leads"],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/partner-leads");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.failed);
      return result.data.items;
    },
  });

  return (
    <div className="grid gap-4">
      <h1 className="text-[length:var(--text-28)] font-semibold">{t.title}</h1>
      {leads.isLoading ? <LoadingState label={t.loading} /> : null}
      {leads.isError ? <ErrorState body={leads.error.message} onRetry={() => void leads.refetch()} /> : null}
      {leads.data && leads.data.length === 0 ? <p className="text-sm text-muted-foreground">{t.empty}</p> : null}
      {leads.data && leads.data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-start text-sm">
            <thead>
              <tr>
                {[t.date, t.restaurant, t.city, t.branches, t.contact, t.message].map((heading) => (
                  <th key={heading} className="border border-border px-2 py-1 text-start font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.data.map((lead) => (
                <tr key={lead.id}>
                  <td className="border border-border px-2 py-1 whitespace-nowrap">{formatCairoDateTime(lead.created_at, locale)}</td>
                  <td className="border border-border px-2 py-1">
                    <span className="block font-medium">{lead.restaurant_name}</span>
                    <span className="block text-muted-foreground">{lead.name}</span>
                  </td>
                  <td className="border border-border px-2 py-1">{lead.city}</td>
                  <td className="border border-border px-2 py-1 tabular-nums">{formatCount(lead.branches_count, locale)}</td>
                  <td className="border border-border px-2 py-1">{lead.phone_or_email}</td>
                  <td className="border border-border px-2 py-1">{lead.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export function AssistantUsage() {
  const t = useStaffSection(assistantCopy);
  const { locale } = useLocale();
  const usage = useQuery({
    queryKey: ["assistant-usage"],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/assistant/usage");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.leads.failed);
      return result.data;
    },
  });
  if (usage.isLoading || usage.isError || !usage.data) return null;
  return (
    <p className="text-sm text-muted-foreground">
      {fill(t.usage, { questions: formatCount(usage.data.questions, locale), limit: formatCount(usage.data.limit, locale) })}
    </p>
  );
}
