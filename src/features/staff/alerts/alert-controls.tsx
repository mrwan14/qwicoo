"use client";

import { Bell, BellOff, Volume2, VolumeX } from "lucide-react";

import { commonCopy } from "@/lib/i18n/staff/common";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { playTone, unlockAudio } from "@/lib/sound/tones";
import { useWorkspace } from "@/stores/workspace";

import { alertChip as chip } from "./alert-chip";
import { useAlertPreferences, useSoundSetting } from "./preferences";
import { NotificationsControl } from "./staff-push";

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
          className={`${chip} ${adminOptIn ? "text-ink" : "text-ink-secondary"}`}
          aria-pressed={adminOptIn}
          onClick={() => setAdminOptIn(!adminOptIn)}
          title={adminOptIn ? t.orderAlertsOn : t.orderAlertsOff}
        >
          {adminOptIn ? <Bell className="size-5" aria-hidden /> : <BellOff className="size-5" aria-hidden />}
          <span className="sr-only">{t.orderAlerts} {adminOptIn ? t.alertsOn : t.alertsOff}</span>
        </button>
      ) : null}
      {active ? (
        <button
          type="button"
          className={`${chip} ${sound ? "text-ink" : "text-ink-secondary"}`}
          aria-pressed={sound}
          aria-label={sound ? t.muteSound : t.soundOn}
          title={sound ? t.soundOnLabel : t.muted}
          onClick={() => {
            const next = !sound;
            setSound(next);
            if (next) void unlockAudio().then(() => playTone("new"));
          }}
        >
          {sound ? <Volume2 className="size-5" aria-hidden /> : <VolumeX className="size-5" aria-hidden />}
        </button>
      ) : null}
      <NotificationsControl />
    </>
  );
}
