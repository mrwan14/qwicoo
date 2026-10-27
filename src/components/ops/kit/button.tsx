import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";

/** Use on a `Link` or `<a>` that should look like a button. */
export const buttonClass = cva(
  "inline-flex shrink-0 items-center justify-center rounded-staff border font-semibold whitespace-nowrap transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed aria-disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-ink bg-ink text-on-ink hover:bg-ink/85 disabled:border-disabled disabled:bg-disabled",
        secondary: "border-border bg-canvas text-ink hover:bg-subtle disabled:bg-canvas disabled:text-disabled",
        danger: "border-danger bg-danger text-on-ink hover:bg-danger/90 disabled:border-disabled disabled:bg-disabled",
        ghost: "border-transparent bg-transparent text-ink hover:bg-subtle disabled:bg-transparent disabled:text-disabled",
        dangerGhost:
          "border-transparent bg-transparent font-medium text-danger hover:bg-danger-bg disabled:bg-transparent disabled:text-disabled",
      },
      size: {
        md: "min-h-[46px] gap-2 px-5 py-2 text-[15px] [&_svg:not([class*='size-'])]:size-4",
        field: "h-[42px] gap-2 px-[18px] text-sm [&_svg:not([class*='size-'])]:size-4",
        sm: "min-h-8 gap-1.5 px-3 py-1 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        touch: "min-h-14 gap-2.5 px-6 py-3 text-base [&_svg:not([class*='size-'])]:size-5",
        icon: "size-[42px] [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonClass>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonClass({ variant, size }), className)} {...props} />;
}
