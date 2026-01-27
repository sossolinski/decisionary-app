"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FileText,
  PlayCircle,
  Users,
  Settings,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

const facilitator: NavItem[] = [
  { href: "/facilitator", label: "Overview", icon: LayoutDashboard },
  { href: "/facilitator/scenarios", label: "Scenarios", icon: FileText },
  { href: "/facilitator/sessions", label: "Sessions", icon: PlayCircle },
];

const participant: NavItem[] = [
  { href: "/participant", label: "Participant", icon: Users },
];

const system: NavItem[] = [
  { href: "/facilitator/settings", label: "Settings", icon: Settings },
];

function Item({ href, label, icon: Icon }: NavItem) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-2 px-3 py-2 text-sm",
        "rounded-[var(--studio-radius)] transition",
        "focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]",
        "hover:translate-y-[-0.5px]",
        active
          ? "bg-[color:var(--studio-surface2)] shadow-[var(--studio-shadow)]"
          : "bg-transparent hover:bg-[color:var(--studio-surface2)]/60"
      )}
    >
      {/* Active left rail */}
      <span
        className={cn(
          "absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full transition-opacity",
          active
            ? "bg-[color:var(--studio-accent-blue)] opacity-90"
            : "bg-[color:var(--studio-accent-blue)] opacity-0 group-hover:opacity-30"
        )}
      />

      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          active
            ? "text-[color:var(--studio-accent-blue)]"
            : "text-muted-foreground group-hover:text-foreground"
        )}
      />

      <span className={cn("min-w-0 flex-1 truncate", active && "font-medium")}>
        {label}
      </span>

      <ChevronRight
        className={cn(
          "h-4 w-4 shrink-0 transition-opacity",
          active ? "opacity-60" : "opacity-0 group-hover:opacity-40"
        )}
      />
    </Link>
  );
}

function Section({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div className="space-y-2">
      <div className="px-3 pt-2 text-[11px] font-semibold tracking-wide text-muted-foreground">
        {title.toUpperCase()}
      </div>
      <div className="space-y-1">
        {items.map((i) => (
          <Item key={i.href} {...i} />
        ))}
      </div>
    </div>
  );
}

export default function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 md:block">
      <div
        className={cn(
          "m-3 flex h-[calc(100vh-1.5rem)] flex-col rounded-2xl",
          "border border-[color:var(--studio-border)]",
          "bg-[color:var(--studio-surface)] backdrop-blur-xl",
          "shadow-[var(--studio-shadow)]"
        )}
        style={{ WebkitBackdropFilter: "blur(16px)" }}
      >
        {/* Brand */}
        <div className="border-b border-[color:var(--studio-border)] px-4 py-4">
          <Link href="/facilitator" className="flex items-center gap-3">
            <div
              className={cn(
                "h-9 w-9 rounded-2xl",
                "border border-[color:var(--studio-border)]",
                "bg-gradient-to-br from-[color:var(--studio-accent-blue)]/10 to-[color:var(--studio-accent-purple)]/10"
              )}
            />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-[color:var(--studio-text)]">
                Decisionary
              </div>
              <div className="text-xs text-muted-foreground">
                Facilitator Console
              </div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-4 p-2">
          <Section title="Facilitator" items={facilitator} />
          <div className="mx-3 my-2 h-px bg-[color:var(--studio-border)]" />
          <Section title="Participant" items={participant} />
          <div className="mx-3 my-2 h-px bg-[color:var(--studio-border)]" />
          <Section title="System" items={system} />
        </nav>

        {/* Footer */}
        <div className="border-t border-[color:var(--studio-border)] p-4 text-xs text-muted-foreground">
          <span className="font-medium text-[color:var(--studio-text)]/70">
            v0.1
          </span>{" "}
          • MVP
        </div>
      </div>
    </aside>
  );
}
