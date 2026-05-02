"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { getSessionInbox, subscribeInbox, type SessionInject } from "@/lib/sessions";
import useAutoRefresh from "@/app/components/useAutoRefresh";
import { Button } from "@/app/components/ui/button";
import { Mail, Radio, Circle, AlertCircle, AlertTriangle, Flame } from "lucide-react";

function errMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

type Props = {
  sessionId: string;
  mode?: "inbox" | "pulse";
  selectedId: string | null;
  onSelect: (item: SessionInject) => void;
  channel?: string | null;
  severity?: string | null;
  search?: string;
  autoSelectFirst?: boolean;
};

function clampText(s: string, max = 150) {
  const clean = (s ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1) + "…";
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function fmtTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function rangePages(totalPages: number, current: number) {
  if (totalPages <= 4) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const start = Math.max(1, Math.min(current - 1, totalPages - 3));
  return [start, start + 1, start + 2, start + 3];
}

function makeSeenKey(sessionId: string, mode: string, channel: string | null, severity: string | null) {
  return `seen:${sessionId}:${mode}:${channel ?? "all"}:${severity ?? "all"}`;
}

function loadSeen(key: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x) => typeof x === "string") as string[]);
  } catch {
    return new Set();
  }
}

function saveSeen(key: string, set: Set<string>) {
  try {
    sessionStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {}
}

function channelIcon(channel?: string | null) {
  const v = String(channel ?? "").toLowerCase();
  if (v === "pulse") return <Radio className="h-3.5 w-3.5" />;
  return <Mail className="h-3.5 w-3.5" />;
}

function severityIcon(sev?: string | null) {
  const v = String(sev ?? "").toLowerCase();
  if (v === "critical") return <Flame className="h-3.5 w-3.5" />;
  if (v === "high") return <AlertTriangle className="h-3.5 w-3.5" />;
  if (v === "medium") return <AlertCircle className="h-3.5 w-3.5" />;
  if (v === "low") return <Circle className="h-3.5 w-3.5" />;
  return <Circle className="h-3.5 w-3.5 opacity-60" />;
}

function badge(kind: "severity" | "channel" | "state", value: string) {
  const base =
    "inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-bold tracking-wide";
  const v = value.toLowerCase();

  if (kind === "state") {
    if (v === "unread") return `${base} bg-background text-foreground`;
    if (v === "new") return `${base} bg-primary/10 text-primary`;
    return `${base} bg-secondary/60 text-foreground`;
  }

  if (kind === "severity") {
    if (v === "critical") return `${base} bg-destructive/10 text-destructive`;
    if (v === "high") return `${base} bg-orange-500/10 text-orange-700 dark:text-orange-300`;
    if (v === "medium") return `${base} bg-yellow-500/10 text-yellow-700 dark:text-yellow-300`;
    if (v === "low") return `${base} bg-emerald-500/10 text-emerald-700 dark:text-emerald-300`;
    return `${base} bg-secondary/60 text-foreground`;
  }

  // channel
  if (v === "pulse") return `${base} bg-purple-500/10 text-purple-700 dark:text-purple-300`;
  if (v === "ops") return `${base} bg-primary/10 text-primary`;
  if (v === "media") return `${base} bg-sky-500/10 text-sky-700 dark:text-sky-300`;
  if (v === "social") return `${base} bg-emerald-500/10 text-emerald-700 dark:text-emerald-300`;
  return `${base} bg-secondary/60 text-foreground`;
}

function emphasisClass(severity: string, flash: boolean) {
  if (!flash) return "";
  if (severity === "critical") return "bg-red-500/[0.045]";
  if (severity === "high") return "bg-orange-500/[0.045]";
  return "bg-primary/[0.04]";
}

export default function Inbox({
  sessionId,
  mode = "inbox",
  selectedId,
  onSelect,
  channel = null,
  severity = null,
  search = "",
  autoSelectFirst = true,
}: Props) {
  const pageSize = 8;

  const [items, setItems] = useState<SessionInject[]>([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const pageRef = useRef(1);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // NEW flash
  const [flashIds, setFlashIds] = useState<Set<string>>(() => new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());

  // UNREAD
  const seenKey = useMemo(() => makeSeenKey(sessionId, mode, channel, severity), [sessionId, mode, channel, severity]);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSeen(loadSeen(seenKey));
  }, [seenKey]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pages = rangePages(totalPages, page);

  // anti-load-storm guards
  const inFlightRef = useRef(false);
  const pendingReloadRef = useRef(false);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buildQueryOpts(p: number): Parameters<typeof getSessionInbox>[1] {
    if (channel) return { page: p, pageSize, channel, severity, search };
    if (mode === "pulse") {
      return { page: p, pageSize, channel: "pulse" as const, severity, search };
    }
    return { page: p, pageSize, channelNot: "pulse" as const, severity, search };
  }

  async function load(p = page, opts?: { silent?: boolean }) {
    if (!sessionId) return;

    if (inFlightRef.current) {
      pendingReloadRef.current = true;
      return;
    }

    inFlightRef.current = true;

    try {
      setErr(null);
      if (!opts?.silent) setLoading(true);

      const queryOpts = buildQueryOpts(p);
      const res = await getSessionInbox(sessionId, queryOpts);

      const next = res.items ?? [];
      setItems(next);
      setTotal(res.total ?? 0);

      const nextPage = res.page ?? p;
      setPage(nextPage);
      pageRef.current = nextPage;

      // flash NEW (diff current list vs previous)
      const prev = prevIdsRef.current;
      const nextIds = new Set(next.map((x) => x.id));
      const added: string[] = [];

      nextIds.forEach((id) => {
        if (!prev.has(id)) added.push(id);
      });

      prevIdsRef.current = nextIds;

      if (added.length) {
        setFlashIds((old) => {
          const merged = new Set(old);
          added.forEach((id) => merged.add(id));
          return merged;
        });

        window.setTimeout(() => {
          setFlashIds((old) => {
            const copy = new Set(old);
            added.forEach((id) => copy.delete(id));
            return copy;
          });
        }, 2500);
      }
    } catch (e: unknown) {
      setErr(errMessage(e, "Failed to load inbox"));
    } finally {
      if (!opts?.silent) setLoading(false);
      inFlightRef.current = false;

      if (pendingReloadRef.current) {
        pendingReloadRef.current = false;
        load(pageRef.current, { silent: true });
      }
    }
  }

  function requestReload() {
    if (reloadTimerRef.current) return;
    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null;
      load(pageRef.current, { silent: true });
    }, 250);
  }

  useEffect(() => {
    if (!sessionId) return;

    setPage(1);
    pageRef.current = 1;
    prevIdsRef.current = new Set();

    pendingReloadRef.current = false;
    inFlightRef.current = false;

    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = null;
    }

    load(1);

    const unsub = subscribeInbox(sessionId, () => {
      requestReload();
    });

    return () => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, mode, channel, severity]);

  useEffect(() => {
    if (!sessionId) return;
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    if (!sessionId) return;
    setPage(1);
    pageRef.current = 1;
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useAutoRefresh(
    () => {
      if (!sessionId) return;
      requestReload();
    },
    {
      enabled: Boolean(sessionId),
      intervalMs: 8000,
    }
  );

  const visible = useMemo(() => items, [items]);
  const hasActiveFilters = Boolean(search.trim() || channel || severity);

  function markSeen(id: string) {
    setSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveSeen(seenKey, next);
      return next;
    });
  }

  // Auto-open first available item (keep selection valid)
  useEffect(() => {
    if (!autoSelectFirst) return;
    if (loading) return;
    if (!visible.length) return;

    const ids = new Set(visible.map((x) => x.id));
    if (selectedId && ids.has(selectedId)) return;

    markSeen(visible[0].id);
    onSelect(visible[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelectFirst, loading, visible, selectedId]);

  return (
    <div className="space-y-2">
      {err ? <div className="notice notice-error p-3 text-xs font-semibold">{err}</div> : null}

      <div className="overflow-hidden">
        <div className="max-h-[68vh] overflow-auto pr-2">
          {loading ? (
            <div className="ui-subtle-panel p-3 text-xs font-semibold text-muted-foreground">
              Loading…
            </div>
          ) : null}

          {!loading && visible.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-4 py-5">
              <div className="text-sm font-semibold text-foreground">
                {hasActiveFilters ? "No inbox updates match the current filters." : "No inbox updates yet."}
              </div>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">
                {hasActiveFilters
                  ? "Clear the filters or search to see the full list again."
                  : "Updates will appear here once the session starts moving."}
              </div>
            </div>
          ) : null}

          {!loading &&
            visible.map((item) => {
              const active = selectedId === item.id;

              const title = item.injects?.title?.trim() || "Message";
              const preview = item.injects?.body ? clampText(item.injects.body, 118) : "";
              const availableMedia = (item.injects?.media ?? []).filter((media) => Boolean(media.signed_url));
              const firstMedia = availableMedia[0] ?? null;
              const remainingMediaCount = Math.max(0, availableMedia.length - 1);

              const metaLeft =
                [item.injects?.sender_name, item.injects?.sender_org].filter(Boolean).join(" · ") ||
                "Unknown source";

              const sevTag = item.injects?.severity ? String(item.injects.severity).toUpperCase() : null;

              const time = fmtTime(item.delivered_at);

              const unread = !seen.has(item.id);
              const flash = flashIds.has(item.id);

              const ch = String(item.injects?.channel ?? "").toLowerCase();
              const sv = String(item.injects?.severity ?? "").toLowerCase();

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    markSeen(item.id);
                    onSelect(item);
                  }}
                  className={[
                    "mb-2 w-full text-left rounded-[11px] border border-transparent px-3 py-2.5 transition-all last:mb-0",
                    "outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0",
                    active
                      ? "bg-card shadow-[inset_3px_0_0_hsl(var(--primary)/0.55)]"
                      : [
                          "bg-card/72",
                          emphasisClass(sv, flash),
                          "hover:bg-card/95",
                        ].join(" "),
                    flash ? "shadow-[0_0_0_2px_hsl(var(--primary)/0.08)]" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex items-start gap-3">
                      <div
                        className={[
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px]",
                          active
                            ? "bg-primary/10 text-primary"
                            : "bg-secondary/55 text-[color:var(--studio-muted2)]",
                        ].join(" ")}
                      >
                        {channelIcon(ch || "inbox")}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {unread ? (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                          ) : null}
                          <div className="truncate text-sm font-semibold text-[color:var(--studio-ink)]">
                            {title}
                          </div>
                        </div>

                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          {unread && !flash ? (
                            <span className={badge("state", "unread")}>Unread</span>
                          ) : null}
                          {flash ? (
                            <span className={badge("state", "new")}>
                              <Radio className="h-3.5 w-3.5" />
                              New
                            </span>
                          ) : null}
                          {sevTag ? (
                            <span className={badge("severity", sevTag)}>
                              {severityIcon(sv)}
                              {titleCase(sevTag)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 pt-0.5 text-[11px] font-medium text-muted-foreground">
                      {time}
                    </div>
                  </div>

                  <div className="mt-2 flex gap-2.5">
                    {firstMedia?.signed_url ? (
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[9px] bg-secondary/55">
                        <img
                          src={firstMedia.signed_url}
                          alt={firstMedia.alt_text ?? title}
                          className="h-full w-full object-cover"
                        />
                        {remainingMediaCount > 0 ? (
                          <div className="absolute bottom-1 right-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            +{remainingMediaCount}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="min-w-0 text-[13px] leading-5 text-[color:var(--studio-muted)]">
                      {preview ? preview : "(no content)"}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-muted-foreground">
                    {metaLeft}
                    {item.injects?.requires_decision ? (
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--studio-ink)]">
                        Decision needed
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <div className="text-xs font-medium text-muted-foreground">
          Page {page} / {totalPages}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Prev
          </Button>

          {pages.map((p) => (
            <Button key={p} variant={p === page ? "secondary" : "ghost"} size="sm" onClick={() => setPage(p)}>
              {p}
            </Button>
          ))}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
