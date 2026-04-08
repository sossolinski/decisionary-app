// app/components/AppTopbar.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Menu } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/app/components/ui/button";
import { useRoleContext } from "@/app/components/useRoleContext";

import RoleSwitcher from "@/app/components/RoleSwitcher";
import RoleBadge from "@/app/components/RoleBadge";

function titleFromPath(pathname: string) {
  const parts = (pathname ?? "/").split("/").filter(Boolean);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  if (parts.length === 0) return { section: "Home", page: "Dashboard" };

  const section = cap(parts[0] ?? "App");
  const page = cap((parts[1] ?? "Overview").replaceAll("-", " "));
  return { section, page };
}

export default function AppTopbar({
  isMobile,
  onToggleMobileSidebar,
}: {
  isMobile?: boolean;
  onToggleMobileSidebar?: () => void;
}) {
  const pathname = usePathname();
  const t = useMemo(() => titleFromPath(pathname), [pathname]);
  const { activeOrg } = useRoleContext();

  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
    })();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--studio-border)] bg-[var(--studio-surface)] backdrop-blur-xl">
      <div className="studio-container">
        <div className="h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {isMobile && onToggleMobileSidebar ? (
              <Button
                variant="outline"
                size="icon"
                onClick={onToggleMobileSidebar}
                aria-label="Open menu"
                title="Menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
            ) : null}

            <div className="min-w-0 flex items-center gap-2">
              <Link href="/facilitator" className="font-semibold tracking-tight">
                Decisionary
              </Link>
              <span className="text-[color:var(--studio-muted2)]">•</span>
              <div className="min-w-0 flex items-center gap-2 text-sm text-[color:var(--studio-muted)]">
                <span className="truncate">{t.section}</span>
                <span className="text-[color:var(--studio-muted2)]">/</span>
                <span className="truncate">{t.page}</span>
              </div>
              {activeOrg ? (
                <>
                  <span className="text-[color:var(--studio-muted2)]">•</span>
                  <div className="hidden md:block text-xs text-[color:var(--studio-muted)] truncate max-w-[240px]">
                    org: <span className="font-medium text-foreground/90">{activeOrg.name}</span>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex items-center gap-3">
            <RoleSwitcher />
            <RoleBadge />

            <div className="relative">
              <Button
                variant="outline"
                className="min-w-[260px] justify-between"
                onClick={() => setOpen((v) => !v)}
              >
                <span className="truncate">{email ?? "Signed out"}</span>
                <ChevronDown className="h-4 w-4 opacity-70" />
              </Button>

              {open ? (
                <div
                  className="absolute right-0 mt-2 w-[260px] popover-solid rounded-[14px] shadow-soft overflow-hidden"
                  onMouseLeave={() => setOpen(false)}
                >
                  <div className="px-4 py-3 border-b border-[color:var(--studio-border)]">
                    <div className="text-xs text-[color:var(--studio-muted2)]">Account</div>
                    <div className="text-sm font-semibold truncate">{email ?? "—"}</div>
                  </div>
                  <div className="p-2">
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={async () => {
                        await supabase.auth.signOut();
                        setOpen(false);
                        window.location.href = "/login";
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
