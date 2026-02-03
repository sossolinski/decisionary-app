// app/components/AppSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FileText,
  PlayCircle,
  Users,
  Settings,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

const facilitator: NavItem[] = [
  { href: "/facilitator", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/facilitator/scenarios", label: "Scenarios", icon: FileText, exact: false },
  { href: "/facilitator/sessions", label: "Sessions", icon: PlayCircle, exact: false },
];

const participant: NavItem[] = [
  { href: "/participant", label: "Participant", icon: Users, exact: true },
];

const system: NavItem[] = [
  { href: "/facilitator/settings", label: "Settings", icon: Settings, exact: true },
];

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function NavRow({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, item);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "relative rounded-[var(--radius)] text-sm transition",
        "text-muted-foreground hover:bg-secondary hover:text-foreground",
        active && "bg-secondary text-foreground",
        // Expanded layout
        !collapsed && "flex items-center gap-3 px-3 py-2",
        // Collapsed layout: perfect centering + equal hit area
        collapsed && "flex h-10 items-center justify-center px-2"
      )}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
    >
      {/* Active indicator */}
      {active ? (
        <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-foreground/70" />
      ) : null}

      <Icon className={cn("h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-80")} />

      {/* Label */}
      {!collapsed ? (
        <span className="min-w-0 truncate">{item.label}</span>
      ) : (
        <span className="sr-only">{item.label}</span>
      )}

      {/* Chevron only for active item (expanded) */}
      {!collapsed && active ? (
        <ChevronRight className="ml-auto h-4 w-4 opacity-70" />
      ) : null}
    </Link>
  );
}

function Section({
  title,
  items,
  collapsed,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {!collapsed ? (
        <div className="px-3 pt-2 text-[10px] font-semibold tracking-widest text-muted-foreground/80">
          {title.toUpperCase()}
        </div>
      ) : null}

      {items.map((i) => (
        <NavRow key={i.href} item={i} collapsed={collapsed} onNavigate={onNavigate} />
      ))}
    </div>
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
  const closeMobile = () => setMobileOpen(false);

  useEffect(() => {
    if (isMobile) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      if (e.key === "\\") {
        e.preventDefault();
        onToggleCollapsed();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobile, onToggleCollapsed]);

  const mode = useMemo<"facilitator" | "participant" | "unknown">(() => {
    if (pathname.startsWith("/facilitator")) return "facilitator";
    if (pathname.startsWith("/participant")) return "participant";
    if (pathname.startsWith("/sessions/")) return "participant";
    return "unknown";
  }, [pathname]);

  const collapseBtn =
    "inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius)] " +
    "text-muted-foreground hover:bg-secondary hover:text-foreground transition " +
    "focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]";

  const sidebarInner = (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-background",
        collapsed ? "w-[72px]" : "w-72"
      )}
    >
      {/* Top */}
      <div className={cn("flex items-center gap-2 px-3 py-3", collapsed && "justify-center")}>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={collapseBtn}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>

        {!collapsed ? (
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">Decisionary</div>
            <div className="text-xs text-muted-foreground">Console</div>
          </div>
        ) : null}
      </div>

      {collapsed ? <div className="mx-3 mb-2 h-px bg-border" /> : null}

      {/* Main */}
      <div className="flex-1 overflow-auto px-2 pb-3">
        <div className="flex flex-col gap-3">
          {mode === "facilitator" ? (
            <Section
              title="Facilitator"
              items={facilitator}
              collapsed={collapsed}
              onNavigate={isMobile ? closeMobile : undefined}
            />
          ) : mode === "participant" ? (
            <Section
              title="Participant"
              items={participant}
              collapsed={collapsed}
              onNavigate={isMobile ? closeMobile : undefined}
            />
          ) : (
            <>
              <Section
                title="Facilitator"
                items={facilitator}
                collapsed={collapsed}
                onNavigate={isMobile ? closeMobile : undefined}
              />
              <Section
                title="Participant"
                items={participant}
                collapsed={collapsed}
                onNavigate={isMobile ? closeMobile : undefined}
              />
            </>
          )}
        </div>
      </div>

      {/* Bottom: pinned, with safe-area padding so it never looks “hidden” */}
      <div
        className={cn("mt-auto border-t border-border px-2 pt-2")}
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
      >
        <div className="flex flex-col gap-1">
          {system.map((i) => (
            <NavRow
              key={i.href}
              item={i}
              collapsed={collapsed}
              onNavigate={isMobile ? closeMobile : undefined}
            />
          ))}
        </div>

        <div
          className={cn(
            "mt-2 px-3 text-xs text-muted-foreground",
            collapsed && "px-2 text-[11px] text-center"
          )}
        >
          {collapsed ? "v0.1" : "v0.1 • MVP"}
        </div>
      </div>
    </aside>
  );

  const desktop = (
    <div className="hidden md:block sticky top-0 h-screen">
      {sidebarInner}
    </div>
  );

  const mobile = (
    <div className="md:hidden">
      {mobileOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <div className="fixed inset-y-0 left-0 z-50">{sidebarInner}</div>
        </>
      ) : null}
    </div>
  );

  return (
    <>
      {desktop}
      {mobile}
    </>
  );
}
