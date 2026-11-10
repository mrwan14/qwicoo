"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ops/kit/badge";
import { Card } from "@/components/ops/kit/card";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { clockCopy } from "@/lib/i18n/staff/clock";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { clockOf, splitMinutes } from "./time";

type Day = components["schemas"]["MyWeekDay"];

function hoursText(minutes: number, locale: string): string {
  const { hours, minutes: rest } = splitMinutes(minutes);
  const h = locale === "ar" ? `${hours}س` : `${hours}h`;
  if (rest === 0) return h;
  return locale === "ar" ? `${h} ${rest}د` : `${h} ${rest}m`;
}

/** Shift a YYYY-MM-DD by whole weeks. */
function weeksFrom(day: string, weeks: number): string {
  const at = new Date(`${day}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + weeks * 7);
  return at.toISOString().slice(0, 10);
}

/** The signed-in person's week: planned shift, what they clocked, and hours against the plan. */
export function MyWeek() {
  const t = useStaffSection(clockCopy).week;
  const { locale } = useLocale();
  const branchId = useScope((state) => state.branchId);
  const [start, setStart] = useState<string | null>(null);
  const week = useQuery({
    queryKey: ["attendance-my-week", branchId, start],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/attendance/my-week", { params: { query: start ? { start } : {} } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.failed, locale);
      return result.data;
    },
  });
  const data = week.data;
  const dayName = (day: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
      new Date(`${day}T12:00:00Z`),
    );
  const onThisWeek = data ? data.today >= data.start && data.today <= data.end : true;

  if (week.isError) return <Card className="max-w-xl text-sm text-ink-secondary">{t.failed}</Card>;
  return (
    <Card className="max-w-xl gap-0 p-0">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="grid gap-0.5">
          <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
          {data ? (
            <p className="text-[13px] text-ink-secondary tabular-nums">
              {data.minutes_scheduled > 0
                ? fill(t.hours, { worked: hoursText(data.minutes_worked, locale), planned: hoursText(data.minutes_scheduled, locale) })
                : fill(t.hoursNone, { worked: hoursText(data.minutes_worked, locale) })}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {!onThisWeek ? (
            <button type="button" onClick={() => setStart(null)} className="rounded-staff px-2 py-1 text-[13px] font-medium text-ink hover:bg-well">
              {t.thisWeek}
            </button>
          ) : null}
          {[
            { label: t.previous, weeks: -1, Icon: ChevronLeft },
            { label: t.next, weeks: 1, Icon: ChevronRight },
          ].map(({ label, weeks, Icon }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              title={label}
              disabled={!data}
              onClick={() => data && setStart(weeksFrom(data.start, weeks))}
              className="inline-flex size-9 items-center justify-center rounded-staff text-ink-secondary hover:bg-well hover:text-ink disabled:opacity-40"
            >
              <Icon aria-hidden className="size-4 rtl:-scale-x-100" />
            </button>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-border">
        {(data?.days ?? Array.from({ length: 7 }, () => null)).map((day, index) => (
          <WeekRow key={day?.date ?? index} day={day} today={data?.today} dayName={dayName} t={t} locale={locale} />
        ))}
      </ul>
    </Card>
  );
}

function WeekRow({
  day,
  today,
  dayName,
  t,
  locale,
}: {
  day: Day | null;
  today: string | undefined;
  dayName: (day: string) => string;
  t: (typeof clockCopy)["en"]["week"];
  locale: string;
}) {
  if (!day) return <li className="h-12 animate-pulse bg-subtle/50 motion-reduce:animate-none" />;
  const isToday = day.date === today;
  const planned = day.is_day_off ? t.off : day.start_time && day.end_time ? `${day.start_time}–${day.end_time}` : t.notYet;
  let actual: React.ReactNode = <span className="text-ink-secondary">{t.notYet}</span>;
  if (day.status === "ABSENT") actual = <Badge tone="danger">{t.missed}</Badge>;
  else if (day.status === "EXCUSED") actual = <Badge>{t.excused}</Badge>;
  else if (day.check_in) {
    const span = `${clockOf(day.check_in)}–${day.check_out ? clockOf(day.check_out) : ""}`;
    actual = (
      <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
        <span className="text-ink tabular-nums">{day.check_out ? <bdi dir="ltr">{span}</bdi> : `${clockOf(day.check_in)} · ${t.open}`}</span>
        {day.minutes_worked ? <span className="text-ink-secondary tabular-nums">{hoursText(day.minutes_worked, locale)}</span> : null}
        {day.minutes_late > 0 ? <Badge tone="warning">{fill(t.lateBy, { minutes: day.minutes_late })}</Badge> : null}
      </span>
    );
  }
  return (
    <li className={cn("grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-[13px]", isToday && "bg-brand-tint/40")}>
      <span className={cn("truncate", isToday ? "font-semibold text-ink" : "text-ink")}>
        {dayName(day.date)}
        {isToday ? <span className="ms-1.5 text-xs font-medium text-ink-secondary">· {t.today}</span> : null}
      </span>
      <span className={cn("truncate tabular-nums", day.is_day_off ? "text-ink-secondary" : "text-ink")} title={day.from_rota || day.is_day_off ? undefined : t.usual}>
        <bdi dir="ltr">{planned}</bdi>
      </span>
      <span className="text-end">{actual}</span>
    </li>
  );
}
