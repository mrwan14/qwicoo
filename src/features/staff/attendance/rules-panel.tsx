"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ops/kit/button";
import { Field, Input } from "@/components/ops/kit/field";
import { SidePanel } from "@/components/ops/kit/side-panel";
import { ErrorState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { attendanceCopy } from "@/lib/i18n/staff/attendance";
import { commonCopy } from "@/lib/i18n/staff/common";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

import { parseMinutes } from "./sheet";

type Rules = components["schemas"]["AttendanceRulesResponse"];
type Key = "late_after_minutes" | "early_leave_minutes" | "overtime_after_minutes";

const LIMITS: Record<Key, number> = { late_after_minutes: 240, early_leave_minutes: 240, overtime_after_minutes: 600 };

export function RulesPanel({ branchId, onClose }: { branchId: string; onClose: () => void }) {
  const t = useStaffSection(attendanceCopy);
  const rules = useQuery({
    queryKey: ["attendance-rules", branchId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/attendance-rules", { params: { path: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.rules.failed);
      return result.data;
    },
  });
  return (
    <SidePanel open onOpenChange={(open) => !open && onClose()} title={t.rules.title} description={t.rules.intro}>
      {rules.isError ? <ErrorState body={t.rules.failed} onRetry={() => void rules.refetch()} /> : null}
      {rules.data ? <RulesForm branchId={branchId} rules={rules.data} onClose={onClose} /> : null}
    </SidePanel>
  );
}

function RulesForm({ branchId, rules, onClose }: { branchId: string; rules: Rules; onClose: () => void }) {
  const t = useStaffSection(attendanceCopy);
  const common = useStaffSection(commonCopy);
  const queryClient = useQueryClient();
  const initial = (key: Key) => (rules[key] == null ? "" : String(rules[key]));
  const [values, setValues] = useState<Record<Key, string>>({
    late_after_minutes: initial("late_after_minutes"),
    early_leave_minutes: initial("early_leave_minutes"),
    overtime_after_minutes: initial("overtime_after_minutes"),
  });
  const parsed = Object.fromEntries((Object.keys(LIMITS) as Key[]).map((key) => [key, parseMinutes(values[key], LIMITS[key])])) as Record<Key, number | null | undefined>;
  const valid = Object.values(parsed).every((value) => value !== undefined);

  const save = useMutation({
    mutationFn: async () => {
      const result = await browserApi.PUT("/api/v1/branches/{branch_id}/attendance-rules", {
        params: { path: { branch_id: branchId } },
        body: {
          late_after_minutes: parsed.late_after_minutes ?? null,
          early_leave_minutes: parsed.early_leave_minutes ?? null,
          overtime_after_minutes: parsed.overtime_after_minutes ?? null,
        },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.rules.failed);
    },
    onSuccess: async () => {
      toast.success(t.rules.saved);
      await queryClient.invalidateQueries({ queryKey: ["attendance-rules", branchId] });
      await queryClient.invalidateQueries({ queryKey: ["attendance-logs"] });
      await queryClient.invalidateQueries({ queryKey: ["timesheet", branchId] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const field = (key: Key, label: string, hint: string) => (
    <Field label={label} hint={fill(hint, { minutes: rules.defaults[key] ?? 0 })} error={parsed[key] === undefined ? t.rules.invalid : undefined}>
      <Input
        inputMode="numeric"
        value={values[key]}
        placeholder={String(rules.defaults[key] ?? "")}
        aria-invalid={parsed[key] === undefined ? true : undefined}
        onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
      />
    </Field>
  );

  return (
    <div className="grid gap-4">
      {field("late_after_minutes", t.rules.lateAfter, t.rules.lateAfterHint)}
      {field("early_leave_minutes", t.rules.earlyLeave, t.rules.earlyLeaveHint)}
      {field("overtime_after_minutes", t.rules.overtimeAfter, t.rules.overtimeAfterHint)}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose}>
          {common.cancel}
        </Button>
        <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? t.rules.saving : t.rules.save}
        </Button>
      </div>
    </div>
  );
}
