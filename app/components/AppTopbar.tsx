// app/components/AppTopbar.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Search,
  Menu,
  ChevronDown,
  User,
  Settings,
  LogOut,
} from "lucide-react";

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
  const p = pathname ?? "";

  const m1 = p.match(/^\/sessions\/([0-9a-f-]{36})(?:\/|$)/i);
  if (m1?.[1]) return m1[1];

  const m2 = p.match(/^\/facilitator\/sessions\/([0-9a-f-]{36})(?:\/|$)/i);
  if (m2?.[1]) return m2[1];

  return null;
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function homeHrefFromPath(pathname: string) {
  const p = pathname ?? "";
  if (p.startsWith("/facilitator")) return "/facilitator";
  if (p.startsWith("/participant")) return "/participant";
  // if you're in /sessions/[id] (participant-ish), prefer participant home
  if (p.startsWith("/sessions/")) return "/participant";
  return "/login";
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
  const homeHref = useMemo(() => homeHrefFromPath(pathname), [pathname]);

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
    <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur">
      {/* full-width container (no mx-auto / max-w) */}
      <div className="flex h-14 w-full items-center gap-3 px-4">
        {isMobile ? (
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className={iconBtn}
            title="Menu"
            aria-label="Menu"
          >
            <Menu className="h-4 w-4" />
          </button>
        ) : null}

        <div className="flex min-w-0 items-center gap-3">
          {/* clickable brand -> role home */}
          <Link
            href={homeHref}
            className="text-sm font-semibold tracking-tight hover:opacity-90 transition"
            title="Go to home"
          >
            Decisionary
          </Link>

          <div className="hidden md:block text-xs text-muted-foreground">
            {sessionId
              ? `Session: ${shortId(sessionId)}`
              : `${t.section} / ${t.page}`}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button type="button" className={iconBtn} title="Search" aria-label="Search">
            <Search className="h-4 w-4" />
          </button>

          <button
            type="button"
            className={iconBtn}
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>

          <div className="relative" ref={wrapRef}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={accountBtn}
              aria-haspopup="menu"
              aria-expanded={open}
              title="Account"
            >
              <span className="max-w-[180px] truncate">
                {email ? email : "Account"}
              </span>
              <ChevronDown className="h-4 w-4 opacity-70" />
            </button>

            {open && (
              <div
                className="absolute right-0 mt-2 w-64 overflow-hidden rounded-[var(--radius)] border border-border shadow-lg"
                role="menu"
                // force fully-opaque popover background (no “see-through”)
                style={{ backgroundColor: "hsl(var(--popover) / 1)" }}
              >
                <div className="px-3 py-2 border-b border-border">
                  <div className="text-xs text-muted-foreground">Signed in as</div>
                  <div className="text-sm font-medium truncate">{email ?? "—"}</div>
                </div>

                <button
                  type="button"
                  className={menuItem}
                  onClick={() => setOpen(false)}
                >
                  <User className="h-4 w-4" />
                  Profile
                </button>

                <button
                  type="button"
                  className={menuItem}
                  onClick={() => setOpen(false)}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>

                <div className="border-t border-border" />

                <button type="button" className={menuItem} onClick={logout}>
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* mobile subtitle */}
      <div className="md:hidden px-4 pb-2 text-xs text-muted-foreground">
        {sessionId ? `Session: ${shortId(sessionId)}` : `${t.section} / ${t.page}`}
      </div>
    </header>
  );
}
