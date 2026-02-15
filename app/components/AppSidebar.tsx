// app/components/AppSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutGrid,
  BookOpen,
  PlayCircle,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  User,
} from "lucide-react";

const LS_KEY = "decisionary.sidebar.collapsed";

function itemActive(pathname: string, href: string) {
  if (href === "/facilitator") return pathname === "/facilitator";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const v = localStorage.getItem(LS_KEY);
    if (v === "0") setCollapsed(false);
    if (v === "1") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem(LS_KEY, next ? "1" : "0");
      return next;
    });
  }

  const width = collapsed ? "w-[84px]" : "w-[260px]";

  const nav = useMemo(
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
              {!collapsed ? (
                <div className="text-sm font-semibold">Decisionary</div>
              ) : null}
            </div>
          </div>

          {/* NAV */}
          <nav className="flex-1 px-2 py-2 space-y-2">
            {nav.map((n) => {
              const active = itemActive(pathname ?? "", n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  title={collapsed ? n.label : undefined}
                  className={[
                    itemBase,
                    collapsed ? itemCollapsed : itemExpanded,
                    active
                      ? "border-primary/25 bg-primary/10"
                      : "border-[var(--studio-border)]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "text-foreground/80",
                      active ? "text-foreground" : "",
                    ].join(" ")}
                  >
                    {n.icon}
                  </span>

                  {!collapsed ? (
                    <span className="text-sm font-medium">{n.label}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {/* Bottom */}
          <div className="px-2 pb-3 space-y-2">
            <Link
              href="/participant"
              title={collapsed ? "Participant" : undefined}
              className={[
                itemBase,
                collapsed ? itemCollapsed : itemExpanded,
                itemActive(pathname ?? "", "/participant")
                  ? "border-primary/25 bg-primary/10"
                  : "border-[var(--studio-border)]",
              ].join(" ")}
            >
              <User className="h-5 w-5 text-foreground/80" />
              {!collapsed ? (
                <span className="text-sm font-medium">Participant</span>
              ) : null}
            </Link>

            <Link
              href="/facilitator/settings"
              title={collapsed ? "Settings" : undefined}
              className={[
                itemBase,
                collapsed ? itemCollapsed : itemExpanded,
                itemActive(pathname ?? "", "/facilitator/settings")
                  ? "border-primary/25 bg-primary/10"
                  : "border-[var(--studio-border)]",
              ].join(" ")}
            >
              <Settings className="h-5 w-5 text-foreground/80" />
              {!collapsed ? (
                <span className="text-sm font-medium">Settings</span>
              ) : null}
            </Link>

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
              {!collapsed ? (
                <span className="text-sm font-medium">Collapse</span>
              ) : null}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
