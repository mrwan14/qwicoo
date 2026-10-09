"use client";

import { Bell, BellOff, Volume2, VolumeX } from "lucide-react";

import { commonCopy } from "@/lib/i18n/staff/common";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { playTone, unlockAudio } from "@/lib/sound/tones";
import { useWorkspace } from "@/stores/workspace";

import { useAlertPreferences, useSoundSetting } from "./preferences";
import { NotificationsControl } from "./staff-push";

const chip =
  "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** Header controls for order alerts. Hidden when a role can't use them. */
export function AlertControls() {
  const t = useStaffSection(commonCopy);
  const { active, isAdmin } = useAlertPreferences();
  const [sound, setSound] = useSoundSetting();
  const adminOptIn = useWorkspace((state) => state.adminOrderAlerts);
  const setAdminOptIn = useWorkspace((state) => state.setAdminOrderAlerts);

  return (
    <>
      {isAdmin ? (
        <button
          type="button"
          className={`${chip} ${adminOptIn ? "text-primary" : ""}`}
          aria-pressed={adminOptIn}
          onClick={() => setAdminOptIn(!adminOptIn)}
          title={adminOptIn ? t.orderAlertsOn : t.orderAlertsOff}
        >
          {adminOptIn ? <Bell className="size-4" aria-hidden /> : <BellOff className="size-4" aria-hidden />}
          <span className="hidden md:inline">{t.orderAlerts}</span>
          <span className="sr-only md:hidden">{t.orderAlerts} {adminOptIn ? t.alertsOn : t.alertsOff}</span>
        </button>
      ) : null}
      {active ? (
        <button
          type="button"
          className={`${chip} ${sound ? "text-primary" : "text-muted-foreground"}`}
          aria-pressed={sound}
          aria-label={sound ? t.muteSound : t.soundOn}
          onClick={() => {
            const next = !sound;
            setSound(next);
            if (next) void unlockAudio().then(() => playTone("new"));
          }}
        >
          {sound ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
          <span className="hidden md:inline">{sound ? t.soundOnLabel : t.muted}</span>
        </button>
      ) : null}
      <NotificationsControl />
    </>
  );
}
