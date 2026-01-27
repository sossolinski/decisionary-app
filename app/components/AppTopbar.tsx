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

export default function AppTopbar() {
  const router = useRouter();
  const pathname = usePathname();
  const t = useMemo(() => titleFromPath(pathname), [pathname]);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [email, setEmail] = useState<string | null>(null);

  // Load current user (email) and keep it updated
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;
      if (error) {
        // optional: keep silent, UI will just not show email
        setEmail(null);
        return;
      }
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

  // Close menu on outside click + ESC
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

  return (
    <header
      className={[
        "sticky top-0 z-30",
        "border-b border-[color:var(--studio-border)]",
        "bg-[color:var(--studio-surface)] backdrop-blur-xl",
        "shadow-[var(--studio-shadow)]",
      ].join(" ")}
      style={{ WebkitBackdropFilter: "blur(16px)" }}
    >
      <div className="mx-auto flex h-14 max-w-[var(--studio-max)] items-center gap-3 px-4 md:px-6">
        {/* Left: breadcrumb / context */}
        <div className="min-w-0 flex-1">
          <div className="text-xs text-[color:var(--studio-muted2)]">
            <span className="font-medium text-[color:var(--studio-muted)]">{t.section}</span>
            <span className="px-1">/</span>
            <span className="text-[color:var(--studio-muted2)]">{t.page}</span>
          </div>

          <div className="truncate text-sm font-semibold text-[color:var(--studio-text)]">
            {pathname}
          </div>
        </div>

        {/* Right: actions */}
        <div className="hidden items-center gap-2 md:flex">
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[color:var(--studio-muted2)]" />
            <input
              className={[
                "h-9 w-72",
                "rounded-[var(--studio-radius)]",
                "border border-[color:var(--studio-border)]",
                "bg-[color:var(--studio-surface2)]",
                "pl-9 pr-3 text-sm text-[color:var(--studio-text)]",
                "placeholder:text-[color:var(--studio-muted2)]",
                "outline-none",
                "focus-visible:shadow-[var(--studio-ring)]",
                "transition-[box-shadow,background-color,border-color] duration-200",
              ].join(" ")}
              placeholder="Search…"
            />
          </div>

          {/* Notifications */}
          <button
            type="button"
            className={[
              "inline-flex h-9 w-9 items-center justify-center",
              "rounded-[var(--studio-radius)]",
              "border border-[color:var(--studio-border)]",
              "bg-[color:var(--studio-surface2)]",
              "text-[color:var(--studio-text)]",
              "hover:bg-[color:var(--studio-surface2)]/80",
              "transition",
              "focus-visible:shadow-[var(--studio-ring)]",
            ].join(" ")}
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>

          {/* Account dropdown */}
          <div className="relative" ref={wrapRef}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={[
                "inline-flex h-9 items-center gap-2",
                "rounded-[var(--studio-radius)]",
                "border border-[color:var(--studio-border)]",
                "bg-[color:var(--studio-surface2)]",
                "px-3 text-sm font-medium text-[color:var(--studio-text)]",
                "hover:bg-[color:var(--studio-surface2)]/80",
                "transition",
                "focus-visible:shadow-[var(--studio-ring)]",
              ].join(" ")}
              aria-haspopup="menu"
              aria-expanded={open}
              title="Account"
            >
              <span className="max-w-[140px] truncate">
                {email ? email : "Account"}
              </span>
              <ChevronDown className="h-4 w-4 opacity-70" />
            </button>

            {open && (
              <div
                role="menu"
                className={[
                  "absolute right-0 mt-2 w-72 overflow-hidden",
                  "rounded-2xl",
                  "border border-[color:var(--studio-border)]",
                  "bg-[color:var(--studio-surface2)]",
                  "shadow-[var(--studio-shadow2)]",
                ].join(" ")}
              >
                <div className="px-3 py-2">
                  <div className="text-xs text-[color:var(--studio-muted2)]">Signed in as</div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-[color:var(--studio-text)]">
                    <Mail className="h-4 w-4 opacity-70" />
                    <span className="truncate">{email ?? "—"}</span>
                  </div>
                </div>

                <div className="h-px bg-[color:var(--studio-border)]" />

                <Link
                  href="/facilitator"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-black/5 transition"
                >
                  <User className="h-4 w-4 opacity-70" />
                  Profile
                </Link>

                <Link
                  href="/facilitator/settings"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-black/5 transition"
                >
                  <Settings className="h-4 w-4 opacity-70" />
                  Settings
                </Link>

                <div className="h-px bg-[color:var(--studio-border)]" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={logout}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-black/5 transition"
                >
                  <LogOut className="h-4 w-4 opacity-70" />
                  Log out
                </button>

                <div className="h-px bg-[color:var(--studio-border)]" />

                <Link
                  href="/login"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[color:var(--studio-muted)] hover:bg-black/5 transition"
                >
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
