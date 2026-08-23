"use client";

import { useEffect } from "react";

export function AnchorFocus() {
  useEffect(() => {
    function focusHashTarget(hash = window.location.hash) {
      if (!hash || hash === "#") return;

      let id: string;
      try {
        id = decodeURIComponent(hash.slice(1));
      } catch {
        return;
      }

      const target = document.getElementById(id);
      if (!target) return;

      const hadTabIndex = target.hasAttribute("tabindex");
      if (!hadTabIndex) target.tabIndex = -1;
      target.dataset.anchorFocus = "true";
      target.focus({ preventScroll: true });

      const clear = () => {
        delete target.dataset.anchorFocus;
        if (!hadTabIndex) target.removeAttribute("tabindex");
      };
      target.addEventListener("blur", clear, { once: true });
    }

    function handleAnchorClick(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(
        'a[href^="#"]',
      );
      if (!link) return;
      const targetUrl = new URL(link.href, window.location.href);
      if (
        targetUrl.origin !== window.location.origin ||
        targetUrl.pathname !== window.location.pathname ||
        targetUrl.search !== window.location.search
      ) {
        return;
      }
      requestAnimationFrame(() => focusHashTarget(targetUrl.hash));
    }

    const handleHashChange = () => focusHashTarget();

    window.addEventListener("hashchange", handleHashChange);
    document.addEventListener("click", handleAnchorClick);
    if (window.location.hash) requestAnimationFrame(() => focusHashTarget());
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      document.removeEventListener("click", handleAnchorClick);
    };
  }, []);

  return null;
}
