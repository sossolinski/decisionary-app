"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Search, Menu, Mail, ChevronDown, User, Settings, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

function titleFromPath(pathname: string) {
  const parts = (pathname ?? "/").split("/").filter(Boolean);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (parts.length === 0) return { section: "Home", page: "Dashboard" };
  const section = cap(parts[0] ?? "App");
  const page = cap((parts[1] ?? "Overview").replaceAll("-", " "));
  return { section, page };
}

function getSessionIdFromPath(pathname: string) {
  const m = (pathname ?? "").match(/^\/sessions\/([0-9a-f-]{36})(?:\/|$)/i);
  return m?.[1] ?? null;
}

function shortId(id: string) {
  return id.slice(0, 8);
}

export default function AppTopbar({
  isMobile,
  onToggleMobileSidebar,
}: {
  isMobile: boolean;
  onToggleMobileSidebar: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const t = useMemo(() => titleFromPath(pathname), [pathname]);
  const sessionId = useMemo(() => getSessionIdFromPath(pathname), [pathname]);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;
      if (error) return setEmail(null);
      setEmail(data.user?.email ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!open) return;
      const el = wrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function logout() {
    try {
      await supabase.auth.signOut();
    } finally {
      setOpen(false);
      router.replace("/login");
    }
  }

  const iconBtn =
    "inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius)] border border-border bg-card text-foreground " +
    "hover:bg-secondary transition focus-visible:shadow-[var(--studio-ring)] focus-visible:outline-none";

  const accountBtn =
    "inline-flex h-9 items-center gap-2 rounded-[var(--radius)] border border-border bg-card px-3 text-sm font-medium " +
    "text-foreground hover:bg-secondary transition focus-visible:shadow-[var(--studio-ring)] focus-visible:outline-none";

  const menuItem =
    "flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary transition text-left";

  return (
    <div className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          {isMobile ? (
            <button className={iconBtn} onClick={onToggleMobileSidebar} aria-label="Open menu">
              <Menu className="h-4 w-4" />
            </button>
          ) : null}

          <div className="leading-tight">
            <div className="text-sm font-semibold">Decisionary</div>
            <div className="text-xs text-muted-foreground">
              {sessionId ? `Session: ${shortId(sessionId)}` : `${t.section} / ${t.page}`}
            </div>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <button className={iconBtn} aria-label="Search">
            <Search className="h-4 w-4" />
          </button>
          <button className={iconBtn} aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </button>
          <button className={iconBtn} aria-label="Inbox">
            <Mail className="h-4 w-4" />
          </button>

          <div className="relative" ref={wrapRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              className={accountBtn}
              aria-haspopup="menu"
              aria-expanded={open}
              title="Account"
            >
              <span className="max-w-[220px] truncate">{email ? email : "Account"}</span>
              <ChevronDown className="h-4 w-4 opacity-70" />
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-[var(--radius)] border border-border popover-solid shadow-lg">
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Signed in as <div className="truncate font-medium text-foreground">{email ?? "—"}</div>
                </div>
                <div className="h-px bg-border" />
                <button className={menuItem} onClick={() => setOpen(false)}>
                  <User className="h-4 w-4" /> Profile
                </button>
                <button className={menuItem} onClick={() => setOpen(false)}>
                  <Settings className="h-4 w-4" /> Settings
                </button>
                <div className="h-px bg-border" />
                <button className={menuItem} onClick={logout}>
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
