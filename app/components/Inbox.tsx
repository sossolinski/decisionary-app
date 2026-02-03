"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getSessionInbox,
  subscribeInbox,
  type SessionInject,
} from "@/lib/sessions";
import { Button } from "@/app/components/ui/button";

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

function makeSeenKey(
  sessionId: string,
  mode: string,
  channel: string | null,
  severity: string | null
) {
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

function badge(kind: "severity" | "channel" | "state", value: string) {
  const base =
    "inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-bold tracking-wide";
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
  const pageSize = 5;

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
  const seenKey = useMemo(
    () => makeSeenKey(sessionId, mode, channel, severity),
    [sessionId, mode, channel, severity]
  );
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

  function buildQueryOpts(p: number) {
    if (channel) return { page: p, pageSize, channel, severity };
    if (mode === "pulse") {
      return { page: p, pageSize, channel: "pulse" as const, severity };
    }
    return { page: p, pageSize, channelNot: "pulse" as const, severity };
  }

  async function load(p = page) {
    if (!sessionId) return;

    if (inFlightRef.current) {
      pendingReloadRef.current = true;
      return;
    }

    inFlightRef.current = true;

    try {
      setErr(null);
      setLoading(true);

      const opts = buildQueryOpts(p);
      const res = await getSessionInbox(sessionId, opts as any);

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
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load inbox");
    } finally {
      setLoading(false);
      inFlightRef.current = false;

      if (pendingReloadRef.current) {
        pendingReloadRef.current = false;
        load(pageRef.current);
      }
    }
  }

  function requestReload() {
    if (reloadTimerRef.current) return;
    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null;
      load(pageRef.current);
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

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const t = it.injects?.title ?? "";
      const b = it.injects?.body ?? "";
      const s1 = it.injects?.sender_name ?? "";
      const s2 = it.injects?.sender_org ?? "";
      return `${t}\n${b}\n${s1}\n${s2}`.toLowerCase().includes(q);
    });
  }, [items, search]);

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
      {err ? (
        <div className="rounded-[var(--radius)] border border-border bg-destructive/5 p-3 text-xs font-semibold text-destructive">
          {err}
        </div>
      ) : null}

      {/* Container: stable height + scroll inside (mail-client feel) */}
      <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-sm">
        <div className="max-h-[65vh] overflow-auto p-2">
          {loading ? (
            <div className="rounded-[var(--radius)] border border-border bg-secondary/20 p-3 text-xs font-semibold text-muted-foreground">
              Loading…
            </div>
          ) : null}

          {!loading && visible.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-border bg-secondary/20 p-3 text-xs font-semibold text-muted-foreground">
              No messages matching filters.
            </div>
          ) : null}

          {!loading &&
            visible.map((item) => {
              const active = selectedId === item.id;

              const title = item.injects?.title?.trim() || "Message";
              const preview = item.injects?.body ? clampText(item.injects.body, 150) : "";

              const metaLeft =
                [item.injects?.sender_name, item.injects?.sender_org]
                  .filter(Boolean)
                  .join(" · ") || "Unknown source";

              const channelTag = item.injects?.channel
                ? String(item.injects.channel).toUpperCase()
                : null;
              const sevTag = item.injects?.severity
                ? String(item.injects.severity).toUpperCase()
                : null;

              const time = fmtTime(item.delivered_at);

              const unread = !seen.has(item.id);
              const flash = flashIds.has(item.id);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    markSeen(item.id);
                    onSelect(item);
                  }}
                  className={[
                    "w-full text-left rounded-[var(--radius)] border px-3 py-3 transition-colors",
                    "focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]",
                    active
                      ? "border-foreground/25 bg-secondary/70"
                      : "border-border bg-card hover:bg-secondary/40",
                    flash ? "shadow-soft ring-2 ring-foreground/10" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{title}</div>

                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {unread ? <span className={badge("state", "unread")}>UNREAD</span> : null}
                        {flash ? <span className={badge("state", "new")}>NEW</span> : null}
                        {channelTag ? (
                          <span className={badge("channel", channelTag)}>{channelTag}</span>
                        ) : null}
                        {sevTag ? (
                          <span className={badge("severity", sevTag)}>{sevTag}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                      {time}
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground">
                    {preview ? preview : "(no content)"}
                  </div>

                  <div className="mt-2 text-[11px] font-semibold text-muted-foreground">
                    {metaLeft}
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="text-xs font-semibold text-muted-foreground">
          Page {page} / {totalPages}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Prev
          </Button>

          {pages.map((p) => (
            <Button
              key={p}
              variant={p === page ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPage(p)}
            >
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
