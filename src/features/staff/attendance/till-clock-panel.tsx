"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { ArrowLeft, Delete, KeyRound, Lock, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ops/kit/badge";
import { Button } from "@/components/ops/kit/button";
import { Input } from "@/components/ops/kit/field";
import { SidePanel } from "@/components/ops/kit/side-panel";
import { ErrorState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { isUserRole, roleLabel } from "@/lib/auth/roles";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { attendanceCopy } from "@/lib/i18n/staff/attendance";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

import { MY_ATTENDANCE_KEY } from "./clock";
import { PinPanel } from "./pin-panel";
import { triesLeft, validPin } from "./sheet";
import { clockOf } from "./time";

type Person = components["schemas"]["TillRosterPerson"];

/** On a signed-in till: pick your name, enter your PIN, and you're clocked in or out. */
export function TillClockPanel({ branchId, canManagePins, onClose }: { branchId: string; canManagePins: boolean; onClose: () => void }) {
  const t = useStaffSection(attendanceCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState<Person | null>(null);
  const [pinFor, setPinFor] = useState<Person | null>(null);
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState<string | null>(null);

  const roster = useQuery({
    queryKey: ["till-roster", branchId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/till-roster", { params: { path: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.till.loadFailed);
      return result.data.people;
    },
  });

  const punch = useMutation({
    mutationFn: async ({ who, action }: { who: Person; action: "in" | "out" }) => {
      const result = await browserApi.POST("/api/v1/branches/{branch_id}/till-punch", {
        params: { path: { branch_id: branchId } },
        body: { user_id: who.user_id, pin, action },
      });
      if (!result.response.ok) {
        const error = asApiError(result.error, result.response, t.till.loadFailed);
        if (error.code === "ATTENDANCE_PIN_WRONG") {
          const left = triesLeft(result.error);
          const text = left === 0 ? t.till.lockedNow : left === 1 ? t.till.wrongLast : fill(t.till.wrong, { left: left ?? 0 });
          throw Object.assign(new Error(text), { wrongPin: true, left });
        }
        throw error;
      }
      return result.data;
    },
    onSuccess: async (data, { who, action }) => {
      const at = clockOf(action === "in" ? data?.attendance.check_in : data?.attendance.check_out);
      toast.success(fill(action === "in" ? t.till.clockedIn : t.till.clockedOut, { name: who.full_name, time: at }));
      await queryClient.invalidateQueries({ queryKey: ["till-roster", branchId] });
      await queryClient.invalidateQueries({ queryKey: ["attendance-logs"] });
      await queryClient.invalidateQueries({ queryKey: MY_ATTENDANCE_KEY });
      setPerson(null);
      setPin("");
      setWrong(null);
    },
    onError: async (error: Error & { wrongPin?: boolean; left?: number | null }) => {
      setPin("");
      if (error.wrongPin && error.left !== 0) {
        setWrong(error.message);
        return;
      }
      setWrong(null);
      toast.error(error.message);
      // Locked or not set: back to the list, which now shows why.
      await queryClient.invalidateQueries({ queryKey: ["till-roster", branchId] });
      setPerson(null);
    },
  });

  if (pinFor) {
    return <PinPanel person={{ id: pinFor.user_id, name: pinFor.full_name }} branchId={branchId} onClose={() => setPinFor(null)} />;
  }

  const roleName = (role: string | null | undefined) => (role && isUserRole(role) ? roleLabel(role, locale) : (role ?? ""));
  const people = (roster.data ?? []).filter((item) => item.full_name.toLowerCase().includes(query.trim().toLowerCase()));
  const action: "in" | "out" = person?.on_shift ? "out" : "in";
  const press = (digit: string) => {
    setWrong(null);
    setPin((current) => (current.length < 6 ? current + digit : current));
  };
  const submit = () => {
    if (person && validPin(pin) && !punch.isPending) punch.mutate({ who: person, action });
  };

  return (
    <SidePanel
      open
      onOpenChange={(open) => !open && onClose()}
      title={person ? person.full_name : t.till.title}
      description={person ? t.till.enterPin : t.till.intro}
    >
      {!person ? (
        <div className="grid gap-3">
          <label className="relative block">
            <span className="sr-only">{t.till.search}</span>
            <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-secondary" />
            <Input value={query} placeholder={t.till.search} className="ps-9" onChange={(event) => setQuery(event.target.value)} />
          </label>
          {roster.isError ? <ErrorState body={t.till.loadFailed} onRetry={() => void roster.refetch()} /> : null}
          {roster.data && roster.data.length === 0 ? <p className="text-sm text-ink-secondary">{t.till.nobody}</p> : null}
          <ul className="grid gap-2">
            {people.map((item) => {
              const usable = item.has_pin && !item.locked;
              return (
                <li key={item.user_id} className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!usable}
                    onClick={() => {
                      setPerson(item);
                      setPin("");
                      setWrong(null);
                    }}
                    className={cn(
                      "flex min-h-14 flex-1 items-center justify-between gap-3 rounded-staff border border-border px-4 text-start transition-colors",
                      usable ? "hover:bg-subtle focus-visible:outline-2 focus-visible:outline-focus" : "cursor-not-allowed opacity-60",
                    )}
                  >
                    <span className="grid">
                      <span className="font-medium text-ink">{item.full_name}</span>
                      <span className="text-xs text-ink-secondary">{roleName(item.role)}</span>
                    </span>
                    {item.locked ? (
                      <Badge tone="danger">
                        <Lock aria-hidden className="size-3" />
                        {t.till.locked}
                      </Badge>
                    ) : !item.has_pin ? (
                      <Badge tone="neutral">{t.till.noPin}</Badge>
                    ) : item.on_shift ? (
                      <Badge tone="success">{t.till.onShift}</Badge>
                    ) : null}
                  </button>
                  {canManagePins ? (
                    <Button size="icon" variant="ghost" aria-label={`${item.has_pin ? t.till.changePin : t.till.setPin} · ${item.full_name}`} onClick={() => setPinFor(item)}>
                      <KeyRound aria-hidden />
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="grid gap-4">
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Input
              autoFocus
              type="password"
              inputMode="numeric"
              autoComplete="off"
              aria-label={t.till.enterPin}
              value={pin}
              onChange={(event) => {
                setWrong(null);
                setPin(event.target.value.replace(/\D/g, "").slice(0, 6));
              }}
              className="h-14 text-center text-2xl tracking-[0.5em]"
            />
            {wrong ? (
              <p role="alert" className="text-center text-sm text-danger">
                {wrong}
              </p>
            ) : null}
            <div className="grid grid-cols-3 gap-2" dir="ltr">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                <Button key={digit} type="button" variant="secondary" size="touch" onClick={() => press(digit)}>
                  {digit}
                </Button>
              ))}
              <Button type="button" variant="ghost" size="touch" onClick={() => setPin("")}>
                {t.till.clear}
              </Button>
              <Button type="button" variant="secondary" size="touch" onClick={() => press("0")}>
                0
              </Button>
              <Button type="button" variant="ghost" size="touch" aria-label={t.till.delete} onClick={() => setPin((current) => current.slice(0, -1))}>
                <Delete aria-hidden className="rtl:rotate-180" />
              </Button>
            </div>
            <Button type="submit" size="touch" disabled={!validPin(pin) || punch.isPending}>
              {punch.isPending ? t.till.working : action === "in" ? t.till.clockIn : t.till.clockOut}
            </Button>
          </form>
          <Button
            variant="ghost"
            onClick={() => {
              setPerson(null);
              setPin("");
              setWrong(null);
            }}
          >
            <ArrowLeft aria-hidden className="rtl:rotate-180" />
            {t.till.back}
          </Button>
        </div>
      )}
    </SidePanel>
  );
}
