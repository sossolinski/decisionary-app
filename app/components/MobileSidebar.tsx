"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/app/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/app/components/ui/sheet";

type NavItem = { href: string; label: string };

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Facilitator",
    items: [
      { href: "/facilitator", label: "Overview" },
      { href: "/facilitator/scenarios", label: "Scenarios" },
      { href: "/facilitator/sessions", label: "Sessions" },
    ],
  },
  {
    title: "Participant",
    items: [{ href: "/participant", label: "Participant" }],
  },
  {
    title: "System",
    items: [{ href: "/facilitator/settings", label: "Settings" }],
  },
];

export default function MobileSidebar() {
  const pathname = usePathname();

  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="rounded-2xl">
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>

        <SheetContent side="left" className="w-80 p-0">
          <div className="border-b px-5 py-4">
            <Link href="/facilitator" className="block">
              <div className="text-sm font-semibold">Decisionary</div>
              <div className="text-xs text-muted-foreground">
                Facilitator Console
              </div>
            </Link>
          </div>

          <nav className="space-y-5 p-4">
            {sections.map((s) => (
              <div key={s.title}>
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  {s.title}
                </div>
                <div className="space-y-1">
                  {s.items.map((i) => {
                    const active =
                      pathname === i.href || pathname.startsWith(i.href + "/");
                    return (
                      <Link
                        key={i.href}
                        href={i.href}
                        className={cn(
                          "block rounded-xl px-3 py-2 text-sm transition",
                          "hover:bg-muted",
                          active && "bg-muted font-medium"
                        )}
                      >
                        {i.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t p-4 text-xs text-muted-foreground">
            v0.1 • MVP
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
