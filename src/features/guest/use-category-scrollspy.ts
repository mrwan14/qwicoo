"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Highlights the category whose section is nearest the sticky offset.
 * Auto-scrolls the tab strip so the active tab stays in view.
 */
export function useCategoryScrollSpy(categoryIds: readonly string[], stickyOffsetPx = 112) {
  const [activeId, setActiveId] = useState<string | null>(categoryIds[0] ?? null);
  const tabRefs = useRef(new Map<string, HTMLElement>());
  const suppressUntil = useRef(0);

  useEffect(() => {
    if (categoryIds.length === 0) {
      setActiveId(null);
      return;
    }
    setActiveId((current) => (current && categoryIds.includes(current) ? current : categoryIds[0]!));
  }, [categoryIds]);

  useEffect(() => {
    if (categoryIds.length === 0) return;

    const sections = categoryIds
      .map((id) => document.getElementById(`cat-${id}`))
      .filter((node): node is HTMLElement => Boolean(node));
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < suppressUntil.current) return;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (!top?.target.id.startsWith("cat-")) return;
        const id = top.target.id.slice(4);
        setActiveId(id);
      },
      {
        root: null,
        rootMargin: `-${stickyOffsetPx}px 0px -55% 0px`,
        threshold: [0.1, 0.25, 0.5, 0.75],
      },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [categoryIds, stickyOffsetPx]);

  useEffect(() => {
    if (!activeId) return;
    const tab = tabRefs.current.get(activeId);
    const strip = tab?.parentElement;
    if (!tab || !strip) return;
    const tabBox = tab.getBoundingClientRect();
    const stripBox = strip.getBoundingClientRect();
    const delta = tabBox.left + tabBox.width / 2 - (stripBox.left + stripBox.width / 2);
    if (Math.abs(delta) < 8) return;
    // Move the pill row only. A smooth scrollIntoView also drags the page and fights the finger.
    strip.scrollLeft += delta;
  }, [activeId]);

  function registerTab(id: string, node: HTMLElement | null) {
    if (node) tabRefs.current.set(id, node);
    else tabRefs.current.delete(id);
  }

  function scrollToCategory(id: string) {
    const section = document.getElementById(`cat-${id}`);
    if (!section) return;
    suppressUntil.current = Date.now() + 700;
    setActiveId(id);
    const top = section.getBoundingClientRect().top + window.scrollY - stickyOffsetPx;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  return { activeId, registerTab, scrollToCategory };
}
