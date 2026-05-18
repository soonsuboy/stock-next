"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export default function NavigationProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (delayRef.current) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
    }
    const hideTimer = setTimeout(() => setVisible(false), 0);
    return () => clearTimeout(hideTimer);
  }, [pathname]);

  useEffect(() => {
    const startProgress = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;

      const currentUrl = new URL(window.location.href);
      if (
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search
      ) {
        return;
      }

      if (delayRef.current) clearTimeout(delayRef.current);
      delayRef.current = setTimeout(() => setVisible(true), 120);
    };

    const stopProgress = () => {
      if (delayRef.current) clearTimeout(delayRef.current);
      setVisible(false);
    };

    document.addEventListener("click", startProgress, true);
    window.addEventListener("pageshow", stopProgress);

    return () => {
      document.removeEventListener("click", startProgress, true);
      window.removeEventListener("pageshow", stopProgress);
      if (delayRef.current) clearTimeout(delayRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-live="polite"
      aria-label="페이지 이동 중"
      className="fixed left-0 top-0 z-[70] h-1 w-full overflow-hidden bg-blue-100 dark:bg-blue-950"
    >
      <div className="route-progress-bar h-full w-full bg-blue-600 dark:bg-blue-300" />
    </div>
  );
}
