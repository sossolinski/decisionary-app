"use client";

import { useEffect, useMemo, useState } from "react";
import AppTopbar from "@/app/components/AppTopbar";
import AppSidebar from "@/app/components/AppSidebar";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    onChange();
    m.addEventListener?.("change", onChange);
    return () => m.removeEventListener?.("change", onChange);
  }, [query]);
  return matches;
}

const LS_COLLAPSED = "decisionary_sidebar_collapsed";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery("(max-width: 1023px)"); // spójne z Tailwind: lg=1024
  const [mobileOpen, setMobileOpen] = useState(false);

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(LS_COLLAPSED) === "1");
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(LS_COLLAPSED, collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  const effectiveCollapsed = useMemo(() => (isMobile ? false : collapsed), [isMobile, collapsed]);

  return (
    <div className="min-h-dvh bg-background">
      <AppTopbar
        isMobile={isMobile}
        onToggleMobileSidebar={() => setMobileOpen((v) => !v)}
      />

      <div className="flex min-h-[calc(100dvh-56px)]">
        <AppSidebar
          isMobile={isMobile}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          collapsed={effectiveCollapsed}
          onToggleCollapsed={() => setCollapsed((v) => !v)}
        />

        <main className="flex-1 bg-muted/30">
          <div className="p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
