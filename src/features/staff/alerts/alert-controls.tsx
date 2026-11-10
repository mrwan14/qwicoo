"use client";

import { Popover } from "@base-ui/react/popover";
import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { Bell, BellOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Switch } from "@/components/ops/kit/field";
import { useStaffSession } from "@/components/ops/staff-session";
import { fetchFloorLive, floorLiveQueryKey } from "@/hooks/use-floor-live";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { commonCopy } from "@/lib/i18n/staff/common";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { playTone, unlockAudio } from "@/lib/sound/tones";
import { useScope } from "@/stores/scope";
import { useWorkspace } from "@/stores/workspace";

import { alertChip as chip } from "./alert-chip";
import type { AlertKind } from "./diff";
import { useAlertHistory, type AlertEntry } from "./history";
import { useAlertPreferences, useSoundSetting } from "./preferences";
import { usePushNotifications } from "./staff-push";

const KIND_DOT: Record<AlertKind, string> = {
  confirmation: "bg-signal-new",
  "kitchen-ticket": "bg-signal-new",
  "store-online": "bg-signal-new",
  "service-request": "bg-signal-wip",
  payment: "bg-signal-wip",
  "floor-status": "bg-signal-done",
  "handover-ready": "bg-signal-done",
};

const NO_TABLES: string[] = [];

/** Header bell: recent alerts, plus order alerts, sound, notifications and "My tables" for this device. */
export function AlertControls() {
  const t = useStaffSection(commonCopy);
  const me = useStaffSession();
  const { active, isAdmin } = useAlertPreferences();
  const adminOptIn = useWorkspace((state) => state.adminOrderAlerts);
  const reportOpen = useAlertHistory((state) => state.setPanelOpen);
  const openRequest = useAlertHistory((state) => state.openRequest);
  const unread = useAlertHistory((state) => state.unread);
  const push = usePushNotifications();
  // Headers render one bell per layout (phone and desktop) and hide the other with CSS, so each bell
  // keeps its own open state and only the one on screen answers a toast's "View".
  const [open, setOpenState] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const seenRequest = useRef(openRequest);
  const setOpen = (next: boolean) => {
    setOpenState(next);
    reportOpen(next);
  };
  useEffect(() => {
    if (openRequest === seenRequest.current) return;
    seenRequest.current = openRequest;
    if (trigger.current && trigger.current.offsetParent !== null) {
      setOpenState(true);
      reportOpen(true);
    }
  }, [openRequest, reportOpen]);

  // Nothing to show or switch for a role that never gets alerts.
  if (!me || (!active && !isAdmin)) return null;

  const BellIcon = isAdmin && !adminOptIn ? BellOff : Bell;
  const label = unread > 0 ? fill(t.newAlerts, { count: unread }) : t.alerts;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger ref={trigger} className={cn(chip, "relative", active ? "text-ink" : "text-ink-secondary")} aria-label={label} title={label}>
        <BellIcon className="size-5" aria-hidden />
        {unread > 0 ? (
          <span
            aria-hidden
            className="absolute -top-0.5 -end-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-signal-new px-1 text-[11px] leading-none font-semibold text-on-ink tabular-nums"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} className="z-50 outline-none">
          <Popover.Popup className="grid max-h-(--available-height) w-[min(360px,calc(100vw-24px))] origin-(--transform-origin) grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-staff border border-ink/15 bg-canvas text-sm text-ink shadow-dialog outline-none transition-[opacity,scale,translate] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] data-starting-style:-translate-y-1.5 data-starting-style:scale-[0.97] data-starting-style:opacity-0 data-ending-style:-translate-y-1 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-in motion-reduce:transition-none">
            <AlertList onNavigate={() => setOpen(false)} />
            <div className="grid gap-1 border-t border-ink/10 bg-well px-3 py-2">
              {isAdmin ? <AdminOptIn /> : null}
              {active ? <SoundRow /> : null}
              {push.mode !== "hidden" ? (
                <Row label={t.notifications} hint={push.denied ? t.notificationsBlockedTitle : t.notificationsHint}>
                  <Switch
                    checked={push.on}
                    disabled={push.busy || push.denied}
                    onCheckedChange={() => void push.toggle()}
                    aria-label={t.notifications}
                  />
                </Row>
              ) : null}
              {active && me.role === "WAITER" ? <MyTables /> : null}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function AlertList({ onNavigate }: { onNavigate: () => void }) {
  const t = useStaffSection(commonCopy);
  const { locale } = useLocale();
  const router = useRouter();
  const entries = useAlertHistory((state) => state.entries);
  const clear = useAlertHistory((state) => state.clear);
  const now = useNow();

  return (
    <>
      <div className="flex min-h-11 items-center justify-between gap-2 border-b border-ink/10 px-3">
        <Popover.Title className="text-sm font-semibold">{t.alerts}</Popover.Title>
        {entries.length > 0 ? (
          <button
            type="button"
            className="rounded-staff px-2 py-1 text-[13px] text-ink-secondary transition-colors hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
            onClick={clear}
          >
            {t.clearAlerts}
          </button>
        ) : null}
      </div>
      {entries.length === 0 ? (
        <p className="px-3 py-6 text-center text-[13px] leading-relaxed text-ink-secondary">{t.alertsEmpty}</p>
      ) : (
        <ul className="overflow-y-auto overscroll-contain py-1">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className="flex w-full items-start gap-2.5 px-3 py-2 text-start transition-colors hover:bg-well focus-visible:bg-well focus-visible:outline-none"
                onClick={() => {
                  onNavigate();
                  router.push(entry.href);
                }}
              >
                <i aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", KIND_DOT[entry.kind])} />
                <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink">{entry.title}</span>
                <span className="shrink-0 text-xs text-ink-secondary tabular-nums">{ago(entry, now, locale)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span className="grid min-w-0 gap-0.5">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        {hint ? <span className="text-xs leading-snug text-ink-secondary">{hint}</span> : null}
      </span>
      {children}
    </div>
  );
}

function AdminOptIn() {
  const t = useStaffSection(commonCopy);
  const adminOptIn = useWorkspace((state) => state.adminOrderAlerts);
  const setAdminOptIn = useWorkspace((state) => state.setAdminOrderAlerts);
  return (
    <Row label={t.orderAlerts} hint={t.orderAlertsHint}>
      <Switch checked={adminOptIn} onCheckedChange={setAdminOptIn} aria-label={t.orderAlerts} />
    </Row>
  );
}

function SoundRow() {
  const t = useStaffSection(commonCopy);
  const [sound, setSound] = useSoundSetting();
  return (
    <Row label={t.alertSound} hint={t.alertSoundHint}>
      <Switch
        checked={sound}
        aria-label={sound ? t.muteSound : t.soundOn}
        onCheckedChange={(next) => {
          setSound(next);
          if (next) void unlockAudio().then(() => playTone("new"));
        }}
      />
    </Row>
  );
}

function MyTables() {
  const t = useStaffSection(commonCopy);
  const branchId = useScope((state) => state.branchId);
  const mine = useWorkspace((state) => (branchId ? state.myTables[branchId] : undefined)) ?? NO_TABLES;
  const setMyTables = useWorkspace((state) => state.setMyTables);
  const floor = useQuery({ queryKey: floorLiveQueryKey(branchId), queryFn: () => fetchFloorLive(branchId), enabled: Boolean(branchId), retry: false });
  const numbers = [...new Set((floor.data?.tables ?? []).map((table) => table.table_number).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  if (!branchId) return null;
  const toggle = (number: string) => setMyTables(branchId, mine.includes(number) ? mine.filter((value) => value !== number) : [...mine, number]);
  const pill = "inline-flex h-8 min-w-9 items-center justify-center rounded-full border px-2.5 text-[13px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-focus";

  return (
    <div className="grid gap-2 border-t border-border py-2">
      <span className="grid gap-0.5">
        <span className="text-[13px] font-medium text-ink">{t.myTables}</span>
        <span className="text-xs leading-snug text-ink-secondary">{t.myTablesHint}</span>
      </span>
      {numbers.length === 0 ? (
        <span className="text-xs text-ink-secondary">{t.noTables}</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={mine.length === 0}
            className={cn(pill, mine.length === 0 ? "border-brand bg-brand text-on-brand" : "border-border bg-canvas text-ink hover:bg-subtle")}
            onClick={() => setMyTables(branchId, [])}
          >
            {t.allTables}
          </button>
          {numbers.map((number) => {
            const on = mine.includes(number);
            return (
              <button
                key={number}
                type="button"
                aria-pressed={on}
                className={cn(pill, on ? "border-brand bg-brand text-on-brand" : "border-border bg-canvas text-ink hover:bg-subtle")}
                onClick={() => toggle(number)}
              >
                {number}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Re-renders every 30 s so "2 min ago" stays true while the panel is open. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function ago(entry: AlertEntry, now: number, locale: string): string {
  const minutes = Math.round((now - entry.at) / 60_000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" });
  if (minutes < 60) return format.format(-Math.max(0, minutes), "minute");
  return format.format(-Math.round(minutes / 60), "hour");
}
