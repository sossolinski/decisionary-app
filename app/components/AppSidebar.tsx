"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
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

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const facilitator: NavItem[] = [
  { href: "/facilitator", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/facilitator/scenarios", label: "Scenarios", icon: FileText },
  { href: "/facilitator/sessions", label: "Sessions", icon: PlayCircle },
];

const participant: NavItem[] = [{ href: "/participant", label: "Participant", icon: Users, exact: true }];

const system: NavItem[] = [{ href: "/facilitator/settings", label: "Settings", icon: Settings }];

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
        "group relative rounded-[var(--radius)] text-sm transition",
        "focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]",
        collapsed
          ? // RAIL ITEM
            "flex h-10 w-10 items-center justify-center"
          : // FULL ITEM
            "flex items-center gap-3 px-3 py-2",
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
    >
      {/* Active indicator (subtelny, działa też w railu) */}
      {active ? (
        <span
          className={cn(
            "absolute rounded-full bg-foreground/70",
            collapsed
              ? "left-1 top-1/2 h-5 w-[3px] -translate-y-1/2"
              : "left-0 top-1/2 h-6 w-[3px] -translate-y-1/2"
          )}
        />
      ) : null}

      <Icon
        className={cn(
          "h-4 w-4 shrink-0 opacity-90 group-hover:opacity-100",
          collapsed && active && "opacity-100"
        )}
      />

      {!collapsed ? <span className="flex-1">{item.label}</span> : <span className="sr-only">{item.label}</span>}

      {/* Chevron tylko dla aktywnej pozycji w trybie expanded */}
      {!collapsed && active ? <ChevronRight className="h-4 w-4 opacity-60" /> : null}
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
    <div className="space-y-2">
      {/* W collapsed NIE pokazujemy żadnych kropek ani nagłówków */}
      {!collapsed ? (
        <div className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground">
          {title.toUpperCase()}
        </div>
      ) : null}

      <nav className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
        {items.map((i) => (
          <NavRow key={i.href} item={i} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>
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
  const closeMobile = () => setMobileOpen(false);

  // keyboard shortcut (⌘\ / Ctrl\) — zostaje
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

  // Premium: collapse button jako "ghost" (nie wystaje i nie wygląda jak kafelek)
  const collapseBtn =
    "inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius)] " +
    "text-muted-foreground hover:bg-secondary hover:text-foreground transition " +
    "focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]";

  const desktop = (
    <aside
      className={cn(
        "hidden lg:flex border-r border-border bg-background",
        "transition-[width] duration-200",
        collapsed ? "w-[84px]" : "w-[280px]"
      )}
    >
      <div className={cn("flex w-full flex-col py-3", collapsed ? "px-2" : "px-3")}>
        {/* Top row: przycisk nie przy prawej krawędzi, tylko zawsze przy lewej (spójnie z rail) */}
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-start")}>
          <button
            onClick={onToggleCollapsed}
            className={collapseBtn}
            title={collapsed ? "Expand sidebar (⌘\\ / Ctrl\\)" : "Collapse sidebar (⌘\\ / Ctrl\\)"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <div className={cn("mt-4 flex flex-1 flex-col", collapsed ? "gap-3" : "gap-6")}>
          <Section title="Facilitator" items={facilitator} collapsed={collapsed} />
          {/* Separator tylko w collapsed, żeby rail wyglądał równo i „intencjonalnie” */}
          {collapsed ? <div className="mx-auto h-px w-8 bg-border" /> : null}

          <Section title="Participant" items={participant} collapsed={collapsed} />
          {collapsed ? <div className="mx-auto h-px w-8 bg-border" /> : null}

          <div className="mt-auto">
            <Section title="System" items={system} collapsed={collapsed} />
            {!collapsed ? (
              <div className="mt-4 px-2 text-xs text-muted-foreground">v0.1 • MVP</div>
            ) : (
              <div className="mt-3 flex justify-center text-[10px] text-muted-foreground">v0.1</div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );

  const mobile = (
    <>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      ) : null}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-dvh w-[84vw] max-w-[320px] border-r border-border bg-background lg:hidden",
          "transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-muted" />
            <div className="leading-tight">
              <div className="text-sm font-semibold">Decisionary</div>
              <div className="text-xs text-muted-foreground">Console</div>
            </div>
          </div>

          <button
            onClick={() => setMobileOpen(false)}
            className={collapseBtn}
            aria-label="Close menu"
            title="Close"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        <div className="flex h-[calc(100dvh-56px)] flex-col gap-6 overflow-auto px-3 py-4">
          <Section title="Facilitator" items={facilitator} collapsed={false} onNavigate={closeMobile} />
          <Section title="Participant" items={participant} collapsed={false} onNavigate={closeMobile} />
          <div className="mt-auto">
            <Section title="System" items={system} collapsed={false} onNavigate={closeMobile} />
            <div className="mt-4 px-2 text-xs text-muted-foreground">v0.1 • MVP</div>
          </div>
        </div>
      </aside>
    </>
  );

  return (
    <>
      {desktop}
      {mobile}
    </>
  );
}
