// app/components/AppSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  LayoutGrid,
  BookOpen,
  PlayCircle,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  User,
  Shield,
} from "lucide-react";

import { useRoleContext } from "@/app/components/useRoleContext";

const LS_KEY = "decisionary.sidebar.collapsed";

function itemActive(pathname: string, href: string) {
  if (href === "/facilitator") return pathname === "/facilitator";
  return pathname === href || pathname.startsWith(href + "/");
}

type NavItemProps = {
  href: string;
  label: string;
  icon: ReactNode;
  pathname: string;
  collapsed: boolean;
  itemBase: string;
  itemCollapsed: string;
  itemExpanded: string;
};

function NavItem({
  href,
  label,
  icon,
  pathname,
  collapsed,
  itemBase,
  itemCollapsed,
  itemExpanded,
}: NavItemProps) {
  const active = itemActive(pathname, href);
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={[
        itemBase,
        collapsed ? itemCollapsed : itemExpanded,
        active ? "border-primary/25 bg-primary/10" : "border-[var(--studio-border)]",
      ].join(" ")}
    >
      <span className={["text-foreground/80", active ? "text-foreground" : ""].join(" ")}>
        {icon}
      </span>
      {!collapsed ? <span className="text-sm font-medium">{label}</span> : null}
    </Link>
  );
}

export default function AppSidebar() {
  const pathname = usePathname();
  const { loading, activeRole, isDisabled } = useRoleContext();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem(LS_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
    return true;
  });

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem(LS_KEY, next ? "1" : "0");
      return next;
    });
  }

  const width = collapsed ? "w-[84px]" : "w-[260px]";

  const canFacilitate =
    !loading &&
    !isDisabled &&
    (activeRole === "admin" || activeRole === "facilitator");

  const isParticipantView = !loading && !isDisabled && activeRole === "participant";
  const isAdminView = !loading && !isDisabled && activeRole === "admin";

  const facilitatorNav = useMemo(
    () => [
      {
        label: "Overview",
        href: "/facilitator",
        icon: <LayoutGrid className="h-5 w-5" />,
      },
      {
        label: "Scenarios",
        href: "/facilitator/scenarios",
        icon: <BookOpen className="h-5 w-5" />,
      },
      {
        label: "Sessions",
        href: "/facilitator/sessions",
        icon: <PlayCircle className="h-5 w-5" />,
      },
    ],
    []
  );

  const itemBase =
    "group relative flex items-center gap-3 rounded-[16px] border transition " +
    "focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]";

  const itemCollapsed =
    "h-11 w-11 justify-center mx-auto border-[var(--studio-border)] bg-[var(--studio-surface2)] " +
    "hover:bg-secondary/70 hover:border-[var(--studio-border-strong)]";

  const itemExpanded =
    "h-11 px-3 border-[var(--studio-border)] bg-[var(--studio-surface2)] " +
    "hover:bg-secondary/70 hover:border-[var(--studio-border-strong)]";

  if (loading) {
    // Keep layout stable; no flashing of links
    return (
      <aside
        className={[
          "fixed left-0 top-0 z-30 h-screen",
          "pt-[76px]",
          width,
        ].join(" ")}
      >
        <div className="h-full px-3 pb-4">
          <div className="h-full surface shadow-soft rounded-[18px]" />
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={[
        "fixed left-0 top-0 z-30 h-screen",
        "pt-[76px]", // under topbar
        width,
      ].join(" ")}
    >
      <div className="h-full px-3 pb-4">
        <div className="h-full surface shadow-soft rounded-[18px] flex flex-col">
          {/* Top spacer / tiny brand */}
          <div className="px-3 pt-3 pb-2">
            <div
              className={[
                "rounded-[16px] border border-[var(--studio-border)] bg-[var(--studio-highlight)]",
                "flex items-center",
                collapsed ? "justify-center h-11" : "h-11 px-3 gap-3",
              ].join(" ")}
            >
              <span
                className="block h-5 w-5 rounded-full"
                style={{
                  background:
                    "linear-gradient(135deg, var(--studio-accent-blue), var(--studio-accent-purple))",
                }}
              />
              {!collapsed ? <div className="text-sm font-semibold">Decisionary</div> : null}
            </div>
          </div>

          {/* NAV */}
          <nav className="flex-1 px-2 py-2 space-y-2">
            {/* Facilitator nav visible only in facilitator/admin view */}
            {canFacilitate
              ? facilitatorNav.map((n) => (
                  <NavItem
                    key={n.href}
                    href={n.href}
                    label={n.label}
                    icon={n.icon}
                    pathname={pathname ?? ""}
                    collapsed={collapsed}
                    itemBase={itemBase}
                    itemCollapsed={itemCollapsed}
                    itemExpanded={itemExpanded}
                  />
                ))
              : null}

            {/* Admin nav visible only when VIEW AS admin */}
            {isAdminView ? (
              <NavItem
                href="/admin/users"
                label="Admin · Users"
                icon={<Shield className="h-5 w-5" />}
                pathname={pathname ?? ""}
                collapsed={collapsed}
                itemBase={itemBase}
                itemCollapsed={itemCollapsed}
                itemExpanded={itemExpanded}
              />
            ) : null}
          </nav>

          {/* Bottom */}
          <div className="px-2 pb-3 space-y-2">
            {/* Participant shortcut visible only in participant view (full simulation) */}
            {isParticipantView ? (
              <NavItem
                href="/participant"
                label="Participant"
                icon={<User className="h-5 w-5" />}
                pathname={pathname ?? ""}
                collapsed={collapsed}
                itemBase={itemBase}
                itemCollapsed={itemCollapsed}
                itemExpanded={itemExpanded}
              />
            ) : null}

            {/* Settings only for facilitator/admin views */}
            {canFacilitate ? (
              <NavItem
                href="/facilitator/settings"
                label="Settings"
                icon={<Settings className="h-5 w-5" />}
                pathname={pathname ?? ""}
                collapsed={collapsed}
                itemBase={itemBase}
                itemCollapsed={itemCollapsed}
                itemExpanded={itemExpanded}
              />
            ) : null}

            {/* Collapse */}
            <button
              type="button"
              onClick={toggle}
              className={[
                itemBase,
                collapsed ? itemCollapsed : itemExpanded,
                "border-[var(--studio-border)] bg-[var(--studio-surface2)]",
                "hover:bg-secondary/70 hover:border-[var(--studio-border-strong)]",
              ].join(" ")}
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? (
                <ChevronsRight className="h-5 w-5 text-foreground/80" />
              ) : (
                <ChevronsLeft className="h-5 w-5 text-foreground/80" />
              )}
              {!collapsed ? <span className="text-sm font-medium">Collapse</span> : null}
            </button>

            {/* Mini role indicator in sidebar (only expanded) */}
            {!collapsed ? (
              <div className="px-1 pt-1 text-xs text-[color:var(--studio-muted2)]">
                View as: <b className="text-foreground">{activeRole ?? "—"}</b>
                {isDisabled ? <span className="ml-2 text-red-400">disabled</span> : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
