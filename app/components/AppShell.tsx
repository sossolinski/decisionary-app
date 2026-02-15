// app/components/AppShell.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
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

  const effectiveCollapsed = useMemo(
    () => (isMobile ? false : collapsed),
    [isMobile, collapsed]
  );

  // Close mobile drawer on route change? (kept simple: when switching to desktop)
  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  return (
    <div className="min-h-screen bg-grid">
      {/* Topbar is fixed / full-width in its own component; keep spacing here */}
      <AppTopbar
        isMobile={isMobile}
        onToggleMobileSidebar={() => setMobileOpen((v) => !v)}
      />

      <AppSidebar
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        collapsed={effectiveCollapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
      />

      {/* Main stage */}
      <div
        className={[
          // desktop sidebar offset
          "pt-[64px]", // aligns with topbar height
          effectiveCollapsed ? "lg:pl-[84px]" : "lg:pl-[280px]",
          "transition-[padding] duration-200 ease-out",
        ].join(" ")}
      >
        {/* Landing-like centered stage with glass surface */}
        <div className="studio-container py-6">
          <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden">
            {/* inner padding (content) */}
            <div className="p-4 sm:p-6">{children}</div>
          </div>

          {/* subtle footer spacing to avoid “stuck to bottom” feeling */}
          <div className="h-10" />
        </div>
      </div>
    </div>
  );
}
