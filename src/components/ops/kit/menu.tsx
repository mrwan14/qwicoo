"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "cn";
import type { ReactNode } from "react";

/** Popup list of actions or links. Built on Base UI, so arrow keys, typeahead and Escape work. */
export const Menu = MenuPrimitive.Root;
export const MenuTrigger = MenuPrimitive.Trigger;

export function MenuContent({
  align = "end",
  side = "bottom",
  className,
  children,
}: {
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "inline-start" | "inline-end";
  className?: string;
  children: ReactNode;
}) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner side={side} align={align} sideOffset={6} className="z-50 outline-none">
        <MenuPrimitive.Popup
          className={cn(
            "max-h-(--available-height) min-w-52 origin-(--transform-origin) overflow-y-auto rounded-staff border border-border bg-canvas p-1 text-sm text-ink shadow-dialog outline-none transition-[opacity,scale] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
            className,
          )}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

const item =
  "flex min-h-10 w-full cursor-default items-center gap-2.5 rounded-staff px-2.5 text-start text-sm text-ink outline-none select-none data-disabled:text-disabled data-highlighted:bg-subtle [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-secondary";

export function MenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return <MenuPrimitive.Item className={cn(item, className)} {...props} />;
}

/** Pass `render={<Link href="…" />}` for client-side navigation. */
export function MenuLinkItem({ className, ...props }: MenuPrimitive.LinkItem.Props) {
  return <MenuPrimitive.LinkItem closeOnClick className={cn(item, className)} {...props} />;
}

export function MenuHeading({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pt-2 pb-1 text-xs font-medium text-ink-secondary">{children}</div>;
}

export function MenuSeparator() {
  return <MenuPrimitive.Separator className="-mx-1 my-1 h-px bg-border" />;
}
