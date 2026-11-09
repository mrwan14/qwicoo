"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ops/kit/button";
import { Field, Input } from "@/components/ops/kit/field";
import { SidePanel } from "@/components/ops/kit/side-panel";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { attendanceCopy } from "@/lib/i18n/staff/attendance";
import { commonCopy } from "@/lib/i18n/staff/common";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

import { parseMinutes } from "./sheet";

type Staff = components["schemas"]["StaffResponse"];

const hhmm = (value: string | null | undefined, fallback: string) => (value ? value.slice(0, 5) : fallback);

/** A person's usual shift (start, end, late grace). The rota overrides it day by day. */
export function UsualShiftPanel({ person, onClose }: { person: Staff; onClose: () => void }) {
  const t = useStaffSection(attendanceCopy);
  const common = useStaffSection(commonCopy);
  const queryClient = useQueryClient();
  const [start, setStart] = useState(hhmm(person.shift_start_time, "10:00"));
  const [end, setEnd] = useState(hhmm(person.shift_end_time, "18:00"));
  const [grace, setGrace] = useState(String(person.late_grace_period_minutes ?? 30));
  const [tried, setTried] = useState(false);
  const minutes = parseMinutes(grace, 180);
  const timesOk = Boolean(start) && Boolean(end) && start !== end;
  const problem = !timesOk ? t.usual.needTimes : minutes == null ? t.usual.badGrace : null;

  const save = useMutation({
    mutationFn: async () => {
      const result = await browserApi.PATCH("/api/v1/staff/{staff_id}", {
        params: { path: { staff_id: person.id } },
        body: { shift_start_time: `${start}:00`, shift_end_time: `${end}:00`, late_grace_period_minutes: minutes ?? 30 },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.usual.failed);
    },
    onSuccess: async () => {
      toast.success(t.usual.saved);
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
      await queryClient.invalidateQueries({ queryKey: ["attendance-branch-staff"] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <SidePanel
      open
      onOpenChange={(open) => !open && onClose()}
      title={fill(t.usual.title, { name: person.full_name })}
      description={t.usual.intro}
      footer={
        <div className="grid w-full gap-2">
          {tried && problem ? (
            <p role="alert" className="text-xs text-danger">
              {problem}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              {common.cancel}
            </Button>
            <Button disabled={save.isPending} onClick={() => (problem ? setTried(true) : save.mutate())}>
              {save.isPending ? t.usual.saving : t.usual.save}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.usual.start}>
          <Input type="time" value={start} aria-invalid={tried && !timesOk ? true : undefined} onChange={(event) => setStart(event.target.value)} />
        </Field>
        <Field label={t.usual.end} hint={end && start && end < start ? t.usual.endHint : undefined}>
          <Input type="time" value={end} aria-invalid={tried && !timesOk ? true : undefined} onChange={(event) => setEnd(event.target.value)} />
        </Field>
      </div>
      <Field label={t.usual.grace} hint={t.usual.graceHint}>
        <Input inputMode="numeric" value={grace} aria-invalid={tried && minutes == null ? true : undefined} onChange={(event) => setGrace(event.target.value)} />
      </Field>
    </SidePanel>
  );
}
