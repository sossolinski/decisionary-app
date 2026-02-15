// app/components/AppSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, PlayCircle, Settings } from "lucide-react";
import clsx from "clsx";

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  collapsed,
}: {
  href: string;
  icon: any;
  label: string;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-3 rounded-[12px] px-3 h-10 text-sm transition",
        active
          ? "bg-[var(--studio-highlight)] border border-[var(--studio-border)] shadow-soft"
          : "hover:bg-secondary/50",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon className="h-4 w-4 opacity-80 shrink-0" />

      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

export default function AppSidebar({
  isMobile,
  mobileOpen,
  setMobileOpen,
  collapsed,
  onToggleCollapsed,
}: {
  isMobile: boolean;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();

  const width = collapsed ? "w-[84px]" : "w-[280px]";

  return (
    <>
      {/* MOBILE OVERLAY */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={clsx(
          "fixed top-[64px] left-0 bottom-0 z-50 transition-all duration-200",
          width,
          isMobile
            ? clsx(
                "surface shadow-soft",
                mobileOpen ? "translate-x-0" : "-translate-x-full"
              )
            : "surface border-r border-[var(--studio-border)]"
        )}
      >
        <div className="h-full flex flex-col p-3 gap-4">

          {/* SECTION */}
          <div className="text-xs uppercase tracking-wide text-[color:var(--studio-muted2)] px-2">
            Facilitator
          </div>

          <nav className="flex flex-col gap-1">
            <NavItem
              href="/facilitator"
              icon={LayoutDashboard}
              label="Overview"
              active={pathname === "/facilitator"}
              collapsed={collapsed}
            />

            <NavItem
              href="/facilitator/scenarios"
              icon={FileText}
              label="Scenarios"
              active={pathname.startsWith("/facilitator/scenarios")}
              collapsed={collapsed}
            />

            <NavItem
              href="/facilitator/sessions"
              icon={PlayCircle}
              label="Sessions"
              active={pathname.startsWith("/facilitator/sessions")}
              collapsed={collapsed}
            />
          </nav>

          {/* spacer */}
          <div className="flex-1" />

          {/* SETTINGS */}
          <nav className="flex flex-col gap-1">
            <NavItem
              href="/settings"
              icon={Settings}
              label="Settings"
              active={pathname.startsWith("/settings")}
              collapsed={collapsed}
            />
          </nav>

          {/* collapse button desktop */}
          {!isMobile && (
            <button
              onClick={onToggleCollapsed}
              className="mt-2 text-xs text-[color:var(--studio-muted2)] hover:text-foreground transition"
            >
              {collapsed ? "Expand" : "Collapse"}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
