"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, Search } from "lucide-react";

function titleFromPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  if (parts.length === 0) return { section: "Home", page: "Dashboard" };

  const section = cap(parts[0] ?? "App");
  const page = cap((parts[1] ?? "Overview").replaceAll("-", " "));
  return { section, page };
}

export default function AppTopbar() {
  const pathname = usePathname();
  const t = useMemo(() => titleFromPath(pathname), [pathname]);

  return (
    <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:px-6">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">
            {t            {t            {t            {       <div className="truncate text-sm font-semibold">{t.page}</div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              className="h-9 w-72 rounded-2xl border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Search…"
            />
          </div>

          <button
            type="button"
                                   h-9                                 rounded-2xl border bg-background hover:bg-muted"
            aria-l        tifications"
          >
            <Bell className="h-4 w-4" />
          </button>
          </button>
assName="h-4 w-4" />
                              rounded-2xlit                              rounded-2ou                              rounded-2xlit             Account
          </Link>
        </div>
      </div>
    </header>
  );
}
