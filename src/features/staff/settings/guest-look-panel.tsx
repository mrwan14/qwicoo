"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Coffee, ImagePlus, Minus, Plus, Search, ShoppingBag, Users } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";

import { guestFontClassName } from "@/features/guest/guest-fonts";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useLocale } from "@/lib/i18n/locale-store";
import { buildGuestTheme, buildStaffAccent, normalizeHex, resolveChoice, THEME_PRESET_IDS, THEME_PRESETS, type ThemePresetId } from "@/lib/guest/theme";
import { mediaUrl } from "@/lib/media";
import { useScope } from "@/stores/scope";

import "@/features/guest/guest.css";

type Brand = components["schemas"]["BrandResponse"];

const COPY = {
  en: {
    title: "Brand look",
    hint: "Your colours on the guest menu (when guests scan a table QR) and across your team's dashboard, till and kitchen screens. Pick a ready-made theme or your own two colours; we keep text and buttons readable automatically.",
    presets: "Themes",
    custom: "Custom colours",
    brandColor: "Brand colour",
    brandHint: "Buttons, selected tabs and badges",
    background: "Background",
    backgroundHint: "The page behind your menu",
    cover: "Cover photo",
    coverHint: "A wide photo of your place or food, shown behind your name. JPG or PNG, landscape.",
    upload: "Upload photo",
    replace: "Replace",
    remove: "Remove",
    uploading: "Uploading…",
    save: "Save look",
    unsaved: "Unsaved changes. The dashboard shows them as a preview until you save.",
    discard: "Discard",
    saving: "Saving…",
    saved: "Brand look saved",
    failed: "Couldn't save the look. Try again.",
    preview: "Guest menu",
    dashboardPreview: "Team dashboard",
    dash: { home: "Home", orders: "Orders", menu: "Menu", reports: "Reports", today: "Today", week: "This week", newOrder: "New order", sales: "Sales today" },
    adjusted: "We adjusted this colour slightly so text and buttons stay readable.",
    names: { citrus: "Qwicoo Citrus", sage: "Sage Garden", espresso: "Espresso", nile: "Nile Blue", rose: "Rose Bakery", night: "Charcoal Night" },
    sample: {
      table: "Table 4",
      section: "Hot drinks",
      items: "3 items",
      a: "Spanish latte",
      b: "Hot chocolate",
      c: "Mint tea",
      order: "2 items",
      order1: "1 item",
      view: "View order",
      regular: "Regular",
      large: "Large",
      add: "Add",
      yourOrder: "Your order",
      total: "Total",
      send: "Send order",
    },
  },
  ar: {
    title: "هوية العلامة",
    hint: "ألوانك على منيو الضيوف (عند مسح رمز الطاولة) وعلى لوحة فريقك والكاشير وشاشات المطبخ. اختر ثيمًا جاهزًا أو لونيك الخاصين، ونحافظ تلقائيًا على وضوح النصوص والأزرار.",
    presets: "الثيمات",
    custom: "ألوان مخصصة",
    brandColor: "لون العلامة",
    brandHint: "الأزرار والتبويب المختار والشارات",
    background: "الخلفية",
    backgroundHint: "خلفية صفحة المنيو",
    cover: "صورة الغلاف",
    coverHint: "صورة عريضة لمكانك أو أكلك تظهر خلف اسمك. JPG أو PNG بالعرض.",
    upload: "ارفع صورة",
    replace: "استبدال",
    remove: "إزالة",
    uploading: "جارٍ الرفع…",
    save: "احفظ الشكل",
    unsaved: "تغييرات غير محفوظة. تظهر على اللوحة كمعاينة حتى تحفظها.",
    discard: "تجاهل",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ هوية العلامة",
    failed: "تعذّر حفظ الشكل. حاول مرة أخرى.",
    preview: "منيو الضيوف",
    dashboardPreview: "لوحة الفريق",
    dash: { home: "الرئيسية", orders: "الطلبات", menu: "المنيو", reports: "التقارير", today: "اليوم", week: "هذا الأسبوع", newOrder: "طلب جديد", sales: "مبيعات اليوم" },
    adjusted: "عدّلنا هذا اللون قليلًا لتبقى النصوص والأزرار واضحة.",
    names: { citrus: "سيتروس كويكو", sage: "حديقة المريمية", espresso: "إسبريسو", nile: "أزرق النيل", rose: "مخبز الورد", night: "ليل فحمي" },
    sample: {
      table: "طاولة 4",
      section: "مشروبات ساخنة",
      items: "3 أصناف",
      a: "سبانيش لاتيه",
      b: "هوت شوكليت",
      c: "شاي بالنعناع",
      order: "صنفان",
      order1: "صنف واحد",
      view: "اعرض الطلب",
      regular: "عادي",
      large: "كبير",
      add: "أضف",
      yourOrder: "طلبك",
      total: "الإجمالي",
      send: "أرسل الطلب",
    },
  },
} as const;

type Choice = { preset: ThemePresetId | "custom"; brand: string; background: string };

function initialChoice(brand: Brand): Choice {
  const config = (brand.theme_config ?? {}) as Record<string, unknown>;
  return resolveChoice({
    preset: config.preset,
    brand: config.primary_color,
    background: config.background_color,
  });
}

export function GuestLookPanel({
  brand,
  uploadImage,
}: {
  brand: Brand;
  /** Uploads to media storage and returns the public URL. */
  uploadImage: (file: File) => Promise<string>;
}) {
  const { locale } = useLocale();
  const t = COPY[locale === "ar" ? "ar" : "en"];
  const queryClient = useQueryClient();
  const [choice, setChoice] = useState<Choice>(() => initialChoice(brand));
  const [cover, setCover] = useState<string | null>(brand.cover_image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const theme = useMemo(() => buildGuestTheme(choice), [choice]);
  const colorsChanged = JSON.stringify(choice) !== JSON.stringify(initialChoice(brand));
  const dirty = colorsChanged || (cover ?? null) !== (brand.cover_image_url ?? null);

  // Show unsaved colours on the real dashboard while picking; drop the preview on leave or save.
  useEffect(() => {
    useScope.setState({
      previewTheme: colorsChanged ? { preset: choice.preset, brand_color: choice.brand, background_color: choice.background } : null,
    });
  }, [choice, colorsChanged]);
  useEffect(() => () => useScope.setState({ previewTheme: null }), []);

  const save = useMutation({
    mutationFn: async () => {
      const current = (brand.theme_config ?? {}) as Record<string, unknown>;
      const theme_config = {
        ...current,
        preset: choice.preset,
        primary_color: choice.brand,
        background_color: choice.background,
      };
      const result = await browserApi.PATCH("/api/v1/brands/{brand_id}", {
        params: { path: { brand_id: brand.id } },
        // An empty string clears the cover (the API ignores null as "unchanged").
        body: { theme_config, cover_image_url: cover ?? "" },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.failed);
    },
    onSuccess: () => {
      toast.success(t.saved);
      void queryClient.invalidateQueries({ queryKey: ["brand", brand.id] });
      // The dashboard picks up the new colour right away, without signing in again.
      if (useScope.getState().brandId === brand.id && useScope.getState().homeScope !== "platform") {
        useScope.setState({ brandTheme: { preset: choice.preset, brand_color: choice.brand, background_color: choice.background } });
      }
      useScope.setState({ previewTheme: null });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function pickCover(file: File) {
    setUploading(true);
    try {
      setCover(await uploadImage(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.failed);
    } finally {
      setUploading(false);
    }
  }

  function setCustom(key: "brand" | "background", value: string) {
    const hex = normalizeHex(value);
    if (!hex) return;
    setChoice((current) => ({ ...current, preset: "custom", [key]: hex }));
  }

  return (
    <section className="grid gap-5 rounded-[16px] border border-border bg-canvas p-5">
      <div className="grid gap-1">
        <h2 className="text-base font-semibold">{t.title}</h2>
        <p className="max-w-2xl text-sm leading-6 text-ink-secondary">{t.hint}</p>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-6">
          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-semibold">{t.presets}</legend>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {THEME_PRESET_IDS.map((id) => {
                const preset = THEME_PRESETS[id];
                const selected = choice.preset === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setChoice({ preset: id, brand: preset.brand, background: preset.background })}
                    className={`relative grid gap-2 rounded-[14px] border p-3 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${selected ? "border-ink ring-1 ring-ink" : "border-border hover:border-ink/40"}`}
                  >
                    <span className="flex h-10 items-end gap-1.5 rounded-[10px] p-1.5" style={{ background: preset.background }}>
                      <span className="h-full w-6 rounded-[6px]" style={{ background: preset.brand }} />
                      <span className="h-3 flex-1 rounded-full" style={{ background: preset.background === "#1b1a18" ? "#3a3936" : "#ffffff" }} />
                    </span>
                    <span className="text-[13px] font-medium">{t.names[id]}</span>
                    {selected ? (
                      <span className="absolute end-2 top-2 grid size-5 place-items-center rounded-full bg-ink text-canvas">
                        <Check aria-hidden className="size-3" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-semibold">{t.custom}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorField
                label={t.brandColor}
                hint={t.brandHint}
                value={choice.brand}
                warning={theme.adjusted.brand ? t.adjusted : null}
                onChange={(value) => setCustom("brand", value)}
              />
              <ColorField
                label={t.background}
                hint={t.backgroundHint}
                value={choice.background}
                warning={theme.adjusted.background ? t.adjusted : null}
                onChange={(value) => setCustom("background", value)}
              />
            </div>
          </fieldset>

          <div className="grid gap-2">
            <p className="text-sm font-semibold">{t.cover}</p>
            <p className="text-sm text-ink-secondary">{t.coverHint}</p>
            <div className="flex flex-wrap items-center gap-3">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(cover) ?? ""} alt="" className="h-16 w-28 rounded-[10px] object-cover object-center" />
              ) : null}
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted">
                <ImagePlus aria-hidden className="size-4" />
                {uploading ? t.uploading : cover ? t.replace : t.upload}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void pickCover(file);
                  }}
                />
              </label>
              {cover ? (
                <button type="button" className="min-h-10 px-2 text-sm text-ink-secondary hover:text-ink" onClick={() => setCover(null)}>
                  {t.remove}
                </button>
              ) : null}
            </div>
          </div>

          {dirty ? null : (
            <div>
              <button
                type="button"
                className="min-h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground opacity-50"
                disabled
              >
                {t.save}
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-5">
          <div className="grid gap-2">
            <p className="text-sm font-semibold">{t.dashboardPreview}</p>
            <DashboardPreview brandName={brand.name} accent={buildStaffAccent(choice) ?? {}} copy={t.dash} />
          </div>
          <div className="grid gap-2">
          <p className="text-sm font-semibold">{t.preview}</p>
          <PhonePreview brand={brand} cover={cover} vars={theme.vars} dark={theme.dark} locale={locale === "ar" ? "ar" : "en"} sample={t.sample} />
          </div>
        </div>
      </div>

      {dirty ? (
        <div
          role="region"
          aria-label={t.save}
          className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-border bg-canvas px-4 py-3 shadow-[0_10px_30px_rgb(0_0_0/0.12)]"
        >
          <p className="text-sm text-ink-secondary">{t.unsaved}</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="min-h-10 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted"
              disabled={save.isPending}
              onClick={() => {
                setChoice(initialChoice(brand));
                setCover(brand.cover_image_url ?? null);
              }}
            >
              {t.discard}
            </button>
            <button
              type="button"
              className="min-h-10 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              disabled={save.isPending || uploading}
              onClick={() => save.mutate()}
            >
              {save.isPending ? t.saving : t.save}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ColorField({
  label,
  hint,
  value,
  warning,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  warning: string | null;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setDraft(value);
  }
  return (
    <label className="grid gap-1.5 rounded-[14px] border border-border p-3">
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-ink-secondary">{hint}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-12 cursor-pointer rounded-[8px] border border-border bg-transparent p-0.5"
        />
        <input
          type="text"
          dir="ltr"
          value={draft}
          spellCheck={false}
          onChange={(event) => {
            setDraft(event.target.value);
            onChange(event.target.value);
          }}
          className="h-10 min-w-0 flex-1 rounded-[8px] border border-border bg-background px-3 font-mono text-sm uppercase"
        />
      </span>
      {warning ? <span className="text-xs text-warning">{warning}</span> : null}
    </label>
  );
}

/** A small, still picture of the team dashboard with the brand accent: nav, a button, a tab and a figure. */
function DashboardPreview({
  brandName,
  accent,
  copy,
}: {
  brandName: string;
  accent: Record<string, string>;
  copy: Record<"home" | "orders" | "menu" | "reports" | "today" | "week" | "newOrder" | "sales", string>;
}) {
  const style = accent as CSSProperties;
  return (
    <div className="mx-auto grid w-[300px] grid-cols-[96px_1fr] overflow-hidden rounded-[12px] border border-border bg-canvas text-[11px] shadow-card" style={style} aria-hidden>
      <div className="grid content-start gap-1 border-e border-border bg-subtle p-2">
        <p className="mb-1 truncate px-1.5 font-semibold">{brandName}</p>
        {[copy.home, copy.orders, copy.menu, copy.reports].map((label, index) => (
          <span
            key={label}
            className={`rounded-[5px] px-1.5 py-1 ${index === 1 ? "bg-brand font-semibold text-on-brand" : "text-ink-secondary"}`}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="grid content-start gap-2.5 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold">{copy.orders}</span>
          <span className="rounded-[5px] bg-brand px-2 py-1 font-medium text-on-brand">{copy.newOrder}</span>
        </div>
        <div className="flex gap-1">
          <span className="rounded-full bg-brand-tint px-2 py-0.5 font-semibold text-brand-ink">{copy.today}</span>
          <span className="rounded-full px-2 py-0.5 text-ink-secondary">{copy.week}</span>
        </div>
        <div className="grid gap-0.5 rounded-[8px] border border-border p-2">
          <span className="text-ink-secondary">{copy.sales}</span>
          <span className="text-[15px] font-semibold" dir="ltr">
            EGP 9,340.00
          </span>
          <span className="mt-1 h-1.5 overflow-hidden rounded-full bg-well">
            <span className="block h-full w-2/3 rounded-full bg-brand" />
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Timeline of the looping preview (~7 s). Each step says where the tap lands and what the
 * screen shows after it. Reduced motion shows the "ordered" frame without moving.
 */
const STEPS = [
  { at: 0, tap: null, latte: 0, choc: 0, sheet: false, large: false, cart: false },
  { at: 700, tap: "latte", latte: 0, choc: 0, sheet: false, large: false, cart: false },
  { at: 1100, tap: null, latte: 0, choc: 0, sheet: true, large: false, cart: false },
  { at: 2000, tap: "large", latte: 0, choc: 0, sheet: true, large: true, cart: false },
  { at: 2800, tap: "add", latte: 0, choc: 0, sheet: true, large: true, cart: false },
  { at: 3200, tap: null, latte: 1, choc: 0, sheet: false, large: true, cart: false },
  { at: 4300, tap: "choc", latte: 1, choc: 0, sheet: false, large: true, cart: false },
  { at: 4600, tap: null, latte: 1, choc: 1, sheet: false, large: true, cart: false },
  { at: 5200, tap: "bar", latte: 1, choc: 1, sheet: false, large: true, cart: false },
  { at: 5500, tap: null, latte: 1, choc: 1, sheet: false, large: true, cart: true },
] as const;
/** Long enough to read the order sheet before it slides away and the loop starts over. */
const LOOP_MS = 7500;
type TapTarget = "latte" | "large" | "add" | "choc" | "bar";

function useLoop(reduced: boolean) {
  const [step, setStep] = useState(reduced ? 7 : 0);
  useEffect(() => {
    if (reduced) {
      setStep(7);
      return;
    }
    let timers: number[] = [];
    const run = () => {
      timers = STEPS.map((entry, index) => window.setTimeout(() => setStep(index), entry.at));
      timers.push(window.setTimeout(run, LOOP_MS));
    };
    run();
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [reduced]);
  return STEPS[step];
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/** A small, real render of the guest menu (same guest styles and theme engine), playing a short order on loop. */
function PhonePreview({
  brand,
  cover,
  vars,
  dark,
  locale,
  sample,
}: {
  brand: Brand;
  cover: string | null;
  vars: Record<string, string>;
  dark: boolean;
  locale: "en" | "ar";
  sample: Record<keyof (typeof COPY)["en"]["sample"], string>;
}) {
  const reduced = usePrefersReducedMotion();
  const frame = useLoop(reduced);
  const screen = useRef<HTMLDivElement>(null);
  const targets = useRef(new Map<TapTarget, HTMLElement>());
  const [dot, setDot] = useState<{ x: number; y: number; key: number } | null>(null);
  const { "color-scheme": colorScheme, ...custom } = vars;
  const style = { ...custom, colorScheme } as CSSProperties;
  const logo = mediaUrl(brand.logo_url);
  const coverUrl = mediaUrl(cover);
  const egp = (value: number) => `EGP ${value.toFixed(2)}`;
  const lattePrice = frame.large ? 105 : 90;
  const count = frame.latte + frame.choc;
  const total = (frame.latte ? 105 : 0) + (frame.choc ? 80 : 0);

  // The tap dot lands on the real element, wherever the language or theme put it.
  useLayoutEffect(() => {
    if (!frame.tap) return;
    const node = targets.current.get(frame.tap);
    const box = screen.current?.getBoundingClientRect();
    if (!node || !box) return;
    const rect = node.getBoundingClientRect();
    setDot({ x: rect.left - box.left + rect.width / 2, y: rect.top - box.top + rect.height / 2, key: Date.now() });
  }, [frame]);

  const mark = (name: TapTarget) => (node: HTMLElement | null) => {
    if (node) targets.current.set(name, node);
  };

  const rows = [
    { id: "latte", name: sample.a, price: egp(lattePrice), qty: frame.latte },
    { id: "choc", name: sample.b, price: egp(80), qty: frame.choc },
    { id: "tea", name: sample.c, price: egp(45), qty: 0 },
  ] as const;

  return (
    <div className="mx-auto w-[300px] rounded-[36px] bg-[#1d1d1f] p-2.5 shadow-[0_20px_50px_rgb(0_0_0/0.18)]">
      <div
        ref={screen}
        dir={locale === "ar" ? "rtl" : "ltr"}
        lang={locale}
        data-dark={dark ? "true" : "false"}
        className={`guest-theme ${guestFontClassName} relative h-[560px] overflow-hidden rounded-[28px]`}
        style={style}
        aria-hidden
      >
        <header className="guest-hero" data-cover={coverUrl ? "true" : "false"}>
          <div className="guest-hero-band" style={{ height: coverUrl ? 130 : 96 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {coverUrl ? <img src={coverUrl} alt="" /> : null}
          </div>
          <div className="guest-hero-actions" style={{ top: 10 }}>
            <span className="flex-1" />
            <span className="guest-hero-btn" style={{ minWidth: 34, height: 34 }}>
              <Search className="size-4" />
            </span>
          </div>
          <div className="guest-hero-id" style={{ marginTop: -28, gap: 10, paddingInline: 12 }}>
            <span className="guest-hero-logo" style={{ width: 56, height: 56, borderRadius: 18, fontSize: 22 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logo ? <img src={logo} alt="" /> : <span>{brand.name.slice(0, 1).toUpperCase()}</span>}
            </span>
            <div className="min-w-0 flex-1">
              <p className="guest-hero-name" style={{ fontSize: 19 }}>
                {brand.name}
              </p>
              <p className="guest-hero-meta" style={{ fontSize: 11, marginTop: 2 }}>
                <span className="guest-hero-table" style={{ padding: "2px 8px" }}>
                  <Users className="size-3" />
                  {sample.table}
                </span>
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-2.5 px-3 pt-3">
          <div className="flex gap-1.5">
            <span className="guest-cat-tab" data-active="true" style={{ minHeight: 30, padding: "5px 12px", fontSize: 12 }}>
              {sample.section}
            </span>
            <span className="guest-cat-tab" data-active="false" style={{ minHeight: 30, padding: "5px 12px", fontSize: 12 }}>
              ···
            </span>
          </div>
          <div className="guest-section-title">
            <h2 style={{ fontSize: 16 }}>{sample.section}</h2>
            <span>{sample.items}</span>
          </div>
          <ul className="guest-list" style={{ padding: "0 12px", borderRadius: 18 }}>
            {rows.map((row) => (
              <li
                key={row.id}
                ref={row.id === "latte" ? mark("latte") : undefined}
                className="guest-row"
                style={{ padding: "11px 0", alignItems: "center" }}
              >
                <div className="guest-row-text">
                  <p className="guest-row-name" style={{ fontSize: 13.5 }}>
                    {row.name}
                  </p>
                  <span className="guest-price" dir="ltr" style={{ fontSize: 12.5 }}>
                    {row.price}
                  </span>
                </div>
                {row.qty ? (
                  <span className="guest-qty qw-pop" style={{ height: 30 }}>
                    <span className="grid w-7 place-items-center">
                      <Minus className="size-3" />
                    </span>
                    <span style={{ fontSize: 12 }}>{row.qty}</span>
                    <span className="grid w-7 place-items-center">
                      <Plus className="size-3" />
                    </span>
                  </span>
                ) : (
                  <span ref={row.id === "choc" ? mark("choc") : undefined} className="guest-add-ring" style={{ width: 30, height: 30 }}>
                    <Plus className="size-4" />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Order bar rises once something is in the order. */}
        <div
          className="absolute inset-x-3 bottom-3 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
          style={{ transform: count > 0 ? "translateY(0)" : "translateY(140%)" }}
        >
          <div
            ref={mark("bar")}
            className="guest-cart-bar guest-btn"
            style={{ minHeight: 46, display: "flex", alignItems: "center" }}
          >
            <span className="guest-cart-chip" style={{ width: 32, height: 32 }}>
              <ShoppingBag className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1 text-start">
              <span className="guest-cart-meta" style={{ fontSize: 10 }}>
                {count === 1 ? sample.order1 : sample.order}
              </span>
              <span className="guest-price guest-cart-total" dir="ltr" style={{ fontSize: 13 }}>
                {egp(total)}
              </span>
            </span>
            <span className="guest-cart-go" style={{ fontSize: 12 }}>
              {sample.view}
            </span>
          </div>
        </div>

        {/* Dimmed page behind a sheet. */}
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{ background: "var(--guest-overlay)", opacity: frame.sheet || frame.cart ? 1 : 0 }}
        />

        {/* Item sheet */}
        <div
          className="guest-sheet absolute inset-x-0 bottom-0 grid gap-3 px-4 pt-2.5 pb-4 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
          style={{ transform: frame.sheet ? "translateY(0)" : "translateY(105%)", borderRadius: "24px 24px 0 0" }}
        >
          <div className="guest-sheet-handle mx-auto" />
          <div
            className="grid h-[92px] place-items-center rounded-[16px]"
            style={{ background: "linear-gradient(135deg, var(--guest-orange-soft), var(--guest-sunken))", color: "var(--guest-brand-text)" }}
          >
            <Coffee className="size-9" strokeWidth={1.5} />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="guest-sheet-title" style={{ fontSize: 16 }}>
              {sample.a}
            </p>
            <span className="guest-price" dir="ltr" style={{ fontSize: 13 }}>
              {egp(lattePrice)}
            </span>
          </div>
          <div className="grid gap-1.5">
            {[
              { id: "regular", label: sample.regular, extra: "", on: !frame.large },
              { id: "large", label: sample.large, extra: "+ EGP 15.00", on: frame.large },
            ].map((option) => (
              <div
                key={option.id}
                ref={option.id === "large" ? mark("large") : undefined}
                className="flex items-center justify-between rounded-[12px] px-3 py-2 text-[12.5px] transition-shadow"
                style={{
                  background: "var(--guest-surface)",
                  boxShadow: option.on ? "inset 0 0 0 2px var(--guest-orange)" : "inset 0 0 0 1px var(--guest-line)",
                  color: "var(--guest-ink)",
                }}
              >
                <span className="font-medium">{option.label}</span>
                <span className="flex items-center gap-2" style={{ color: "var(--guest-quiet)" }}>
                  <span dir="ltr">{option.extra}</span>
                  <span
                    className="grid size-4 place-items-center rounded-full"
                    style={{ boxShadow: option.on ? "inset 0 0 0 5px var(--guest-orange)" : "inset 0 0 0 1.5px var(--guest-line-strong)" }}
                  />
                </span>
              </div>
            ))}
          </div>
          <span
            ref={mark("add")}
            className="guest-btn guest-btn-primary"
            style={{ minHeight: 42, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {sample.add}&nbsp;·&nbsp;<span dir="ltr">{egp(lattePrice)}</span>
          </span>
        </div>

        {/* Order sheet */}
        <div
          className="guest-sheet absolute inset-x-0 bottom-0 grid gap-2.5 px-4 pt-2.5 pb-4 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
          style={{ transform: frame.cart ? "translateY(0)" : "translateY(105%)", borderRadius: "24px 24px 0 0" }}
        >
          <div className="guest-sheet-handle mx-auto" />
          <p className="guest-sheet-title" style={{ fontSize: 16 }}>
            {sample.yourOrder}
          </p>
          {[
            { name: `${sample.a} · ${sample.large}`, price: 105 },
            { name: sample.b, price: 80 },
          ].map((line) => (
            <div key={line.name} className="flex items-baseline justify-between gap-3 text-[12.5px]" style={{ color: "var(--guest-ink)" }}>
              <span>
                <span style={{ color: "var(--guest-quiet)" }}>1× </span>
                {line.name}
              </span>
              <span className="guest-price" dir="ltr" style={{ fontSize: 12.5 }}>
                {egp(line.price)}
              </span>
            </div>
          ))}
          <div className="flex items-baseline justify-between border-t pt-2 text-[13px] font-semibold" style={{ borderColor: "var(--guest-line)", color: "var(--guest-ink)" }}>
            <span>{sample.total}</span>
            <span className="guest-price" dir="ltr" style={{ fontSize: 13 }}>
              {egp(185)}
            </span>
          </div>
          <span className="guest-btn guest-btn-primary" style={{ minHeight: 42, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {sample.send}
          </span>
        </div>

        {/* The pretend guest's finger. */}
        {dot && frame.tap ? (
          <span
            key={dot.key}
            className="qw-tap pointer-events-none absolute z-10 size-9 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: dot.x, top: dot.y }}
          />
        ) : null}
      </div>
    </div>
  );
}
