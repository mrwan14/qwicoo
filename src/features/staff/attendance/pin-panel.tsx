"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ops/kit/button";
import { Field, Input } from "@/components/ops/kit/field";
import { SidePanel } from "@/components/ops/kit/side-panel";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { fill } from "@/lib/i18n/dictionary";
import { attendanceCopy } from "@/lib/i18n/staff/attendance";
import { commonCopy } from "@/lib/i18n/staff/common";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

import { MY_ATTENDANCE_KEY } from "./clock";
import { validPin } from "./sheet";

/** Set a till PIN: your own, or (for a manager) someone else's at the branch. */
export function PinPanel({
  person,
  branchId,
  onClose,
  onSaved,
}: {
  person?: { id: string; name: string } | null;
  branchId?: string | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const t = useStaffSection(attendanceCopy);
  const common = useStaffSection(commonCopy);
  const queryClient = useQueryClient();
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [tried, setTried] = useState(false);
  const problem = !validPin(pin) ? t.pin.format : pin !== again ? t.pin.mismatch : null;

  const save = useMutation({
    mutationFn: async () => {
      const result =
        person && branchId
          ? await browserApi.PUT("/api/v1/branches/{branch_id}/staff/{user_id}/attendance-pin", {
              params: { path: { branch_id: branchId, user_id: person.id } },
              body: { pin },
            })
          : await browserApi.PUT("/api/v1/attendance/my-pin", { body: { pin } });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.pin.failed);
    },
    onSuccess: async () => {
      toast.success(t.pin.saved);
      await queryClient.invalidateQueries({ queryKey: MY_ATTENDANCE_KEY });
      await queryClient.invalidateQueries({ queryKey: ["till-roster"] });
      onSaved?.();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const digits = (value: string) => value.replace(/\D/g, "").slice(0, 6);
  return (
    <SidePanel
      open
      onOpenChange={(open) => !open && onClose()}
      title={person ? fill(t.pin.titleFor, { name: person.name }) : t.pin.titleMine}
      description={t.pin.intro}
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
              {save.isPending ? t.pin.saving : t.pin.save}
            </Button>
          </div>
        </div>
      }
    >
      <Field label={t.pin.pin}>
        <Input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          value={pin}
          aria-invalid={tried && !validPin(pin) ? true : undefined}
          onChange={(event) => setPin(digits(event.target.value))}
          className="tracking-[0.4em]"
        />
      </Field>
      <Field label={t.pin.confirm}>
        <Input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          value={again}
          aria-invalid={tried && pin !== again ? true : undefined}
          onChange={(event) => setAgain(digits(event.target.value))}
          className="tracking-[0.4em]"
        />
      </Field>
    </SidePanel>
  );
}
