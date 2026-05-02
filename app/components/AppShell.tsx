// app/components/AppShell.tsx
"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import AppSidebar from "@/app/components/AppSidebar";
import MobileSidebar from "@/app/components/MobileSidebar";
import AppTopbar from "@/app/components/AppTopbar";

const SIDEBAR_LS_KEY = "decisionary.sidebar.collapsed";

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

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isMobile = useMediaQuery("(max-width: 1024px)");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // Hide shell on login / landing routes
  const hideShell =
    pathname === "/" ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/join");

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = window.localStorage.getItem(SIDEBAR_LS_KEY);
      setSidebarCollapsed(value !== "0");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleDesktopSidebar() {
    setSidebarCollapsed((v) => {
      const next = !v;
      window.localStorage.setItem(SIDEBAR_LS_KEY, next ? "1" : "0");
      return next;
    });
  }

  useEffect(() => {
    if (!mobileOpen) return;
    const t = setTimeout(() => setMobileOpen(false), 0);
    return () => clearTimeout(t);
  }, [pathname, mobileOpen]);

  if (hideShell) return <>{children}</>;

  return (
    <div className="min-h-screen">
      <AppTopbar
        isMobile={isMobile}
        onToggleMobileSidebar={isMobile ? () => setMobileOpen((v) => !v) : undefined}
      />

      {/* Sidebar pinned left */}
      {isMobile ? (
        <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen}>
          <AppSidebar
            mobile
            collapsed={false}
            onToggleCollapsed={() => {
              // no-op in mobile sheet
            }}
          />
        </MobileSidebar>
      ) : (
        <AppSidebar collapsed={sidebarCollapsed} onToggleCollapsed={toggleDesktopSidebar} />
      )}

      {/* Main content */}
      <main
        id="main-content"
        className={[
          isMobile ? "" : sidebarCollapsed ? "pl-[72px]" : "pl-[240px]",
          "transition-[padding] duration-200",
        ].join(" ")}
      >
        <div className={["mx-auto w-full max-w-[1520px]", isMobile ? "px-4 py-4" : "px-5 py-5"].join(" ")}>
          {isMobile ? (
            children
          ) : (
            <div className="min-h-[calc(100vh-96px)] px-0 py-0">
              {children}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
