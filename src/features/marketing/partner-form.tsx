"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { landingCopy } from "@/features/marketing/copy";
import { leadFormPhase, publicAssistantInit, publicLeadUrl, validateLead, type LeadDraft, type LeadField } from "@/features/marketing/public-assistant";
import type { LocaleCode } from "@/lib/i18n/locale-text";

const fieldClass = "h-11 w-full border-2 border-ink bg-canvas px-3 text-sm";

const empty: LeadDraft = { name: "", restaurant: "", contact: "", city: "", branches: "", message: "", promo: "" };

export function PartnerForm({ locale, restaurantSeed = "" }: { locale: LocaleCode; restaurantSeed?: string }) {
  const t = landingCopy[locale].lead;
  const [draft, setDraft] = useState<LeadDraft>(empty);
  const [errors, setErrors] = useState<LeadField[]>([]);
  const [received, setReceived] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!restaurantSeed) return;
    setDraft((current) => (current.restaurant === restaurantSeed ? current : { ...current, restaurant: restaurantSeed }));
  }, [restaurantSeed]);

  if (leadFormPhase(received) === "thanks") {
    return (
      <div data-lead className="grid gap-2 border-2 border-ink bg-canvas p-6">
        <h3 className="text-lg font-semibold">{t.thanksTitle}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{t.thanksBody}</p>
      </div>
    );
  }

  function update(key: keyof LeadDraft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = validateLead(draft, locale);
    if (!result.ok) {
      setErrors(result.errors);
      setFailed(false);
      return;
    }
    setErrors([]);
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch(publicLeadUrl(), publicAssistantInit(locale, result.body));
      if (!response.ok) throw new Error("lead");
      setReceived(true);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  const error = (field: LeadField) => (errors.includes(field) ? t.errors[field] : null);

  return (
    <form data-lead className="grid gap-3 border-2 border-ink bg-canvas p-6" onSubmit={(event) => void submit(event)} noValidate>
      <Field label={t.name} error={error("name")}>
        <input className={fieldClass} name="name" autoComplete="name" value={draft.name} onChange={(event) => update("name", event.target.value)} />
      </Field>
      <Field label={t.restaurant} error={error("restaurant")}>
        <input className={fieldClass} name="restaurant" value={draft.restaurant} onChange={(event) => update("restaurant", event.target.value)} />
      </Field>
      <Field label={t.contact} error={error("contact")}>
        <input className={fieldClass} name="contact" autoComplete="tel" inputMode="text" dir="auto" value={draft.contact} onChange={(event) => update("contact", event.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.city} error={error("city")}>
          <input className={fieldClass} name="city" autoComplete="address-level2" value={draft.city} onChange={(event) => update("city", event.target.value)} />
        </Field>
        <Field label={t.branches} error={error("branches")}>
          <input className={fieldClass} name="branches" inputMode="numeric" value={draft.branches} onChange={(event) => update("branches", event.target.value)} />
        </Field>
      </div>
      <Field label={t.message} error={error("message")}>
        <textarea className="min-h-24 w-full border-2 border-ink bg-canvas px-3 py-2 text-sm leading-6" name="message" value={draft.message} onChange={(event) => update("message", event.target.value)} />
      </Field>
      <Field label={t.promo} error={null}>
        <input className={fieldClass} name="promo" autoComplete="off" maxLength={40} value={draft.promo ?? ""} onChange={(event) => update("promo", event.target.value)} />
      </Field>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {t.failed}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="inline-flex min-h-11 w-fit items-center bg-ink px-4 text-sm font-semibold text-canvas disabled:opacity-50">
        {pending ? t.sending : t.submit}
      </button>
      <p className="text-xs text-quiet">
        {t.privacyNote}{" "}
        <Link href={`/privacy?lang=${locale}`} className="underline underline-offset-2">
          {t.privacyLink}
        </Link>
      </p>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error: string | null; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className={error ? "font-medium text-destructive" : undefined}>{label}</span>
      {children}
      {error ? (
        <span role="alert" className="text-xs font-medium text-destructive">
          {error}
        </span>
      ) : null}
    </label>
  );
}
