"use client";

import { Popover } from "@base-ui/react/popover";
import { cn } from "cn";
import { Clock, LoaderCircle, LogIn, LogOut, MapPinOff, RotateCw, Store, WifiOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { Badge } from "@/components/ops/kit/badge";
import { Button, buttonClass } from "@/components/ops/kit/button";
import { cairoTime } from "@/features/staff/home/numbers";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { clockCopy } from "@/lib/i18n/staff/clock";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

import { useMyAttendance } from "./clock";
import { distanceText, type PunchProblem } from "./punch-problem";
import { minutesSince, splitMinutes } from "./time";

type Attendance = ReturnType<typeof useMyAttendance>;
type Copy = (typeof clockCopy)["en"];

function useMinuteTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** Where today stands for this person, read once so the chip and the panel agree. */
export function shiftState(attendance: Attendance) {
  const data = attendance.status.data;
  const record = data?.attendance;
  const done = Boolean(record?.check_in && record?.check_out);
  const away = record?.status === "ABSENT" || record?.status === "EXCUSED" ? record.status : null;
  return {
    data,
    record,
    shift: data?.today_shift,
    done,
    away,
    // Nothing left to punch today: done, or a manager marked the day.
    canPunch: Boolean(data) && !done && !away,
  };
}

function ProblemBox({ problem, t, locale, tillHref }: { problem: PunchProblem; t: Copy; locale: string; tillHref: string | null }) {
  const p = t.problems;
  const meters = (value: number | null) => (value == null ? null : distanceText(value, locale));
  let title: string;
  let body: string;
  let icon: ReactNode = <MapPinOff aria-hidden className="size-4" />;
  switch (problem.kind) {
    case "offline":
      ({ title, body } = p.offline);
      icon = <WifiOff aria-hidden className="size-4" />;
      break;
    case "denied":
      ({ title, body } = p.denied);
      break;
    case "noFix":
      ({ title, body } = p.noFix);
      break;
    case "weak": {
      title = p.weak.title;
      const accuracy = meters(problem.accuracy);
      const allowed = meters(problem.allowed);
      body = accuracy && allowed ? fill(p.weak.body, { accuracy, allowed }) : p.weakPlain;
      break;
    }
    case "far": {
      title = p.far.title;
      const distance = meters(problem.distance);
      const allowed = meters(problem.allowed);
      body = distance && allowed ? fill(p.far.body, { distance, allowed }) : p.farPlain;
      break;
    }
    case "tillOnly":
      ({ title, body } = p.tillOnly);
      icon = <Store aria-hidden className="size-4" />;
      break;
    default:
      title = p.other.title;
      body = problem.message;
  }
  const till = (problem.kind === "far" || problem.kind === "tillOnly") && tillHref;
  return (
    <div role="alert" className="grid gap-2 rounded-staff border border-warning/40 bg-warning-bg px-3.5 py-3 text-ink">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-warning">{icon}</span>
        {title}
      </p>
      <p className="text-[13px] leading-snug text-ink-secondary">{body}</p>
      {till ? (
        <Link href={till} className={cn(buttonClass({ size: "sm", variant: "secondary" }), "w-fit")}>
          <Store aria-hidden />
          {t.openTill}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Today's shift and the one Clock in / Clock out button, with the location check shown as it happens
 * and any problem explained in place with a way to fix it. Used in the top-bar panel and on Attendance.
 */
export function ClockBody({ attendance, tillHref, heading = true, footer }: { attendance: Attendance; tillHref: string | null; heading?: boolean; footer?: ReactNode }) {
  const t = useStaffSection(clockCopy);
  const { locale } = useLocale();
  const now = useMinuteTick();
  const { record, shift, done, away, canPunch } = shiftState(attendance);
  const { clockedIn, checkInAt, phase } = attendance;
  const tillOnly = attendance.status.data?.clock_mode === "TILL_ONLY";
  // A till-only branch says so up front, instead of offering a button that can't work.
  const problem: PunchProblem | null = attendance.problem ?? (tillOnly && canPunch ? { kind: "tillOnly" } : null);
  const time = (iso: string | null | undefined) => (iso ? cairoTime(iso, locale) : "–");
  const worked = checkInAt ? splitMinutes(minutesSince(checkInAt, now)) : null;
  const kind = clockedIn ? "out" : "in";
  const punch = () => void attendance.punch(kind);

  let headline: string;
  if (attendance.status.isLoading) headline = "…";
  else if (clockedIn && checkInAt) headline = fill(t.onShift, { time: time(checkInAt) });
  else if (done) headline = fill(t.done, { start: time(record?.check_in), end: time(record?.check_out) });
  else if (away === "ABSENT") headline = t.absent;
  else if (away === "EXCUSED") headline = t.excused;
  else if (shift?.is_day_off) headline = t.dayOff;
  else headline = t.notIn;

  const shiftLine =
    shift?.start_time && shift.end_time && !shift.is_day_off
      ? fill(t.today, { start: shift.start_time, end: shift.end_time, lateAfter: shift.late_after ?? shift.start_time })
      : shift?.is_day_off
        ? null
        : t.noShift;

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        {heading ? (
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
            {record?.status === "LATE" || record?.status === "PRESENT" ? (
              <Badge tone={record.status === "LATE" ? "warning" : "success"}>{record.status === "LATE" ? t.late : t.onTime}</Badge>
            ) : null}
          </div>
        ) : null}
        {shiftLine ? <p className="text-[13px] text-ink-secondary tabular-nums">{shiftLine}</p> : null}
        <p className={cn("text-ink", away ? "text-sm" : "text-lg font-semibold tabular-nums")}>{headline}</p>
        {clockedIn && worked && worked.hours + worked.minutes > 0 ? (
          <p className="text-[13px] text-ink-secondary tabular-nums">{fill(t.worked, { hours: worked.hours, minutes: worked.minutes })}</p>
        ) : null}
      </div>

      {problem && phase === "idle" ? <ProblemBox problem={problem} t={t} locale={locale} tillHref={tillHref} /> : null}

      {canPunch && !tillOnly ? (
        <div className="grid gap-2">
          <Button size="touch" className="w-full" variant={clockedIn ? "secondary" : "primary"} disabled={phase !== "idle"} onClick={punch}>
            {phase !== "idle" ? (
              <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
            ) : problem ? (
              <RotateCw aria-hidden />
            ) : clockedIn ? (
              <LogOut aria-hidden className="rtl:-scale-x-100" />
            ) : (
              <LogIn aria-hidden className="rtl:-scale-x-100" />
            )}
            {phase === "locating" ? t.locating : phase === "sending" ? t.sending : problem ? t.tryAgain : clockedIn ? t.clockOut : t.clockIn}
          </Button>
          <p aria-live="polite" className="text-center text-xs text-ink-secondary">
            {phase === "idle" && !problem && !clockedIn ? t.locationNote : ""}
          </p>
        </div>
      ) : null}
      {footer}
    </div>
  );
}

/**
 * The top-bar entry point: a chip that says where the shift stands, opening the clock panel.
 * `compact` shows only the icon and a status dot (phone bars).
 */
export function ClockChip({ attendance, tillHref, compact = false, footer }: { attendance: Attendance; tillHref: string | null; compact?: boolean; footer?: ReactNode }) {
  const t = useStaffSection(clockCopy);
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const { done } = shiftState(attendance);
  if (!attendance.status.isSuccess) return null;
  const on = attendance.clockedIn && attendance.checkInAt;
  const label = on ? fill(t.chipIn, { time: cairoTime(attendance.checkInAt!, locale) }) : done ? t.chipDone : t.chipOut;
  const change = (next: boolean) => {
    setOpen(next);
    if (!next) attendance.clearProblem();
  };
  return (
    <Popover.Root open={open} onOpenChange={change}>
      <Popover.Trigger
        aria-label={`${t.chipLabel}: ${label}`}
        className={cn(
          "inline-flex shrink-0 items-center gap-2 rounded-staff border text-[13px] font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus data-popup-open:bg-well",
          compact ? "size-[38px] justify-center border-transparent hover:bg-well" : "min-h-10 px-3",
          !compact && (on ? "border-success/30 bg-success-bg text-ink hover:border-success/50" : "border-border bg-canvas text-ink hover:bg-well"),
        )}
      >
        <span className="relative inline-flex">
          <Clock aria-hidden className="size-4" />
          <span
            aria-hidden
            className={cn(
              "absolute -end-0.5 -top-0.5 size-2 rounded-full ring-2 ring-canvas",
              on ? "bg-success" : done ? "bg-ink-secondary/50" : "bg-warning",
            )}
          />
        </span>
        {compact ? null : <span className="tabular-nums">{label}</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} className="z-50 outline-none">
          <Popover.Popup className="w-[min(360px,calc(100vw-24px))] origin-(--transform-origin) rounded-staff border border-ink/15 bg-canvas p-4 text-ink shadow-dialog outline-none transition-[opacity,scale,translate] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] data-starting-style:-translate-y-1.5 data-starting-style:scale-[0.97] data-starting-style:opacity-0 data-ending-style:-translate-y-1 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-in motion-reduce:transition-none">
            <ClockBody attendance={attendance} tillHref={tillHref} footer={footer} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
