"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Search, ChevronDown, User, Settings, LogOut, Mail } from "lucide-react";
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
  // /sessions/:id
  const m = (pathname ?? "").match(/^\/sessions\/([0-9a-f-]{36})(?:\/|$)/i);
  return m?.[1] ?? null;
}

function shortId(id: string) {
  return id.slice(0, 8);
}

export default function AppTopbar() {
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
    [
      "inline-flex h-9 items-center gap-2",
      "rounded-[var(--radius)]",
      "border border-border",
      "bg-card",
      "px-3 text-sm font-medium text-foreground",
      "hover:bg-secondary",
      "transition",
      "focus-visible:shadow-[var(--studio-ring)] focus-visible:outline-none",
    ].join(" ");

  const menuItem =
    "flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary transition text-left";
  const menuItemMuted =
    "flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary transition text-left";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Full width + consistent padding */}
      <div className="flex h-14 w-full items-center justify-between px-4">
        <div className="min-w-0">
          {/* LEFT TITLE */}
          <div className="truncate text-sm font-semibold text-foreground">
            Decisionary
          </div>

          {/* LEFT SUBTITLE */}
          <div className="truncate text-xs font-semibold text-muted-foreground">
            {sessionId ? `Session: ${shortId(sessionId)}` : `${t.section} / ${t.page}`}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" className={iconBtn} title="Search" aria-label="Search">
            <Search size={18} />
          </button>

          <button type="button" className={iconBtn} title="Notifications" aria-label="Notifications">
            <Bell size={18} />
          </button>

          <div ref={wrapRef} className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={accountBtn}
              aria-haspopup="menu"
              aria-expanded={open}
              title="Account"
            >
              <Mail size={16} className="text-muted-foreground" />
              <span className="max-w-[240px] truncate">{email ? email : "Account"}</span>
              <ChevronDown size={16} className="text-muted-foreground" />
            </button>

            {open && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 overflow-hidden rounded-[var(--radius)] border border-border bg-popover shadow-soft"
              >
                <div className="px-3 py-2">
                  <div className="text-xs text-muted-foreground">Signed in as</div>
                  <div className="truncate text-sm font-medium text-foreground">{email ?? "—"}</div>
                </div>

                <div className="h-px bg-border" />

                <button type="button" onClick={() => setOpen(false)} className={menuItem} role="menuitem">
                  <User size={16} className="text-muted-foreground" />
                  Profile
                </button>

                <button type="button" onClick={() => setOpen(false)} className={menuItem} role="menuitem">
                  <Settings size={16} className="text-muted-foreground" />
                  Settings
                </button>

                <button type="button" onClick={logout} className={menuItem} role="menuitem">
                  <LogOut size={16} className="text-muted-foreground" />
                  Log out
                </button>

                <div className="h-px bg-border" />

                <Link href="/login" onClick={() => setOpen(false)} className={menuItemMuted} role="menuitem">
                  <Mail size={16} />
                  Go to login
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
