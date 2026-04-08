// app/components/AppTopbar.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Menu } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/app/components/ui/button";
import { useRoleContext } from "@/app/components/useRoleContext";

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
  const { activeOrg, role, activeRole, isDisabled, isPermAdmin } = useRoleContext();

  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
    })();
  }, []);

  useEffect(() => {
    if (!open) return;

    function onDocMouseDown(e: MouseEvent) {
      const root = accountMenuRef.current;
      if (!root) return;
      if (e.target instanceof Node && !root.contains(e.target)) {
        setOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--studio-border)] bg-[var(--studio-surface)] backdrop-blur-xl">
      <div className="studio-container">
        <div className="h-14 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
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

            <div className="min-w-0 flex items-center gap-3">
              <Link href="/facilitator" className="shrink-0 font-semibold tracking-tight">
                Decisionary
              </Link>
              <div className="hidden md:flex min-w-0 items-center gap-2 text-sm text-[color:var(--studio-muted)]">
                <span className="text-[color:var(--studio-muted2)]">/</span>
                <span className="truncate">{t.section}</span>
                <span className="text-[color:var(--studio-muted2)]">/</span>
                <span className="truncate">{t.page}</span>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex items-center gap-2">
            <div className="relative z-30" ref={accountMenuRef}>
              <Button
                variant="outline"
                className="min-w-[220px] max-w-[260px] justify-between rounded-[14px] bg-[var(--studio-surface2)]"
                onClick={() => setOpen((v) => !v)}
              >
                <span className="truncate">{email ?? "Signed out"}</span>
                <ChevronDown className="h-4 w-4 opacity-70" />
              </Button>

              {open ? (
                <div className="absolute right-0 z-50 mt-2 w-[260px] popover-solid rounded-[14px] shadow-soft overflow-hidden">
                  <div className="px-4 py-3 border-b border-[color:var(--studio-border)]">
                    <div className="text-xs text-[color:var(--studio-muted2)]">Account</div>
                    <div className="text-sm font-semibold truncate">{email ?? "—"}</div>
                    <div className="mt-2 space-y-1 text-xs text-[color:var(--studio-muted2)]">
                      <div>
                        Role <b className="text-foreground">{activeRole ?? "—"}</b>
                      </div>
                      <div>
                        Access <b className="text-foreground">{role ?? "—"}</b>
                      </div>
                      {activeOrg ? (
                        <div className="truncate">
                          Org <b className="text-foreground">{activeOrg.name}</b>
                        </div>
                      ) : null}
                      {isPermAdmin ? (
                        <div>Role switching is available from the sidebar.</div>
                      ) : null}
                      {isDisabled ? <div className="text-red-500">Account disabled</div> : null}
                    </div>
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
