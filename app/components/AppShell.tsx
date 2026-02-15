// app/components/AppShell.tsx
"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import AppSidebar from "@/app/components/AppSidebar";
import MobileSidebar from "@/app/components/MobileSidebar";
import AppTopbar from "@/app/components/AppTopbar";

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

  // Hide shell on login / landing routes
  const hideShell =
    pathname === "/" ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/join");

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // close on route change
    setMobileOpen(false);
  }, [pathname]);

  if (hideShell) return <>{children}</>;

  return (
    <div className="min-h-screen">
      <AppTopbar onToggleMobile={isMobile ? () => setMobileOpen((v) => !v) : undefined} />

      {/* Sidebar pinned left */}
      {isMobile ? (
        <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      ) : (
        <AppSidebar />
      )}

      {/* Main content */}
      <main
        className={[
          "pt-14", // ✅ matches topbar height (h-14 = 56px)
          isMobile ? "" : "pl-[84px]", // sidebar (collapsed width)
        ].join(" ")}
      >
        <div className="mx-auto w-full max-w-[1400px] px-5 py-6">{children}</div>
      </main>
    </div>
  );
}
