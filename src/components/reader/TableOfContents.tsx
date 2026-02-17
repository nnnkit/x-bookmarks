import { useCallback, useEffect, useState } from "react";
import type { TocSection } from "./types";
import { truncateLabel } from "./utils";

export function useActiveSection(sectionIds: string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);
  const idsKey = sectionIds.join(",");

  useEffect(() => {
    if (sectionIds.length === 0) {
      setActiveId(null);
      return;
    }
    setActiveId(sectionIds[0]);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -65% 0px", threshold: 0 },
    );

    const timer = setTimeout(() => {
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [idsKey]);

  return activeId;
}

export function useScrolledPast(threshold = 300): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > threshold);
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, [threshold]);

  return scrolled;
}

export function TableOfContents({
  sections,
  activeId,
  scrolledPast,
}: {
  sections: TocSection[];
  activeId: string | null;
  scrolledPast: boolean;
}) {
  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <>
      {/* Expanded sidebar — visible on xl+ when near top */}
      <nav
        className={`sticky top-24 hidden max-h-[calc(100vh-8rem)] overflow-y-auto pr-4 transition-opacity duration-300 xl:block ${
          scrolledPast ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-x-text-secondary">
          Contents
        </p>
        <ul className="space-y-0.5">
          {sections.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => scrollToSection(section.id)}
                className={`w-full rounded px-2 py-1.5 text-left text-[13px] leading-snug transition-colors ${
                  activeId === section.id
                    ? "bg-x-blue/8 font-medium text-x-blue"
                    : "text-x-text-secondary hover:text-x-text"
                }`}
              >
                {truncateLabel(section.label, 40)}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Minimap — visible on md-xl always, or xl+ when scrolled */}
      <nav
        className={`fixed left-3 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-2 md:flex ${
          scrolledPast ? "xl:flex" : "xl:hidden"
        }`}
      >
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => scrollToSection(section.id)}
            aria-label={truncateLabel(section.label, 40)}
            title={truncateLabel(section.label, 40)}
            className={`rounded-full transition-all ${
              activeId === section.id
                ? "h-1 w-5 bg-x-blue"
                : "h-1 w-2.5 bg-x-text-secondary/40 hover:bg-x-text-secondary"
            }`}
          />
        ))}
      </nav>
    </>
  );
}
