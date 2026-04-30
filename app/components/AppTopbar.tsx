// app/components/AppTopbar.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  GitBranch,
  Keyboard,
  LogOut,
  Menu,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/app/components/ui/button";
import HintTooltip from "@/app/components/HintTooltip";
import { useRoleContext } from "@/app/components/useRoleContext";
import {
  applyLanguagePreference,
  applyThemePreference,
  readLanguagePreference,
  readNotificationPreference,
  readThemePreference,
  saveLanguagePreference,
  saveThemePreference,
  type LanguagePreference,
  type ThemePreference,
} from "@/lib/clientPreferences";
import {
  formatNotificationTime,
  getSessionIdFromPath,
  hideNotifications,
  listNotificationCenterItems,
  markNotificationCenterSeen,
  notificationIsUnread,
  readHiddenNotificationIds,
  readNotificationCenterSeenAt,
  type AppNotification,
} from "@/lib/notifications";

type NotificationFilter = "all" | "unread" | "important" | "session" | "system" | "product";

function titleFromPath(pathname: string) {
  const parts = (pathname ?? "/").split("/").filter(Boolean);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const isUuid = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
  const shortId = (s: string) => s.slice(0, 8);

  if (parts.length === 0) return { section: "Home", page: "Dashboard" };

  if (parts[0] === "sessions" && parts[1] && isUuid(parts[1])) {
    return { section: "Sessions", page: shortId(parts[1]) };
  }

  if (parts[0] === "facilitator" && parts[1] === "sessions" && parts[2] && isUuid(parts[2])) {
    return { section: "Sessions", page: shortId(parts[2]) };
  }

  const section = cap(parts[0] ?? "App");
  const page = cap((parts[1] ?? "Overview").replaceAll("-", " "));
  return { section, page };
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

function navigateTo(path: string) {
  if (typeof window === "undefined") return;
  if (window.location.pathname === path) return;
  window.location.href = path;
}

function workspaceHomePath(pathname: string, activeRole: "admin" | "facilitator" | "participant" | null) {
  const path = pathname ?? "/";

  if (path.startsWith("/admin")) return "/admin";
  if (path.startsWith("/participant")) return "/participant";
  if (path.startsWith("/facilitator") || path.startsWith("/sessions/")) return "/facilitator";

  if (activeRole === "admin") return "/admin";
  if (activeRole === "participant") return "/participant";
  return "/facilitator";
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
  const { isDisabled, activeRole } = useRoleContext();
  const brandHref = useMemo(
    () => workspaceHomePath(pathname ?? "/", activeRole),
    [activeRole, pathname]
  );

  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>("auto");
  const [language, setLanguage] = useState<LanguagePreference>("en");
  const [sessionNotifications, setSessionNotifications] = useState<AppNotification[]>([]);
  const [systemNotifications, setSystemNotifications] = useState<AppNotification[]>([]);
  const [productNotifications, setProductNotifications] = useState<AppNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [notificationSeenAt, setNotificationSeenAt] = useState(0);
  const [notificationsVersion, setNotificationsVersion] = useState(0);
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>("all");
  const [hiddenNotificationIds, setHiddenNotificationIds] = useState<string[]>([]);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const shortcutsDialogRef = useRef<HTMLDivElement | null>(null);
  const preferencesHydratedRef = useRef(false);
  const pendingGoToRef = useRef<number | null>(null);
  const notificationsDebounceRef = useRef<number | null>(null);
  const accountMenuId = "app-topbar-account-menu";
  const notificationsMenuId = "app-topbar-notifications-menu";
  const shortcutsDialogId = "app-topbar-shortcuts-dialog";
  const languageFieldId = "app-topbar-language-field";
  const themeFieldId = "app-topbar-theme-field";

  const allNotifications = useMemo(
    () => [...sessionNotifications, ...systemNotifications, ...productNotifications].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [productNotifications, sessionNotifications, systemNotifications]
  );
  const visibleNotifications = useMemo(
    () => allNotifications.filter((item) => !hiddenNotificationIds.includes(item.id)),
    [allNotifications, hiddenNotificationIds]
  );
  const unreadCount = useMemo(
    () => visibleNotifications.filter((item) => notificationIsUnread(item, notificationSeenAt)).length,
    [notificationSeenAt, visibleNotifications]
  );
  const visibleSessionNotifications = useMemo(
    () => sessionNotifications.filter((item) => !hiddenNotificationIds.includes(item.id)),
    [hiddenNotificationIds, sessionNotifications]
  );
  const visibleSystemNotifications = useMemo(
    () => systemNotifications.filter((item) => !hiddenNotificationIds.includes(item.id)),
    [hiddenNotificationIds, systemNotifications]
  );
  const visibleProductNotifications = useMemo(
    () => productNotifications.filter((item) => !hiddenNotificationIds.includes(item.id)),
    [hiddenNotificationIds, productNotifications]
  );
  const filteredSessionNotifications = useMemo(
    () =>
      visibleSessionNotifications.filter((item) => {
        if (notificationFilter === "unread") return notificationIsUnread(item, notificationSeenAt);
        if (notificationFilter === "important") return item.priority === "important";
        return true;
      }),
    [notificationFilter, notificationSeenAt, visibleSessionNotifications]
  );
  const filteredSystemNotifications = useMemo(
    () =>
      visibleSystemNotifications.filter((item) => {
        if (notificationFilter === "unread") return notificationIsUnread(item, notificationSeenAt);
        if (notificationFilter === "important") return item.priority === "important";
        return true;
      }),
    [notificationFilter, notificationSeenAt, visibleSystemNotifications]
  );
  const filteredProductNotifications = useMemo(
    () =>
      visibleProductNotifications.filter((item) => {
        if (notificationFilter === "unread") return notificationIsUnread(item, notificationSeenAt);
        if (notificationFilter === "important") return item.priority === "important";
        return true;
      }),
    [notificationFilter, notificationSeenAt, visibleProductNotifications]
  );
  const readVisibleNotificationIds = useMemo(
    () =>
      visibleNotifications
        .filter((item) => !notificationIsUnread(item, notificationSeenAt))
        .map((item) => item.id),
    [notificationSeenAt, visibleNotifications]
  );

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? null);
    })();

    const nextTheme = readThemePreference();
    const nextLanguage = readLanguagePreference();
    setNotificationSeenAt(readNotificationCenterSeenAt());
    setHiddenNotificationIds(readHiddenNotificationIds());
    setTheme(nextTheme);
    setLanguage(nextLanguage);
    applyThemePreference(nextTheme);
    applyLanguagePreference(nextLanguage);
    preferencesHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!preferencesHydratedRef.current) return;

    applyThemePreference(theme);
    saveThemePreference(theme);

    if (theme !== "auto") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemePreference("auto");
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, [theme]);

  useEffect(() => {
    if (!preferencesHydratedRef.current) return;

    applyLanguagePreference(language);
    saveLanguagePreference(language);
  }, [language]);

  useEffect(() => {
    if (!open && !shortcutsOpen && !notificationsOpen) return;

    function onDocMouseDown(e: MouseEvent) {
      const accountRoot = accountMenuRef.current;
      const notificationsRoot = notificationsRef.current;
      const shortcutsRoot = shortcutsDialogRef.current;
      if (
        open &&
        accountRoot &&
        e.target instanceof Node &&
        !accountRoot.contains(e.target)
      ) {
        setOpen(false);
      }
      if (
        notificationsOpen &&
        notificationsRoot &&
        e.target instanceof Node &&
        !notificationsRoot.contains(e.target)
      ) {
        setNotificationsOpen(false);
      }
      if (
        shortcutsOpen &&
        shortcutsRoot &&
        e.target instanceof Node &&
        !shortcutsRoot.contains(e.target)
      ) {
        setShortcutsOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setNotificationsOpen(false);
        setShortcutsOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, notificationsOpen, shortcutsOpen]);

  useEffect(() => {
    if (!userId) return;
    const resolvedUserId = userId;

    let alive = true;

    async function refreshNotifications() {
      setNotificationsLoading(true);
      setNotificationsError(null);
      try {
        const prefs = readNotificationPreference();
        const { sessionItems, systemItems, productItems } = await listNotificationCenterItems({
          userId: resolvedUserId,
          pathname,
        });
        if (!alive) return;
        setSessionNotifications(prefs.exerciseAlerts ? sessionItems : []);
        setSystemNotifications(prefs.rosterChanges ? systemItems : []);
        setProductNotifications(prefs.productUpdates ? productItems : []);
      } catch (error) {
        if (!alive) return;
        setNotificationsError(error instanceof Error ? error.message : "Failed to load notifications.");
      } finally {
        if (alive) setNotificationsLoading(false);
      }
    }

    refreshNotifications();
    const interval = window.setInterval(refreshNotifications, 45000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [userId, pathname, notificationsVersion]);

  useEffect(() => {
    if (!userId) return;

    const sessionId = getSessionIdFromPath(pathname);
    const channels: Array<ReturnType<typeof supabase.channel>> = [];

    function queueRefresh() {
      if (notificationsDebounceRef.current !== null) {
        window.clearTimeout(notificationsDebounceRef.current);
      }
      notificationsDebounceRef.current = window.setTimeout(() => {
        notificationsDebounceRef.current = null;
        setNotificationsVersion((value) => value + 1);
      }, 250);
    }

    const participantChannel = supabase
      .channel(`notifications:participants:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_participants",
          filter: `user_id=eq.${userId}`,
        },
        () => queueRefresh()
      )
      .subscribe();
    channels.push(participantChannel);

    const assignmentsChannel = supabase
      .channel(`notifications:roles:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_role_assignments",
          filter: `user_id=eq.${userId}`,
        },
        () => queueRefresh()
      )
      .subscribe();
    channels.push(assignmentsChannel);

    if (sessionId) {
      const sessionChannel = supabase
        .channel(`notifications:session:${sessionId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "session_injects",
            filter: `session_id=eq.${sessionId}`,
          },
          () => queueRefresh()
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "session_consequences",
            filter: `session_id=eq.${sessionId}`,
          },
          () => queueRefresh()
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "session_tasks",
            filter: `session_id=eq.${sessionId}`,
          },
          () => queueRefresh()
        )
        .subscribe();
      channels.push(sessionChannel);
    }

    return () => {
      if (notificationsDebounceRef.current !== null) {
        window.clearTimeout(notificationsDebounceRef.current);
        notificationsDebounceRef.current = null;
      }

      for (const channel of channels) {
        try {
          supabase.removeChannel(channel);
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [pathname, userId]);

  useEffect(() => {
    if (!notificationsOpen) return;
    markNotificationCenterSeen();
    setNotificationSeenAt(readNotificationCenterSeenAt());
  }, [notificationsOpen]);

  function notificationTone(item: AppNotification) {
    switch (item.kind) {
      case "overdue_task":
        return "border-amber-500/30 bg-amber-500/10";
      case "session_development":
        return "border-sky-500/25 bg-sky-500/10";
      case "system_notice":
        return "border-violet-500/25 bg-violet-500/10";
      case "session_assignment":
      case "role_assignment":
        return "border-emerald-500/25 bg-emerald-500/10";
      case "product_update":
        return "border-fuchsia-500/25 bg-fuchsia-500/10";
      default:
        return "border-primary/25 bg-primary/10";
    }
  }

  function notificationLabel(item: AppNotification) {
    switch (item.kind) {
      case "overdue_task":
        return "Runtime";
      case "session_development":
        return "Development";
      case "session_update":
        return "Update";
      case "system_notice":
        return "System";
      case "session_assignment":
      case "role_assignment":
        return "Access";
      case "product_update":
        return "Product";
      default:
        return "Notice";
    }
  }

  function notificationIcon(item: AppNotification) {
    switch (item.kind) {
      case "overdue_task":
        return <AlertTriangle className="h-4 w-4" />;
      case "session_development":
        return <GitBranch className="h-4 w-4" />;
      case "system_notice":
        return <Bell className="h-4 w-4" />;
      case "session_assignment":
      case "role_assignment":
        return <ShieldCheck className="h-4 w-4" />;
      case "product_update":
        return <Sparkles className="h-4 w-4" />;
      default:
        return <Radio className="h-4 w-4" />;
    }
  }

  function notificationIconTone(item: AppNotification) {
    switch (item.kind) {
      case "overdue_task":
        return "border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-300";
      case "session_development":
        return "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300";
      case "system_notice":
        return "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300";
      case "session_assignment":
      case "role_assignment":
        return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
      case "product_update":
        return "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300";
      default:
        return "border-primary/25 bg-primary/10 text-primary";
    }
  }

  function handleMarkAllAsRead() {
    markNotificationCenterSeen();
    setNotificationSeenAt(readNotificationCenterSeenAt());
  }

  function handleClearRead() {
    if (readVisibleNotificationIds.length === 0) return;
    hideNotifications(readVisibleNotificationIds);
    setHiddenNotificationIds(readHiddenNotificationIds());
  }

  function handleDismissNotification(id: string) {
    hideNotifications([id]);
    setHiddenNotificationIds(readHiddenNotificationIds());
  }

  function showSessionSection() {
    return notificationFilter === "all" || notificationFilter === "unread" || notificationFilter === "important" || notificationFilter === "session";
  }

  function showSystemSection() {
    return notificationFilter === "all" || notificationFilter === "unread" || notificationFilter === "important" || notificationFilter === "system";
  }

  function showProductSection() {
    return notificationFilter === "all" || notificationFilter === "unread" || notificationFilter === "important" || notificationFilter === "product";
  }

  useEffect(() => {
    function onOpenShortcuts() {
      setOpen(false);
      setShortcutsOpen(true);
    }

    window.addEventListener("decisionary:open-shortcuts", onOpenShortcuts);
    return () => window.removeEventListener("decisionary:open-shortcuts", onOpenShortcuts);
  }, []);

  useEffect(() => {
    function clearPendingGoTo() {
      if (pendingGoToRef.current !== null) {
        window.clearTimeout(pendingGoToRef.current);
        pendingGoToRef.current = null;
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShortcutsOpen(true);
        setOpen(false);
        clearPendingGoTo();
        return;
      }

      if (pendingGoToRef.current !== null) {
        const key = e.key.toLowerCase();
        const destinations: Record<string, string> = {
          o: "/facilitator",
          s: "/facilitator/sessions",
          c: "/facilitator/scenarios",
          p: "/settings",
        };

        if (destinations[key]) {
          e.preventDefault();
          clearPendingGoTo();
          setOpen(false);
          setShortcutsOpen(false);
          navigateTo(destinations[key]);
          return;
        }

        clearPendingGoTo();
      }

      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "g") {
        pendingGoToRef.current = window.setTimeout(() => {
          pendingGoToRef.current = null;
        }, 1200);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      clearPendingGoTo();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--studio-border)] bg-[var(--studio-surface)] backdrop-blur-xl">
      <div className="w-full px-4 md:px-6">
        <div className="h-14 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3 md:pl-1">
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
              <Link href={brandHref} className="shrink-0 font-semibold tracking-tight">
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
          <div className="flex items-center gap-2 md:pr-1">
            <div className="relative z-30" ref={notificationsRef}>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setOpen(false);
                  setShortcutsOpen(false);
                  setNotificationsOpen((value) => !value);
                }}
                aria-haspopup="dialog"
                aria-expanded={notificationsOpen}
                aria-controls={notificationsMenuId}
                aria-label="Open notifications"
                title="Notifications"
                className="relative rounded-[14px] bg-[var(--studio-surface2)]"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </Button>

              {notificationsOpen ? (
                <div
                  id={notificationsMenuId}
                  role="dialog"
                  aria-label="Notifications"
                  className="absolute right-0 z-50 mt-2 w-[456px] max-w-[92vw] popover-solid rounded-[16px] shadow-soft overflow-hidden"
                >
                  <div className="border-b border-[color:var(--studio-border)] px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          Notifications
                          <HintTooltip
                            text="A shared feed for live session alerts, access changes, and product notices."
                            side="bottom"
                          />
                        </div>
                        <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
                          {unreadCount} unread
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          markNotificationCenterSeen();
                          setNotificationSeenAt(readNotificationCenterSeenAt());
                          setNotificationsOpen(false);
                        }}
                      >
                        Close
                      </Button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleMarkAllAsRead}
                        disabled={unreadCount === 0}
                      >
                        Mark all as read
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearRead}
                        disabled={readVisibleNotificationIds.length === 0}
                      >
                        Clear read
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-[70vh] overflow-auto p-3 space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {[
                        { key: "all", label: "All" },
                        { key: "unread", label: "Unread" },
                        { key: "important", label: "Important" },
                        { key: "session", label: "Session" },
                        { key: "system", label: "System" },
                        { key: "product", label: "Product" },
                      ].map((filter) => (
                        <Button
                          key={filter.key}
                          type="button"
                          variant={notificationFilter === filter.key ? "default" : "outline"}
                          size="sm"
                          onClick={() => setNotificationFilter(filter.key as NotificationFilter)}
                          aria-pressed={notificationFilter === filter.key}
                          className="rounded-full"
                        >
                          {filter.label}
                        </Button>
                      ))}
                    </div>

                    {notificationsLoading ? (
                      <div className="rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 py-3 text-sm text-[color:var(--studio-muted)]">
                        Loading notifications…
                      </div>
                    ) : null}

                    {notificationsError ? (
                      <div className="notice notice-error text-sm">{notificationsError}</div>
                    ) : null}

                    {!notificationsLoading &&
                    !notificationsError &&
                    filteredSessionNotifications.length === 0 &&
                    filteredSystemNotifications.length === 0 &&
                    filteredProductNotifications.length === 0 ? (
                      <div className="rounded-[var(--radius)] border border-dashed border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 py-4 text-sm text-[color:var(--studio-muted)]">
                        Nothing new in this view right now.
                      </div>
                    ) : null}

                    {showSessionSection() && filteredSessionNotifications.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
                            Session
                          </div>
                          <div className="text-[11px] text-[color:var(--studio-muted2)]">
                            Live updates and runtime work
                          </div>
                        </div>
                        {filteredSessionNotifications.map((item) => {
                          const unread = notificationIsUnread(item, notificationSeenAt);
                          return (
                            <Link
                              key={item.id}
                              href={item.href}
                              onClick={() => setNotificationsOpen(false)}
                              className={[
                                "block rounded-[14px] border px-3 py-3 transition",
                                unread
                                  ? notificationTone(item)
                                  : "border-[var(--studio-border)] bg-[var(--studio-surface2)] hover:bg-[var(--studio-surface)]",
                              ].join(" ")}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 gap-3">
                                  <div
                                    className={[
                                      "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                                      notificationIconTone(item),
                                    ].join(" ")}
                                  >
                                    {notificationIcon(item)}
                                  </div>
                                  <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-sm font-semibold text-foreground">{item.title}</div>
                                    <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
                                      {notificationLabel(item)}
                                    </span>
                                    {item.priority === "important" ? (
                                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
                                        Important
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-1 text-sm text-[color:var(--studio-muted)]">{item.body}</div>
                                </div>
                                </div>
                                <div className="flex shrink-0 items-start gap-2">
                                  <div className="text-[11px] text-[color:var(--studio-muted2)]">
                                    {formatNotificationTime(item.at)}
                                  </div>
                                  <button
                                    type="button"
                                    className="rounded-full p-1 text-[color:var(--studio-muted2)] transition hover:bg-[var(--studio-surface)] hover:text-foreground"
                                    aria-label={`Dismiss ${item.title}`}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      handleDismissNotification(item.id);
                                    }}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}

                    {showSystemSection() && filteredSystemNotifications.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
                            System
                          </div>
                          <div className="text-[11px] text-[color:var(--studio-muted2)]">
                            Access and assignment changes
                          </div>
                        </div>
                        {filteredSystemNotifications.map((item) => {
                          const unread = notificationIsUnread(item, notificationSeenAt);
                          return (
                            <Link
                              key={item.id}
                              href={item.href}
                              onClick={() => setNotificationsOpen(false)}
                              className={[
                                "block rounded-[14px] border px-3 py-3 transition",
                                unread
                                  ? notificationTone(item)
                                  : "border-[var(--studio-border)] bg-[var(--studio-surface2)] hover:bg-[var(--studio-surface)]",
                              ].join(" ")}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 gap-3">
                                  <div
                                    className={[
                                      "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                                      notificationIconTone(item),
                                    ].join(" ")}
                                  >
                                    {notificationIcon(item)}
                                  </div>
                                  <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-sm font-semibold text-foreground">{item.title}</div>
                                    <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
                                      {notificationLabel(item)}
                                    </span>
                                    {item.priority === "important" ? (
                                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
                                        Important
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-1 text-sm text-[color:var(--studio-muted)]">{item.body}</div>
                                </div>
                                </div>
                                <div className="flex shrink-0 items-start gap-2">
                                  <div className="text-[11px] text-[color:var(--studio-muted2)]">
                                    {formatNotificationTime(item.at)}
                                  </div>
                                  <button
                                    type="button"
                                    className="rounded-full p-1 text-[color:var(--studio-muted2)] transition hover:bg-[var(--studio-surface)] hover:text-foreground"
                                    aria-label={`Dismiss ${item.title}`}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      handleDismissNotification(item.id);
                                    }}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}

                    {showProductSection() && filteredProductNotifications.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
                            Product
                          </div>
                          <div className="text-[11px] text-[color:var(--studio-muted2)]">
                            Platform news and improvements
                          </div>
                        </div>
                        {filteredProductNotifications.map((item) => {
                          const unread = notificationIsUnread(item, notificationSeenAt);
                          return (
                            <Link
                              key={item.id}
                              href={item.href}
                              onClick={() => setNotificationsOpen(false)}
                              className={[
                                "block rounded-[14px] border px-3 py-3 transition",
                                unread
                                  ? notificationTone(item)
                                  : "border-[var(--studio-border)] bg-[var(--studio-surface2)] hover:bg-[var(--studio-surface)]",
                              ].join(" ")}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 gap-3">
                                  <div
                                    className={[
                                      "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                                      notificationIconTone(item),
                                    ].join(" ")}
                                  >
                                    {notificationIcon(item)}
                                  </div>
                                  <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-sm font-semibold text-foreground">{item.title}</div>
                                    <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
                                      {notificationLabel(item)}
                                    </span>
                                    {item.priority === "important" ? (
                                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
                                        Important
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-1 text-sm text-[color:var(--studio-muted)]">{item.body}</div>
                                </div>
                                </div>
                                <div className="flex shrink-0 items-start gap-2">
                                  <div className="text-[11px] text-[color:var(--studio-muted2)]">
                                    {formatNotificationTime(item.at)}
                                  </div>
                                  <button
                                    type="button"
                                    className="rounded-full p-1 text-[color:var(--studio-muted2)] transition hover:bg-[var(--studio-surface)] hover:text-foreground"
                                    aria-label={`Dismiss ${item.title}`}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      handleDismissNotification(item.id);
                                    }}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="relative z-30" ref={accountMenuRef}>
              <Button
                variant="outline"
                className="min-w-[220px] max-w-[260px] justify-between rounded-[14px] bg-[var(--studio-surface2)]"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={accountMenuId}
              >
                <span className="truncate">{email ?? "Signed out"}</span>
                <ChevronDown className="h-4 w-4 opacity-70" />
              </Button>

              {open ? (
                <div
                  id={accountMenuId}
                  role="dialog"
                  aria-label="Account menu"
                  className="absolute right-0 z-50 mt-2 w-[304px] popover-solid rounded-[16px] shadow-soft overflow-hidden"
                >
                  <div className="border-b border-[color:var(--studio-border)] px-5 py-4">
                    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
                      Account
                    </div>
                    <div className="text-sm font-semibold truncate">{email ?? "—"}</div>
                    {isDisabled ? (
                      <div className="mt-2 text-xs text-destructive">Account disabled</div>
                    ) : null}
                  </div>
                  <div className="border-b border-[color:var(--studio-border)] px-5 py-4 space-y-5">
                    <div>
                      <label
                        htmlFor={languageFieldId}
                        className="mb-2 block text-xs font-medium text-[color:var(--studio-muted)]"
                      >
                        Language
                      </label>
                      <select
                        id={languageFieldId}
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as LanguagePreference)}
                        className="h-10 w-full rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 text-sm"
                      >
                        <option value="en">English</option>
                        <option value="pl">Polski</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor={themeFieldId}
                        className="mb-2 block text-xs font-medium text-[color:var(--studio-muted)]"
                      >
                        Theme
                      </label>
                      <select
                        id={themeFieldId}
                        value={theme}
                        onChange={(e) => setTheme(e.target.value as ThemePreference)}
                        className="h-10 w-full rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 text-sm"
                      >
                        <option value="auto">Auto</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                      </select>
                    </div>
                  </div>
                  <div className="p-3 space-y-1.5">
                    <Button
                      variant="ghost"
                      className="w-full justify-start rounded-[12px] px-3"
                      onClick={() => {
                        setOpen(false);
                        setShortcutsOpen(true);
                      }}
                    >
                      <Keyboard className="h-4 w-4" />
                      Keyboard shortcuts
                    </Button>
                    <Button asChild variant="ghost" className="w-full justify-start rounded-[12px] px-3">
                      <Link href="/settings" onClick={() => setOpen(false)}>
                        <Settings className="h-4 w-4" />
                        Profile settings
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start rounded-[12px] px-3"
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

      {shortcutsOpen ? (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]">
          <div className="flex min-h-full items-start justify-center px-4 pt-20">
            <div
              ref={shortcutsDialogRef}
              id={shortcutsDialogId}
              role="dialog"
              aria-modal="true"
              aria-label="Keyboard shortcuts"
              className="surface-solid w-full max-w-xl rounded-[18px] shadow-soft overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-[color:var(--studio-border)] px-5 py-4">
                <div>
                  <div className="text-base font-semibold">Keyboard shortcuts</div>
                  <div className="text-sm text-[color:var(--studio-muted)]">
                    Global shortcuts that work outside text fields.
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShortcutsOpen(false)}
                  aria-label="Close keyboard shortcuts"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 px-5 py-5">
                {[
                  { keys: "Ctrl/Cmd + K", action: "Open this shortcuts panel" },
                  { keys: "g then o", action: "Go to overview" },
                  { keys: "g then s", action: "Go to sessions" },
                  { keys: "g then c", action: "Go to scenarios" },
                  { keys: "g then p", action: "Go to profile settings" },
                  { keys: "Esc", action: "Close menus, sheets, and this panel" },
                ].map((shortcut) => (
                  <div
                    key={shortcut.keys}
                    className="flex items-center justify-between gap-4 rounded-[var(--radius)] border border-[var(--studio-border)] bg-[hsl(var(--card))] px-4 py-3"
                  >
                    <div className="text-sm text-[color:var(--studio-muted)]">{shortcut.action}</div>
                    <kbd className="rounded-md border border-[var(--studio-border-strong)] bg-[hsl(var(--background))] px-2 py-1 text-xs font-semibold text-foreground shadow-sm">
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
