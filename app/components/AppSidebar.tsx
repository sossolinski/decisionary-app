"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  PlayCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: any };

const facilitator: NavItem[] = [
  { href: "/facilitator", label: "Overview", icon: LayoutDashboard },
  { href: "/facilitator/scenarios", label: "Scenarios", icon: FileText },
  { href: "/facilitator/sessions", label: "Sessions", icon: PlayCircle },
];

const participant: NavItem[] = [
  { href: "/participant", label: "Participant", icon: Users },
];

const secondary: NavItem[] = [
  { href: "/facilitator/settings", label: "Settings", icon: Settings }, // placeholder
];

function Item({ href, label, icon: Icon }: NavItem) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
        "hover:bg-muted",
        active && "bg-muted font-medium"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export default function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-card md:block">
      <div className="flex h-full flex-col">
        <div className="border-b px-4 py-4">
          <Link href="/facilitator" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10" />
            <div className="leading-tight">
              <div className="text-sm font-semibold">Decisionary</div>
              <div className="text-xs text-muted-foreground">Facilitator Console</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-4 p-2">
          <div>
            <div className="px-3 pb-2 text-xs font-medium text-muted-foreground">
              Facilitator
            </div>
            <div className="space-y-1">
              {facilitator.map((i) => (
                <Item key={i.href} {...i} />
              ))}
            </div>
          </div>

          <div>
            <div className="px-3 pb-2 text-xs font-medium text-muted-foreground">
              Participant
            </div>
            <div className="space-y-1">
              {participant.map((i) => (
                <Item key={i.href} {...i} />
              ))}
            </div>
          </div>

          <div>
            <div className="px-3 pb-2 text-xs font-medium text-muted-foreground">
              System
            </div>
            <div className="space-y-1">
              {secondary.map((i) => (
                <Item key={i.href} {...i} />
              ))}
            </div>
          </div>
        </nav>

        <div className="border-t p-4 text-xs text-muted-foreground">v0.1 • MVP</div>
      </div>
    </aside>
  );
}
