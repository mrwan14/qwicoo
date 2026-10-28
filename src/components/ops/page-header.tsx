"use client";

import { createContext, useContext, type ReactNode } from "react";

import { PageHeader as KitPageHeader } from "@/components/ops/kit/page-header";

const Nested = createContext(false);

/** Inside a hub (Stock, Settings…) the hub owns the page title, so older screens' headers become section headings. */
export function NestedHeaders({ children }: { children: ReactNode }) {
  return <Nested.Provider value>{children}</Nested.Provider>;
}

/** Older screens' header, drawn as the kit page header (Fraunces title), or as a section heading when nested. */
export function PageHeader({
  title,
  action,
  detail,
}: {
  title: string;
  action?: ReactNode;
  detail?: ReactNode;
}) {
  const nested = useContext(Nested);
  if (!nested) return <KitPageHeader title={title} subtitle={detail} actions={action} />;
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="grid min-w-0 gap-0.5">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {detail ? <div className="text-[13px] text-ink-secondary">{detail}</div> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

/** An older screen's own title: the Fraunces page title, or a section heading inside a hub. */
export function ScreenTitle({ children }: { children: ReactNode }) {
  const nested = useContext(Nested);
  if (nested) return <h2 className="text-base font-semibold text-ink">{children}</h2>;
  return <h1 className="font-title text-[28px] leading-tight font-medium text-ink sm:text-[32px]">{children}</h1>;
}
