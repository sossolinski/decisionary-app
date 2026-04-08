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
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem(SIDEBAR_LS_KEY);
    if (v === "0") return false;
    return true;
  });

  // Hide shell on login / landing routes
  const hideShell =
    pathname === "/" ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/join");

  const [mobileOpen, setMobileOpen] = useState(false);

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
        className={[
          "pt-14", // ✅ matches topbar height (h-14 = 56px)
          isMobile ? "" : sidebarCollapsed ? "pl-[84px]" : "pl-[260px]",
          "transition-[padding] duration-200",
        ].join(" ")}
      >
        <div className="mx-auto w-full max-w-[1400px] px-5 py-6">{children}</div>
      </main>
    </div>
  );
}
