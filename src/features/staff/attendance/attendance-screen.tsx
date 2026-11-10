"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { Clock, KeyRound, SlidersHorizontal, Store } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge, type Tone } from "@/components/ops/kit/badge";
import { Button } from "@/components/ops/kit/button";
import { Card, KpiCard } from "@/components/ops/kit/card";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { Field, Input, Textarea } from "@/components/ops/kit/field";
import { SegmentedControl } from "@/components/ops/kit/segmented";
import { SidePanel } from "@/components/ops/kit/side-panel";
import { ScreenTitle } from "@/components/ops/page-header";
import { ErrorState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { attendanceCopy } from "@/lib/i18n/staff/attendance";
import { commonCopy } from "@/lib/i18n/staff/common";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { roleLabel, isUserRole } from "@/lib/auth/roles";
import { useScope } from "@/stores/scope";

import { useMyAttendance } from "./clock";
import { ClockBody } from "./clock-panel";
import { PinPanel } from "./pin-panel";
import { RotaView } from "./rota-view";
import { RulesPanel } from "./rules-panel";
import { branchNow, clockOf, shiftTimes, splitMinutes } from "./time";
import { TillClockPanel } from "./till-clock-panel";
import { TimesheetView } from "./timesheet-view";

type Log = components["schemas"]["AttendanceLogItem"];
type Staff = components["schemas"]["StaffResponse"];
type Range = "daily" | "weekly" | "monthly";
type FixStatus = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
type View = "today" | "rota" | "timesheet";
type Shift = components["schemas"]["RotaShift"];
type Expected = { person: Staff; branchId: string };

// Same roles as staff.attendanceReview / staff.attendanceOverride and the API's OVERRIDE_ROLES.
const MANAGERS = new Set(["SUPER_ADMIN", "BRAND_ADMIN", "BRANCH_ADMIN"]);
const FRONTLINE = new Set(["CASHIER", "WAITER", "KITCHEN_STAFF", "RUNNER"]);
const ZONE = "Africa/Cairo";

/** Ticks once a minute so "on shift for 3h 12m" stays current. */
function useMinuteTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function statusTone(status: string): Tone {
  if (status === "PRESENT") return "success";
  if (status === "LATE") return "warning";
  if (status === "ABSENT") return "danger";
  return "neutral";
}

export function AttendanceScreen() {
  const t = useStaffSection(attendanceCopy);
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId);
  const branches = useScope((state) => state.branches);
  const watched = branches.length > 0 ? branches.map((branch) => branch.id) : branchId ? [branchId] : [];
  const canReview = MANAGERS.has(me?.role ?? "");
  const canCorrect = canReview;
  // The rota, rules and timesheet are per branch: the one in scope, or the only one.
  const oneBranch = branchId ?? (branches.length === 1 ? branches[0].id : null);
  const [view, setView] = useState<View>("today");
  const [rulesOpen, setRulesOpen] = useState(false);
  const params = useSearchParams();
  const [tillOpen, setTillOpen] = useState(false);
  const askedTill = params.get("till") === "1";
  useEffect(() => {
    if (askedTill) setTillOpen(true);
  }, [askedTill]);

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <ScreenTitle>{t.title}</ScreenTitle>
        <p className="max-w-2xl text-sm leading-6 text-ink-secondary">
          {t.intro}
          {canReview ? ` ${t.introReview}` : ""}
        </p>
      </div>
      <MyShift tillHref={oneBranch ? "/app/attendance?till=1" : null} />
      {oneBranch ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="field" variant="secondary" onClick={() => setTillOpen(true)}>
            <Store aria-hidden />
            {t.till.button}
          </Button>
        </div>
      ) : null}
      {tillOpen && oneBranch ? <TillClockPanel branchId={oneBranch} canManagePins={canCorrect} onClose={() => setTillOpen(false)} /> : null}
      {canReview ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl<View>
              label={t.title}
              value={view}
              onValueChange={setView}
              items={(["today", "rota", "timesheet"] as const).map((value) => ({ value, label: t.views[value] }))}
            />
            {canCorrect && oneBranch ? (
              <Button size="field" variant="secondary" onClick={() => setRulesOpen(true)}>
                <SlidersHorizontal aria-hidden />
                {t.rules.button}
              </Button>
            ) : null}
          </div>
          {view === "today" ? <TeamAttendance branchIds={watched} canCorrect={canCorrect} /> : null}
          {view === "rota" ? <RotaView branchId={oneBranch} canEdit={canCorrect} /> : null}
          {view === "timesheet" ? <TimesheetView branchId={oneBranch} /> : null}
          {rulesOpen && oneBranch ? <RulesPanel branchId={oneBranch} onClose={() => setRulesOpen(false)} /> : null}
        </>
      ) : null}
    </div>
  );
}

/** The signed-in person's shift: the same body as the top-bar clock panel, plus the till PIN link. */
function MyShift({ tillHref }: { tillHref: string | null }) {
  const t = useStaffSection(attendanceCopy);
  const attendance = useMyAttendance();
  const { status } = attendance;
  const [pinOpen, setPinOpen] = useState(false);

  if (status.isError) {
    return <ErrorState body={status.error instanceof Error ? status.error.message : t.statusFailed} onRetry={() => void status.refetch()} />;
  }
  return (
    <Card className="max-w-xl">
      <ClockBody
        attendance={attendance}
        tillHref={tillHref}
        footer={
          status.data ? (
            <button type="button" onClick={() => setPinOpen(true)} className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-ink underline-offset-2 hover:underline">
              <KeyRound aria-hidden className="size-3.5" />
              {status.data.has_till_pin ? t.my.changePin : t.my.setPin}
            </button>
          ) : null
        }
      />
      {pinOpen ? <PinPanel onClose={() => setPinOpen(false)} /> : null}
    </Card>
  );
}

function TeamAttendance({ branchIds, canCorrect }: { branchIds: string[]; canCorrect: boolean }) {
  const t = useStaffSection(attendanceCopy);
  const { locale } = useLocale();
  const [range, setRange] = useState<Range>("daily");
  const [fixing, setFixing] = useState<Log | null>(null);
  const key = branchIds.join(",");

  const logs = useQuery({
    queryKey: ["attendance-logs", key, range],
    enabled: branchIds.length > 0,
    queryFn: async () => {
      const pages = await Promise.all(
        branchIds.map(async (id) => {
          const result = await browserApi.GET("/api/v1/branches/{branch_id}/attendance-logs", {
            params: { path: { branch_id: id }, query: { filter_type: range } },
          });
          if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.logsFailed);
          return result.data.records ?? [];
        }),
      );
      return pages.flat().sort((a, b) => b.date.localeCompare(a.date) || a.employee_name.localeCompare(b.employee_name));
    },
  });
  // Who is expected today, to show who hasn't arrived yet.
  const staff = useQuery({
    queryKey: ["attendance-staff", key],
    enabled: branchIds.length > 0,
    queryFn: async () => {
      const pages = await Promise.all(
        branchIds.map(async (id) => {
          const result = await browserApi.GET("/api/v1/branches/{branch_id}/staff", { params: { path: { branch_id: id } } });
          if (!result.response.ok || !result.data) return [];
          return result.data.records ?? [];
        }),
      );
      const seen = new Map<string, Expected>();
      pages.forEach((people, index) => {
        for (const person of people) if (person.is_active && FRONTLINE.has(person.role)) seen.set(person.id, { person, branchId: branchIds[index] });
      });
      return [...seen.values()];
    },
  });
  // Today's rota: days off, planned start times, and which branches planned today.
  const todayRota = useQuery({
    queryKey: ["rota-today", key, branchNow(ZONE).day],
    enabled: branchIds.length > 0,
    queryFn: async () => {
      const day = branchNow(ZONE).day;
      const pages = await Promise.all(
        branchIds.map(async (id) => {
          const result = await browserApi.GET("/api/v1/branches/{branch_id}/rota", {
            params: { path: { branch_id: id }, query: { start: day, end: day } },
          });
          return result.response.ok && result.data ? result.data.shifts.map((shift) => ({ ...shift, branchId: id })) : [];
        }),
      );
      return pages.flat();
    },
  });

  const rows = logs.data ?? [];
  const today = branchNow(ZONE).day;
  const todayRows = rows.filter((row) => row.date === today);

  const roleName = (role: string | null | undefined) => (role && isUserRole(role) ? roleLabel(role, locale) : "");
  const duration = (minutes: number | null | undefined) => {
    if (minutes == null) return "—";
    const { hours, minutes: rest } = splitMinutes(minutes);
    return fill(t.my.worked, { hours, minutes: rest });
  };
  const statusText = (row: Log) =>
    row.status === "PRESENT" ? t.log.onTime : row.status === "LATE" ? t.late : row.status === "ABSENT" ? t.absent : row.status === "EXCUSED" ? t.log.excused : row.status;
  const dayLabel = (day: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

  const columns: Column<Log>[] = [
    {
      key: "person",
      header: t.person,
      cell: (row) => (
        <span className="grid gap-0.5">
          <span className="font-medium text-ink">{row.employee_name}</span>
          <span className="text-xs text-ink-secondary">{[roleName(row.role), branchIds.length > 1 ? row.branch_name : ""].filter(Boolean).join(" · ")}</span>
        </span>
      ),
    },
    ...(range === "daily" ? [] : [{ key: "day", header: t.day, cell: (row: Log) => dayLabel(row.date) }]),
    { key: "in", header: t.arrived, cell: (row) => <Punch time={clockOf(row.check_in)} method={row.check_in_method} /> },
    { key: "out", header: t.left, cell: (row) => <Punch time={clockOf(row.check_out)} method={row.check_out_method} /> },
    { key: "hours", header: t.log.hours, align: "end", cell: (row) => <span className="tabular-nums">{duration(row.minutes_worked)}</span> },
    {
      key: "late",
      header: t.log.lateBy,
      align: "end",
      cell: (row) => (row.minutes_late ? <span className="font-medium text-warning tabular-nums">{fill(t.log.lateMinutes, { minutes: row.minutes_late })}</span> : <span className="text-ink-secondary">—</span>),
    },
    {
      key: "status",
      header: t.status,
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={statusTone(row.status)}>{statusText(row)}</Badge>
          {row.minutes_early_leave ? <Badge tone="warning">{fill(t.log.leftEarly, { minutes: row.minutes_early_leave })}</Badge> : null}
          {row.minutes_overtime ? <Badge tone="info">{fill(t.log.overtime, { minutes: row.minutes_overtime })}</Badge> : null}
          {row.needs_review ? (
            <span title={t.log.reviewHint}>
              <Badge tone="info">{t.log.review}</Badge>
            </span>
          ) : null}
          {row.is_corrected ? (
            <span title={row.correction_reason ?? undefined} className="text-xs text-ink-secondary underline decoration-dotted underline-offset-2">
              {t.log.corrected}
            </span>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <>
      <TodayBoard today={today} rows={todayRows} staff={staff.data ?? []} rota={todayRota.data ?? []} loading={logs.isLoading || staff.isLoading} />
      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-0.5">
            <h2 className="text-sm font-semibold text-ink">{t.log.title}</h2>
            {canCorrect && rows.length > 0 ? <p className="text-xs text-ink-secondary">{t.log.tapToCorrect}</p> : null}
          </div>
          <SegmentedControl<Range>
            label={t.period}
            value={range}
            onValueChange={setRange}
            items={(["daily", "weekly", "monthly"] as const).map((value) => ({ value, label: t.ranges[value] }))}
          />
        </div>
        {logs.isError ? <ErrorState body={logs.error instanceof Error ? logs.error.message : t.logsFailed} onRetry={() => void logs.refetch()} /> : null}
        {branchIds.length === 0 ? <p className="text-sm text-ink-secondary">{t.chooseBranchLogs}</p> : null}
        {branchIds.length > 0 && !logs.isError ? (
          <DataTable
            caption={t.log.title}
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            onRowClick={canCorrect ? setFixing : undefined}
            selectedKey={fixing?.id ?? null}
            loading={logs.isLoading}
            empty={t.log.nobody}
          />
        ) : null}
      </section>
      {fixing ? <CorrectionPanel key={fixing.id} log={fixing} onClose={() => setFixing(null)} /> : null}
    </>
  );
}

/** A punch time, marked when it was taken on the till or filled in automatically. */
function Punch({ time, method }: { time: string; method?: string | null }) {
  const t = useStaffSection(attendanceCopy);
  if (!time) return <span className="text-ink-secondary">—</span>;
  const note = method === "TILL_PIN" ? t.log.viaTill : method === "AUTO" ? t.log.auto : null;
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="tabular-nums">{time}</span>
      {note ? <span className="text-[11px] text-ink-secondary">{note}</span> : null}
    </span>
  );
}

/** Who's in, who's late, who hasn't arrived, and what needs a manager's look. */
function TodayBoard({
  today,
  rows,
  staff,
  rota,
  loading,
}: {
  today: string;
  rows: Log[];
  staff: Expected[];
  rota: (Shift & { branchId: string })[];
  loading: boolean;
}) {
  const t = useStaffSection(attendanceCopy);
  const now = branchNow(ZONE, useMinuteTick());
  const inNow = rows.filter((row) => row.check_in && !row.check_out).length;
  const late = rows.filter((row) => row.status === "LATE").length;
  const review = rows.filter((row) => row.needs_review).length;
  const recorded = new Set(rows.map((row) => row.user_id).filter(Boolean));
  const planned = new Map(rota.map((shift) => [shift.user_id, shift]));
  const plannedBranches = new Set(rota.filter((shift) => !shift.is_day_off).map((shift) => shift.branchId));
  const expected = staff
    .filter(({ person, branchId }) => {
      if (recorded.has(person.id)) return false;
      const shift = planned.get(person.id);
      if (shift?.is_day_off) return false;
      return Boolean(shift) || !plannedBranches.has(branchId);
    })
    .map(({ person }) => ({ person, start: (planned.get(person.id)?.start_time ?? person.shift_start_time ?? "10:00").slice(0, 5) }))
    .sort((a, b) => a.start.localeCompare(b.start));
  const missing = expected.filter((entry) => entry.start <= now.clock);
  const upcoming = expected.filter((entry) => entry.start > now.clock);

  return (
    <section className="grid gap-3" aria-label={t.board.title}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={t.board.inNow} value={String(inNow)} loading={loading} />
        <KpiCard label={t.board.late} value={String(late)} loading={loading} />
        <KpiCard label={t.board.notIn} value={String(missing.length)} loading={loading} />
        <KpiCard label={t.board.review} value={String(review)} loading={loading} />
      </div>
      {!loading && today === now.day && expected.length > 0 ? (
        <Card title={t.board.notInTitle}>
          {missing.length === 0 ? <p className="text-sm text-ink-secondary">{t.board.everyoneIn}</p> : null}
          <ul className="flex flex-wrap gap-2">
            {[...missing, ...upcoming].map(({ person, start }) => {
              const started = start <= now.clock;
              return (
                <li
                  key={person.id}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px]",
                    started ? "border-danger/30 bg-danger-bg text-ink" : "border-border bg-canvas text-ink-secondary",
                  )}
                >
                  <Clock aria-hidden className="size-3.5" />
                  <span className="font-medium">{person.full_name}</span>
                  <span>{fill(started ? t.board.startedAt : t.board.startsAt, { time: start })}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}

/** Fix a record: status, arrival and leave times, and a reason that is kept. */
function CorrectionPanel({ log, onClose }: { log: Log; onClose: () => void }) {
  const t = useStaffSection(attendanceCopy);
  const common = useStaffSection(commonCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<FixStatus>((["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const).find((value) => value === log.status) ?? "PRESENT");
  const [arrived, setArrived] = useState(clockOf(log.check_in));
  const [left, setLeft] = useState(clockOf(log.check_out));
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const worked = status === "PRESENT" || status === "LATE";
  const ready = reason.trim().length >= 5 && (!worked || Boolean(arrived));

  const save = useMutation({
    mutationFn: async () => {
      const times = worked ? shiftTimes(log.date, arrived, left, ZONE) : null;
      const result = await browserApi.PATCH("/api/v1/attendance-logs/{log_id}/manual-override", {
        params: { path: { log_id: log.id } },
        body: {
          status,
          reason: reason.trim(),
          check_in_at: times?.checkIn ?? null,
          check_out_at: times?.checkOut ?? null,
        },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.fix.failed);
    },
    onSuccess: async () => {
      toast.success(t.fix.saved);
      await queryClient.invalidateQueries({ queryKey: ["attendance-logs"] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const day = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${log.date}T00:00:00Z`));
  return (
    <SidePanel
      open
      onOpenChange={(open) => !open && onClose()}
      title={fill(t.fix.title, { name: log.employee_name })}
      description={day}
      footer={
        <div className="grid w-full gap-2">
          {tried && !ready ? (
            <p role="alert" className="text-xs text-danger">
              {worked && !arrived ? t.fix.needArrived : t.fix.reasonHint}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              {common.cancel}
            </Button>
            <Button
              disabled={save.isPending}
              aria-disabled={!ready ? true : undefined}
              className={!ready ? "opacity-60" : undefined}
              onClick={() => (ready ? save.mutate() : setTried(true))}
            >
              {save.isPending ? t.fix.saving : t.fix.save}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">{t.fix.statusLabel}</span>
        <SegmentedControl<FixStatus>
          label={t.fix.statusLabel}
          value={status}
          onValueChange={setStatus}
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
          items={[
            { value: "PRESENT", label: t.log.onTime },
            { value: "LATE", label: t.late },
            { value: "ABSENT", label: t.absent },
            { value: "EXCUSED", label: t.log.excused },
          ]}
        />
      </div>
      {worked ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.fix.arrived}>
            <Input type="time" value={arrived} aria-invalid={tried && !arrived ? true : undefined} onChange={(event) => setArrived(event.target.value)} />
          </Field>
          <Field label={t.fix.left} hint={left && arrived && left <= arrived ? t.fix.leftHint : t.fix.stillOn}>
            <Input type="time" value={left} onChange={(event) => setLeft(event.target.value)} />
          </Field>
        </div>
      ) : null}
      <Field label={t.fix.reason} hint={t.fix.reasonHint}>
        <Textarea className="min-h-20" value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </SidePanel>
  );
}
