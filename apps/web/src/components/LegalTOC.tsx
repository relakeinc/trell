"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface TOCItem {
  id: string;
  label: string;
}

export function LegalTOC({ items }: { items: TOCItem[] }) {
  const [active, setActive] = useState(items[0]?.id);
  const rafRef = useRef<number>(0);

  const update = useCallback(() => {
    const offset = 120;
    const scrollY = window.scrollY;
    const docHeight = document.documentElement.scrollHeight;
    const winHeight = window.innerHeight;

    if (scrollY + winHeight >= docHeight - 10) {
      setActive(items[items.length - 1]?.id);
      return;
    }

    let current = items[0]?.id;

    for (const item of items) {
      const el = document.getElementById(item.id);
      if (!el) continue;
      const top = el.getBoundingClientRect().top + scrollY;
      if (top <= scrollY + offset) {
        current = item.id;
      }
    }

    setActive(current);
  }, [items]);

  useEffect(() => {
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [update]);

  return (
    <nav className="sticky top-20 hidden w-52 shrink-0 self-start lg:block">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-neutral-900">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" />
        </svg>
        On this page
      </div>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`block border-l-2 py-1 pl-3 text-[13px] transition-colors ${
                  isActive
                    ? "border-blue-600 font-medium text-neutral-900"
                    : "border-transparent text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
