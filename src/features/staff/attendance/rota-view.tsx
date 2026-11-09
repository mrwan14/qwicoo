"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ops/kit/button";
import { Field, Input } from "@/components/ops/kit/field";
import { SegmentedControl } from "@/components/ops/kit/segmented";
import { SidePanel } from "@/components/ops/kit/side-panel";
import { ErrorState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { isUserRole, roleLabel } from "@/lib/auth/roles";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { attendanceCopy } from "@/lib/i18n/staff/attendance";
import { commonCopy } from "@/lib/i18n/staff/common";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

import { addDays, branchNow, weekStart } from "./time";

type Staff = components["schemas"]["StaffResponse"];
type Shift = components["schemas"]["RotaShift"];
type Kind = "shift" | "off" | "usual";

// The people the API plans and counts (attendance_schedule.SCHEDULED_ROLES).
const SCHEDULED = new Set(["BRANCH_ADMIN", "CASHIER", "WAITER", "KITCHEN_STAFF", "RUNNER"]);
const ZONE = "Africa/Cairo";

const hhmm = (value: string | null | undefined) => (value ? value.slice(0, 5) : "");

export function useBranchStaff(branchId: string | null) {
  return useQuery({
    queryKey: ["attendance-branch-staff", branchId],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/staff", { params: { path: { branch_id: branchId! } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "");
      return (result.data.records ?? [])
        .filter((person) => person.is_active && SCHEDULED.has(person.role))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
  });
}

export function RotaView({ branchId, canEdit }: { branchId: string | null; canEdit: boolean }) {
  const t = useStaffSection(attendanceCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const today = branchNow(ZONE).day;
  const [start, setStart] = useState(() => weekStart(today));
  const [editing, setEditing] = useState<{ person: Staff; day: string } | null>(null);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const staff = useBranchStaff(branchId);

  const loadWeek = async (from: string) => {
    const result = await browserApi.GET("/api/v1/branches/{branch_id}/rota", {
      params: { path: { branch_id: branchId! }, query: { start: from, end: addDays(from, 6) } },
    });
    if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.rota.loadFailed);
    return result.data.shifts;
  };
  const rota = useQuery({ queryKey: ["rota", branchId, start], enabled: Boolean(branchId), queryFn: () => loadWeek(start) });

  const copyLast = useMutation({
    mutationFn: async () => {
      const people = new Set((staff.data ?? []).map((person) => person.id));
      const last = (await loadWeek(addDays(start, -7))).filter((shift) => people.has(shift.user_id));
      if (last.length === 0) return 0;
      const result = await browserApi.PUT("/api/v1/branches/{branch_id}/rota", {
        params: { path: { branch_id: branchId! } },
        body: {
          shifts: last.map((shift) => ({
            user_id: shift.user_id,
            date: addDays(shift.date, 7),
            start_time: shift.is_day_off ? null : hhmm(shift.start_time),
            end_time: shift.is_day_off ? null : hhmm(shift.end_time),
            is_day_off: shift.is_day_off ?? false,
            note: shift.note ?? null,
          })),
          clear: [],
        },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.rota.failed);
      return last.length;
    },
    onSuccess: async (count) => {
      if (count === 0) {
        toast.info(t.rota.nothingToCopy);
        return;
      }
      toast.success(t.rota.copied);
      await queryClient.invalidateQueries({ queryKey: ["rota", branchId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!branchId) return <p className="text-sm text-ink-secondary">{t.rota.chooseBranch}</p>;
  if (rota.isError || staff.isError) {
    return <ErrorState body={t.rota.loadFailed} onRetry={() => void Promise.all([rota.refetch(), staff.refetch()])} />;
  }

  const byCell = new Map((rota.data ?? []).map((shift) => [`${shift.user_id}|${shift.date}`, shift]));
  const people = staff.data ?? [];
  const dateFormat = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const weekdayFormat = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { weekday: "short", timeZone: "UTC" });
  const label = (day: string) => new Date(`${day}T00:00:00Z`);
  const loading = rota.isLoading || staff.isLoading;

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-0.5">
          <p className="text-sm text-ink">{t.rota.intro}</p>
          <p className="text-xs text-ink-secondary">{t.rota.plannedRule}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="icon" variant="secondary" aria-label={t.rota.prevWeek} onClick={() => setStart(addDays(start, -7))}>
            <ChevronLeft aria-hidden className="rtl:rotate-180" />
          </Button>
          <span className="min-w-36 text-center text-sm font-medium text-ink tabular-nums">
            {dateFormat.format(label(days[0]))} – {dateFormat.format(label(days[6]))}
          </span>
          <Button size="icon" variant="secondary" aria-label={t.rota.nextWeek} onClick={() => setStart(addDays(start, 7))}>
            <ChevronRight aria-hidden className="rtl:rotate-180" />
          </Button>
          {start !== weekStart(today) ? (
            <Button size="field" variant="ghost" onClick={() => setStart(weekStart(today))}>
              {t.rota.thisWeek}
            </Button>
          ) : null}
          {canEdit ? (
            <Button size="field" variant="secondary" disabled={copyLast.isPending || loading} onClick={() => copyLast.mutate()}>
              <Copy aria-hidden />
              {copyLast.isPending ? t.rota.copying : t.rota.copyLast}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-staff border border-border bg-canvas">
        <table className="w-full min-w-[760px] table-fixed border-collapse text-sm text-ink">
          <thead>
            <tr className="border-b border-border bg-subtle">
              <th scope="col" className="h-10 w-44 ps-4 pe-2 text-start text-xs font-semibold text-ink-secondary lg:w-56">
                {t.rota.person}
              </th>
              {days.map((day) => (
                <th key={day} scope="col" className={cn("h-10 px-1 text-center text-xs font-semibold text-ink-secondary", day === today && "text-ink")}>
                  <span className="block">{weekdayFormat.format(label(day))}</span>
                  <span className="block font-normal tabular-nums">{dateFormat.format(label(day))}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-ink-secondary">
                  …
                </td>
              </tr>
            ) : people.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-ink-secondary">
                  {t.rota.nobody}
                </td>
              </tr>
            ) : (
              people.map((person) => (
                <tr key={person.id} className="border-b border-border last:border-b-0">
                  <th scope="row" className="py-2 ps-4 pe-2 text-start font-normal">
                    <span className="block font-medium text-ink">{person.full_name}</span>
                    <span className="block text-xs text-ink-secondary">
                      {isUserRole(person.role) ? roleLabel(person.role, locale) : person.role}
                      {" · "}
                      {fill(t.rota.usual, { start: hhmm(person.shift_start_time) || "10:00", end: hhmm(person.shift_end_time) || "18:00" })}
                    </span>
                  </th>
                  {days.map((day) => {
                    const shift = byCell.get(`${person.id}|${day}`);
                    const text = shift?.is_day_off ? t.rota.off : shift ? `${hhmm(shift.start_time)}–${hhmm(shift.end_time)}` : t.rota.empty;
                    return (
                      <td key={day} className="p-1">
                        <button
                          type="button"
                          disabled={!canEdit}
                          title={shift?.note ?? undefined}
                          onClick={() => setEditing({ person, day })}
                          className={cn(
                            "relative flex min-h-11 w-full items-center justify-center rounded-staff border px-1 text-[13px] whitespace-nowrap tabular-nums transition-colors",
                            shift?.is_day_off
                              ? "border-border bg-subtle text-ink-secondary"
                              : shift
                                ? "border-ink/20 bg-canvas font-medium text-ink"
                                : "border-dashed border-border text-ink-secondary/70",
                            canEdit && "hover:border-ink/40 hover:bg-subtle focus-visible:outline-2 focus-visible:outline-focus",
                            day === today && "ring-1 ring-ink/10",
                          )}
                        >
                          {text}
                          {shift?.note ? <span aria-hidden className="absolute end-1 top-1 size-1.5 rounded-full bg-ink-secondary/60" /> : null}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {editing && branchId ? (
        <ShiftPanel
          key={`${editing.person.id}|${editing.day}`}
          branchId={branchId}
          person={editing.person}
          day={editing.day}
          current={byCell.get(`${editing.person.id}|${editing.day}`) ?? null}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}

function ShiftPanel({ branchId, person, day, current, onClose }: { branchId: string; person: Staff; day: string; current: Shift | null; onClose: () => void }) {
  const t = useStaffSection(attendanceCopy);
  const common = useStaffSection(commonCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const usualStart = hhmm(person.shift_start_time) || "10:00";
  const usualEnd = hhmm(person.shift_end_time) || "18:00";
  const [kind, setKind] = useState<Kind>(current?.is_day_off ? "off" : current ? "shift" : "usual");
  const [startAt, setStartAt] = useState(hhmm(current?.start_time) || usualStart);
  const [endAt, setEndAt] = useState(hhmm(current?.end_time) || usualEnd);
  const [note, setNote] = useState(current?.note ?? "");
  const [tried, setTried] = useState(false);
  const ready = kind !== "shift" || (Boolean(startAt) && Boolean(endAt) && startAt !== endAt);

  const save = useMutation({
    mutationFn: async () => {
      const body =
        kind === "usual"
          ? { shifts: [], clear: [{ user_id: person.id, date: day }] }
          : {
              shifts: [
                {
                  user_id: person.id,
                  date: day,
                  is_day_off: kind === "off",
                  start_time: kind === "off" ? null : startAt,
                  end_time: kind === "off" ? null : endAt,
                  note: note.trim() || null,
                },
              ],
              clear: [],
            };
      const result = await browserApi.PUT("/api/v1/branches/{branch_id}/rota", { params: { path: { branch_id: branchId } }, body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.rota.failed);
    },
    onSuccess: async () => {
      toast.success(t.rota.saved);
      await queryClient.invalidateQueries({ queryKey: ["rota", branchId] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const dayLabel = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
  return (
    <SidePanel
      open
      onOpenChange={(open) => !open && onClose()}
      title={person.full_name}
      description={dayLabel}
      footer={
        <div className="grid w-full gap-2">
          {tried && !ready ? (
            <p role="alert" className="text-xs text-danger">
              {t.rota.needTimes}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              {common.cancel}
            </Button>
            <Button disabled={save.isPending} onClick={() => (ready ? save.mutate() : setTried(true))}>
              {save.isPending ? t.rota.saving : t.rota.save}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">{t.rota.kind}</span>
        <SegmentedControl<Kind>
          label={t.rota.kind}
          value={kind}
          onValueChange={setKind}
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
          items={[
            { value: "shift", label: t.rota.kindShift },
            { value: "off", label: t.rota.kindOff },
            { value: "usual", label: t.rota.kindUsual },
          ]}
        />
        {kind === "usual" ? <p className="text-xs text-ink-secondary">{fill(t.rota.usual, { start: usualStart, end: usualEnd })}</p> : null}
      </div>
      {kind === "shift" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.rota.start}>
            <Input type="time" value={startAt} aria-invalid={tried && !startAt ? true : undefined} onChange={(event) => setStartAt(event.target.value)} />
          </Field>
          <Field label={t.rota.end} hint={endAt && startAt && endAt < startAt ? t.rota.endHint : undefined}>
            <Input type="time" value={endAt} aria-invalid={tried && !endAt ? true : undefined} onChange={(event) => setEndAt(event.target.value)} />
          </Field>
        </div>
      ) : null}
      {kind !== "usual" ? (
        <Field label={t.rota.note} hint={t.rota.noteHint}>
          <Input value={note} maxLength={120} onChange={(event) => setNote(event.target.value)} />
        </Field>
      ) : null}
    </SidePanel>
  );
}
