"use client";

import { cn } from "cn";
import { CornerDownLeft, FileText, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { fill } from "@/lib/i18n/dictionary";
import { navCopy } from "@/lib/i18n/staff/nav";
import { shellCopy } from "@/lib/i18n/staff/shell";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { navKey, type NavItem, type SidebarEntry } from "@/lib/nav";

type Result = { id: string; label: string; hint?: string; href: string; kind: "page" | "search" };

/** Screens that read `?q=` into their own search box. */
const SEARCHABLE = [
  { href: "/app/orders/history", copy: "ordersFor" },
  { href: "/app/menu", copy: "itemsFor" },
  { href: "/app/staff", copy: "staffFor" },
] as const;

/**
 * Jump to a page by name, or hand the words to the Orders, Menu or Staff search.
 * There is no cross-entity search API, so nothing here is searched on the server directly.
 */
export function GlobalSearch({
  items,
  entries,
  className,
  onNavigate,
}: {
  items: readonly NavItem[];
  entries: readonly SidebarEntry[];
  className?: string;
  onNavigate?: () => void;
}) {
  const t = useStaffSection(shellCopy);
  const nav = useStaffSection(navCopy);
  const router = useRouter();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const pages = useMemo(() => {
    const sectionOf = new Map<string, string>();
    for (const entry of entries) for (const member of entry.members) sectionOf.set(member, t.sidebar[entry.key]);
    const seen = new Set<string>();
    const list: Result[] = [];
    for (const entry of entries) {
      seen.add(entry.href);
      list.push({ id: `page:${entry.key}`, label: t.sidebar[entry.key], href: entry.href, kind: "page" });
    }
    for (const item of items) {
      if (seen.has(item.href)) continue;
      seen.add(item.href);
      list.push({ id: `page:${navKey(item)}`, label: nav[item.labelKey], hint: sectionOf.get(navKey(item)), href: item.href, kind: "page" });
    }
    return list;
  }, [entries, items, nav, t]);

  const text = query.trim();
  const results = useMemo(() => {
    if (!text) return [];
    const needle = text.toLocaleLowerCase();
    const allowed = new Set(items.map((item) => item.href));
    const matches = pages.filter((page) => `${page.label} ${page.hint ?? ""}`.toLocaleLowerCase().includes(needle)).slice(0, 6);
    const searches: Result[] = SEARCHABLE.filter((target) => allowed.has(target.href)).map((target) => ({
      id: `search:${target.href}`,
      label: fill(t.search[target.copy], { q: text }),
      href: `${target.href}?q=${encodeURIComponent(text)}`,
      kind: "search",
    }));
    return [...matches, ...searches];
  }, [items, pages, t, text]);

  const showList = open && text.length > 0;
  const current = Math.min(active, Math.max(results.length - 1, 0));

  function go(result: Result | undefined) {
    if (!result) return;
    setOpen(false);
    setQuery("");
    input.current?.blur();
    onNavigate?.();
    router.push(result.href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (results.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[current]);
    } else if (event.key === "Escape") {
      if (showList) {
        event.preventDefault();
        setOpen(false);
      } else setQuery("");
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-secondary" />
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-label={t.search.label}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[current] ? `${listId}-${current}` : undefined}
        placeholder={t.search.placeholder}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="h-[38px] w-full rounded-staff border border-border bg-canvas ps-9 pe-3 text-sm text-ink outline-none placeholder:text-disabled hover:border-ink-secondary/50 focus-visible:border-focus [&::-webkit-search-cancel-button]:hidden"
      />
      <div
        id={listId}
        role="listbox"
        aria-label={t.search.label}
        hidden={!showList}
        className="absolute inset-x-0 top-full z-50 mt-1.5 max-h-96 overflow-y-auto rounded-staff border border-border bg-canvas p-1 shadow-dialog"
      >
        {results.length === 0 ? (
          <p className="px-2.5 py-3 text-sm text-ink-secondary">{fill(t.search.nothing, { q: text })}</p>
        ) : (
          results.map((result, index) => {
            const Icon = result.kind === "page" ? FileText : Search;
            const selected = index === current;
            return (
              <div
                key={result.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={selected}
                // Keep focus in the input; the click still lands.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => go(result)}
                className={cn(
                  "flex min-h-10 cursor-default items-center gap-2.5 rounded-staff px-2.5 text-sm text-ink",
                  selected && "bg-subtle",
                )}
              >
                <Icon aria-hidden className="size-4 shrink-0 text-ink-secondary" />
                <span className="min-w-0 flex-1 truncate">{result.label}</span>
                {result.hint ? <span className="shrink-0 text-xs text-ink-secondary">{result.hint}</span> : null}
                {selected ? <CornerDownLeft aria-hidden className="size-3.5 shrink-0 text-ink-secondary rtl:-scale-x-100" /> : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
