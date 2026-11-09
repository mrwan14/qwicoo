import { cn } from "cn";
import { ChevronDown, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

const control =
  "w-full min-w-0 rounded-staff border border-border bg-canvas px-3 text-sm text-ink outline-none transition-colors placeholder:text-disabled hover:border-ink-secondary/50 focus-visible:border-focus disabled:cursor-not-allowed disabled:bg-subtle disabled:text-disabled aria-invalid:border-danger";

const leadIcon = "pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-secondary";

/** Phone numbers, emails and links read left to right even in Arabic, but stay on the reading side. */
const LTR_TYPES = new Set(["tel", "email", "url"]);

/** With `icon`, `className` sizes the wrapper. */
export function Input({ className, icon: Icon, type, dir, ...props }: ComponentProps<"input"> & { icon?: LucideIcon }) {
  const ltr = !dir && type !== undefined && LTR_TYPES.has(type);
  const field = cn(control, "h-[42px]", ltr && "rtl:text-right", Icon && "ps-9");
  const input = <input type={type} dir={ltr ? "ltr" : dir} className={Icon ? field : cn(field, className)} {...props} />;
  if (!Icon) return input;
  return (
    <div className={cn("relative", className)}>
      <Icon aria-hidden className={leadIcon} />
      {input}
    </div>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-2.5 leading-normal", className)} {...props} />;
}

/** Native select, so it works with touch, keyboards and screen readers. `className` sizes the wrapper. */
export function Select({
  className,
  icon: Icon,
  children,
  ...props
}: ComponentProps<"select"> & { icon?: LucideIcon }) {
  return (
    <div className={cn("relative", className)}>
      {Icon ? <Icon aria-hidden className={leadIcon} /> : null}
      <select className={cn(control, "h-[42px] cursor-pointer appearance-none pe-9", Icon && "ps-9")} {...props}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-ink-secondary" />
    </div>
  );
}

/** Label above a control. The label wraps the control, so no ids are needed. */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <label className="grid gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">{label}</span>
        {children}
      </label>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-secondary">{hint}</p>
      ) : null}
    </div>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: Omit<ComponentProps<"button">, "onChange" | "role"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors after:absolute after:-inset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40",
        checked ? "justify-end bg-ink" : "justify-start bg-ink-secondary/35",
        className,
      )}
      {...props}
    >
      <span aria-hidden className="size-4 rounded-full bg-canvas shadow-xs" />
    </button>
  );
}
