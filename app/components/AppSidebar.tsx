// app/components/AppSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import {
  LayoutGrid,
  BookOpen,
  PlayCircle,
  Settings,
  BellRing,
  ChevronsLeft,
  ChevronsRight,
  User,
  Building2,
  Users,
  CreditCard,
} from "lucide-react";

import { useRoleContext } from "@/app/components/useRoleContext";
import HintTooltip from "@/app/components/HintTooltip";
import RoleSwitcher from "@/app/components/RoleSwitcher";

function humanRole(value?: string | null) {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function itemActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
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

function SectionLabel({
  children,
  collapsed,
}: {
  children: ReactNode;
  collapsed: boolean;
}) {
  if (collapsed) {
    return <div className="h-px w-full bg-[var(--studio-border)]/80" />;
  }

  return (
    <div className="px-2 pt-2 pb-1 text-[11px] font-semibold text-[color:var(--studio-muted2)]">
      {children}
    </div>
  );
}

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
      {!collapsed ? <span className="min-w-0 truncate text-sm font-medium">{label}</span> : null}
    </Link>
  );
}

type AppSidebarProps = {
  mobile?: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export default function AppSidebar({
  mobile = false,
  collapsed,
  onToggleCollapsed,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { loading, activeRole, isDisabled } = useRoleContext();
  const isParticipantArea = (pathname ?? "").startsWith("/participant");
  const isAdminArea = (pathname ?? "").startsWith("/admin");
  const isFacilitatorArea =
    (pathname ?? "").startsWith("/facilitator") || (pathname ?? "").startsWith("/sessions/");

  const width = collapsed ? "w-[72px]" : "w-[240px]";
  const asidePosition = mobile
    ? "relative h-full w-full pt-0"
    : ["fixed left-0 top-0 z-30 h-screen", "pt-[68px]", width].join(" ");

  const canFacilitate =
    !loading &&
    !isDisabled &&
    (activeRole === "admin" || activeRole === "facilitator");

  const isParticipantView = !loading && !isDisabled && activeRole === "participant";
  const isAdminView = !loading && !isDisabled && activeRole === "admin";
  const viewingRole = activeRole;

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
      {
        label: "Workspace",
        href: "/facilitator/workspace",
        icon: <Settings className="h-5 w-5" />,
      },
    ],
    []
  );

  const participantNav = useMemo(
    () => [
      {
        label: "Overview",
        href: "/participant",
        icon: <User className="h-5 w-5" />,
      },
    ],
    []
  );

  const itemBase =
    "group relative flex w-full min-w-0 items-center gap-3 rounded-[10px] border transition " +
    "focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]";

  const itemCollapsed =
    "h-10 w-10 justify-center mx-auto border-transparent bg-transparent " +
    "hover:bg-secondary/70 hover:border-[var(--studio-border)]";

  const itemExpanded =
    "h-10 justify-start px-2.5 border-transparent bg-transparent " +
    "hover:bg-secondary/70 hover:border-[var(--studio-border)]";

  if (loading) {
    // Keep layout stable; no flashing of links
    return (
      <aside className={asidePosition}>
        <div className="h-full border-r border-[var(--studio-border)] bg-[var(--studio-surface)] px-2 pb-3">
          <div className="h-full" />
        </div>
      </aside>
    );
  }

  return (
    <aside className={asidePosition}>
      <div className="h-full border-r border-[var(--studio-border)] bg-[var(--studio-surface)] px-2 pb-3">
        <div className="h-full overflow-visible flex flex-col">
          {/* NAV */}
          <nav className="min-h-0 flex-1 overflow-y-auto px-0 py-3 space-y-3">
            {(isParticipantArea || isParticipantView) ? (
              <div className="space-y-2.5">
                <SectionLabel collapsed={collapsed}>Participant</SectionLabel>
                {participantNav.map((n) => (
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
                ))}
              </div>
            ) : null}

            {/* Facilitator nav visible in facilitator areas, not above admin nav */}
            {canFacilitate && isFacilitatorArea && !isParticipantArea && !isAdminArea ? (
              <div className="space-y-2.5">
                <SectionLabel collapsed={collapsed}>Facilitator</SectionLabel>
                {facilitatorNav.map((n) => (
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
                ))}
              </div>
            ) : null}

            {/* Admin nav takes priority inside admin area */}
            {isAdminView && isAdminArea ? (
              <div className="space-y-2.5">
                <SectionLabel collapsed={collapsed}>Admin</SectionLabel>
                <NavItem
                  href="/admin"
                  label="Overview"
                  icon={<LayoutGrid className="h-5 w-5" />}
                  pathname={pathname ?? ""}
                  collapsed={collapsed}
                  itemBase={itemBase}
                  itemCollapsed={itemCollapsed}
                  itemExpanded={itemExpanded}
                />
                <NavItem
                  href="/admin/organizations"
                  label="Organizations"
                  icon={<Building2 className="h-5 w-5" />}
                  pathname={pathname ?? ""}
                  collapsed={collapsed}
                  itemBase={itemBase}
                  itemCollapsed={itemCollapsed}
                  itemExpanded={itemExpanded}
                />
                <NavItem
                  href="/admin/users"
                  label="People"
                  icon={<Users className="h-5 w-5" />}
                  pathname={pathname ?? ""}
                  collapsed={collapsed}
                  itemBase={itemBase}
                  itemCollapsed={itemCollapsed}
                  itemExpanded={itemExpanded}
                />
                <NavItem
                  href="/admin/billing"
                  label="Billing"
                  icon={<CreditCard className="h-5 w-5" />}
                  pathname={pathname ?? ""}
                  collapsed={collapsed}
                  itemBase={itemBase}
                  itemCollapsed={itemCollapsed}
                  itemExpanded={itemExpanded}
                />
                <NavItem
                  href="/admin/announcements"
                  label="Announcements"
                  icon={<BellRing className="h-5 w-5" />}
                  pathname={pathname ?? ""}
                  collapsed={collapsed}
                  itemBase={itemBase}
                  itemCollapsed={itemCollapsed}
                  itemExpanded={itemExpanded}
                />
              </div>
            ) : null}

          </nav>

          {/* Bottom */}
          <div className="border-t border-[var(--studio-border)] px-0 pb-2 pt-3 space-y-2.5">
            {!collapsed ? (
              <div className="space-y-2.5 border-b border-[var(--studio-border)] px-2 pb-3">
                <div className="flex items-center gap-2">
                  <div className="ui-section-label">View mode</div>
                  <HintTooltip
                    text="Preview the workspace from another perspective without signing out."
                    side="top"
                  />
                </div>
                <RoleSwitcher />
              </div>
            ) : null}

            {/* Collapse */}
            {!mobile ? (
              <button
                type="button"
                onClick={onToggleCollapsed}
                aria-expanded={!collapsed}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className={[
                  itemBase,
                  collapsed ? itemCollapsed : itemExpanded,
                  "border-[var(--studio-border)]",
                  "hover:bg-secondary/70",
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
            ) : null}

            {/* Mini role indicator in sidebar (only expanded) */}
            {!collapsed ? (
              <div className="px-2 py-1 text-xs text-[color:var(--studio-muted2)]">
                <div>
                  Viewing as: <b className="text-foreground">{humanRole(viewingRole)}</b>
                </div>
                {isDisabled ? <div className="mt-1 text-destructive">Account disabled</div> : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
