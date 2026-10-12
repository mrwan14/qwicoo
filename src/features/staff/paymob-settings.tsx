"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { StatusChip } from "@/components/ops/status-chip";
import { useStaffSession } from "@/components/ops/staff-session";
import { ApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { paymobCopy } from "@/lib/i18n/staff/paymob";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { paymobError } from "@/lib/paymob/errors";
import {
  SETUP_CHECKS,
  canManagePaymobGateway,
  paymobConnectionStatus,
  paymobDashboardUrls,
  paymobUpsertBody,
  setupChecklist,
  type PaymobDraft,
  type SetupCheckId,
  type SetupCheckState,
} from "@/lib/paymob/gateway";

const field = "h-11 w-full rounded-none border border-border bg-background px-3 text-sm";

type Gateway = components["schemas"]["PaymobGatewayResponse"];

const emptyDraft = (): PaymobDraft => ({
  secretKey: "",
  publicKey: "",
  hmacSecret: "",
  card: "",
  wallet: "",
  kiosk: "",
  currency: "EGP",
  isLive: false,
  isActive: true,
});

function draftFromGateway(gateway: Gateway): PaymobDraft {
  return {
    ...emptyDraft(),
    card: gateway.integration_ids.card?.toString() ?? "",
    wallet: gateway.integration_ids.wallet?.toString() ?? "",
    kiosk: gateway.integration_ids.kiosk?.toString() ?? "",
    currency: gateway.currency || "EGP",
    isLive: gateway.is_live,
    isActive: gateway.is_active,
  };
}

export function PaymobSettings({ brandId, apiOrigin }: { brandId: string; apiOrigin: string }) {
  const t = useStaffSection(paymobCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const allowed = canManagePaymobGateway(me?.role);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PaymobDraft>(emptyDraft);
  const [hydrated, setHydrated] = useState(false);
  const [checks, setChecks] = useState<Record<SetupCheckId, SetupCheckState> | null>(null);
  const [checkNote, setCheckNote] = useState<string | null>(null);

  const gateway = useQuery({
    queryKey: ["paymob-gateway", brandId],
    enabled: allowed,
    retry: false,
    queryFn: async (): Promise<Gateway | null> => {
      const result = await browserApi.GET("/api/v1/brands/{brand_id}/payment-gateways/paymob", {
        params: { path: { brand_id: brandId } },
      });
      if (result.response.status === 404) {
        const error = paymobError(result.error, result.response, t.loadFailed, locale);
        if (error.code === "PAYMOB_GATEWAY_NOT_CONFIGURED") return null;
        throw error;
      }
      if (!result.response.ok || !result.data) throw paymobError(result.error, result.response, t.loadFailed, locale);
      return result.data;
    },
  });

  useEffect(() => {
    if (!gateway.isSuccess || hydrated) return;
    setDraft(gateway.data ? draftFromGateway(gateway.data) : emptyDraft());
    setHydrated(true);
  }, [gateway.isSuccess, gateway.data, hydrated]);

  const save = useMutation({
    mutationFn: async () => {
      const built = paymobUpsertBody(draft, gateway.data != null);
      if (!built.ok) {
        const message =
          built.reason === "currency" ? t.currencyInvalid : built.reason === "secrets" ? t.secretsRequired : t.integrationInvalid;
        throw new ApiError(0, message, null);
      }
      const result = await browserApi.PUT("/api/v1/brands/{brand_id}/payment-gateways/paymob", {
        params: { path: { brand_id: brandId } },
        body: built.body,
      });
      if (!result.response.ok || !result.data) throw paymobError(result.error, result.response, t.saveFailed, locale);
      return result.data;
    },
    onSuccess: (saved) => {
      toast.success(t.saved);
      setDraft(draftFromGateway(saved));
      setChecks(null);
      setCheckNote(null);
      queryClient.setQueryData(["paymob-gateway", brandId], saved);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const test = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/brands/{brand_id}/payment-gateways/paymob/test", {
        params: { path: { brand_id: brandId } },
      });
      if (!result.response.ok) throw paymobError(result.error, result.response, t.checkFailed, locale);
      return result.data ?? null;
    },
    onSuccess: () => {
      setChecks(setupChecklist(null));
      setCheckNote(null);
    },
    onError: (error: Error) => {
      const code = error instanceof ApiError ? error.code : null;
      setChecks(setupChecklist(code));
      setCheckNote(error.message);
    },
  });

  if (!allowed) return null;

  const status = paymobConnectionStatus(gateway.data ?? null);
  const statusLabel = status === "live" ? t.statusLive : status === "test" ? t.statusTest : t.statusDisconnected;
  const tone = status === "live" ? "available" : status === "test" ? "browsing" : "neutral";
  const urls = paymobDashboardUrls(apiOrigin);
  const checkLabel: Record<SetupCheckId, string> = {
    secret: t.secretCheck,
    public: t.publicCheck,
    hmac: t.hmacCheck,
    integration: t.integrationCheck,
  };
  const stateLabel: Record<SetupCheckState, string> = {
    passed: t.passed,
    failed: t.failed,
    pending: t.notRun,
  };

  return (
    <section className="grid w-full gap-5 border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">{t.title}</h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{t.intro}</p>
        </div>
        <StatusChip tone={tone}>{statusLabel}</StatusChip>
      </div>

      {gateway.isLoading ? <p className="text-sm text-muted-foreground">{t.loading}</p> : null}
      {gateway.isError ? <p className="text-sm text-destructive">{gateway.error.message}</p> : null}

      {gateway.isSuccess ? (
        <form
          className="grid w-full gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <SecretField
              label={t.secretKey}
              hint={gateway.data ? fill(t.currentSecret, { mask: gateway.data.secret_key_masked }) : t.keepSecret}
              value={draft.secretKey}
              onChange={(secretKey) => setDraft((current) => ({ ...current, secretKey }))}
            />
            <SecretField
              label={t.publicKey}
              hint={gateway.data ? fill(t.currentSecret, { mask: gateway.data.public_key_masked }) : t.keepSecret}
              value={draft.publicKey}
              onChange={(publicKey) => setDraft((current) => ({ ...current, publicKey }))}
            />
            <SecretField
              label={t.hmacSecret}
              hint={gateway.data ? fill(t.currentSecret, { mask: gateway.data.hmac_secret_masked }) : t.keepSecret}
              value={draft.hmacSecret}
              onChange={(hmacSecret) => setDraft((current) => ({ ...current, hmacSecret }))}
            />
          </div>
          {gateway.data ? <p className="text-sm text-muted-foreground">{t.keepSecret}</p> : null}

          <div className="grid gap-4 lg:grid-cols-3">
            <TextField label={t.cardId} value={draft.card} inputMode="numeric" onChange={(card) => setDraft((current) => ({ ...current, card }))} />
            <TextField label={t.walletId} value={draft.wallet} inputMode="numeric" onChange={(wallet) => setDraft((current) => ({ ...current, wallet }))} />
            <TextField label={t.kioskId} value={draft.kiosk} inputMode="numeric" onChange={(kiosk) => setDraft((current) => ({ ...current, kiosk }))} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <TextField
              label={t.currency}
              value={draft.currency}
              maxLength={3}
              onChange={(currency) => setDraft((current) => ({ ...current, currency: currency.toUpperCase() }))}
            />
            <fieldset className="grid gap-1 text-sm">
              <legend className="font-medium">{t.mode}</legend>
              <div className="flex">
                <button
                  type="button"
                  aria-pressed={!draft.isLive}
                  className={`min-h-11 flex-1 border border-border px-3 ${draft.isLive ? "bg-background" : "bg-foreground text-background"}`}
                  onClick={() => setDraft((current) => ({ ...current, isLive: false }))}
                >
                  {t.test}
                </button>
                <button
                  type="button"
                  aria-pressed={draft.isLive}
                  className={`min-h-11 flex-1 border border-s-0 border-border px-3 ${draft.isLive ? "bg-foreground text-background" : "bg-background"}`}
                  onClick={() => setDraft((current) => ({ ...current, isLive: true }))}
                >
                  {t.live}
                </button>
              </div>
            </fieldset>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded-none"
                checked={draft.isActive}
                onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))}
              />
              <span className="grid">
                <span className="font-medium">{t.active}</span>
                <span className="text-muted-foreground">{t.activeHint}</span>
              </span>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="min-h-11 bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              disabled={save.isPending}
            >
              {save.isPending ? t.saving : t.save}
            </button>
            <button
              type="button"
              className="min-h-11 border border-border px-4 text-sm font-medium disabled:opacity-50"
              disabled={test.isPending || gateway.data == null}
              onClick={() => test.mutate()}
            >
              {test.isPending ? t.checking : t.check}
            </button>
          </div>

          {checks ? (
            <div className="grid gap-2">
              <ul className="grid w-full border border-border">
                {SETUP_CHECKS.map((id) => (
                  <li key={id} className="flex items-center justify-between gap-3 border-b border-border px-3 py-3 text-sm last:border-b-0">
                    <span>{checkLabel[id]}</span>
                    <span className={checks[id] === "failed" ? "text-destructive" : "text-muted-foreground"}>{stateLabel[checks[id]]}</span>
                  </li>
                ))}
              </ul>
              {checkNote ? <p className="text-sm text-destructive">{checkNote}</p> : null}
            </div>
          ) : null}
        </form>
      ) : null}

      <div className="grid w-full gap-3">
        <div className="grid gap-1">
          <h3 className="font-medium">{t.urlsHint}</h3>
          <p className="text-sm leading-6 text-muted-foreground">{t.callbackNote}</p>
        </div>
        <UrlRow label={t.callback} value={urls.callback} copyLabel={t.copy} copiedLabel={t.copied} failedLabel={t.copyFailed} />
        <UrlRow label={t.redirect} value={urls.redirect} copyLabel={t.copy} copiedLabel={t.copied} failedLabel={t.copyFailed} />
      </div>
    </section>
  );
}

function SecretField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground">{hint}</span>
      <input
        className={field}
        type="password"
        autoComplete="new-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "numeric" | "text";
  maxLength?: number;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        className={field}
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function UrlRow({
  label,
  value,
  copyLabel,
  copiedLabel,
  failedLabel,
}: {
  label: string;
  value: string;
  copyLabel: string;
  copiedLabel: string;
  failedLabel: string;
}) {
  return (
    <div className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <div className="flex w-full">
        <input className={`${field} min-w-0 flex-1 font-mono`} readOnly value={value} dir="ltr" />
        <button
          type="button"
          className="min-h-11 shrink-0 border border-s-0 border-border px-4"
          onClick={() => {
            void navigator.clipboard.writeText(value).then(
              () => toast.success(copiedLabel),
              () => toast.error(failedLabel),
            );
          }}
        >
          {copyLabel}
        </button>
      </div>
    </div>
  );
}
