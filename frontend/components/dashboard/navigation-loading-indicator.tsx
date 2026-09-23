"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";

export function NavigationLoadingIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const currentLocation = `${pathname}${query ? `?${query}` : ""}`;
  const [navigationSource, setNavigationSource] = useState<string | null>(null);
  const isNavigating = navigationSource === currentLocation;

  useEffect(() => {
    const onLinkClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest("a");
      if (!link || link.target || link.hasAttribute("download")) return;
      const destination = new URL(link.href, window.location.href);
      const current = new URL(window.location.href);
      if (destination.origin !== current.origin || destination.href === current.href || destination.hash) return;
      setNavigationSource(`${current.pathname}${current.search}`);
    };

    const onPopState = () => setNavigationSource(null);
    window.addEventListener("click", onLinkClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("click", onLinkClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  if (!isNavigating) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/30 backdrop-blur-[1px]" role="status" aria-live="polite" aria-label="Seite wird geladen">
      <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg">
        <Spinner className="text-primary" />
        <span className="text-sm font-medium">Seite wird geladen …</span>
      </div>
    </div>
  );
}
