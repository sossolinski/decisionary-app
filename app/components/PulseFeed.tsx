"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { getSessionPulse, subscribePulse, type SessionInject } from "@/lib/sessions";
import useAutoRefresh from "@/app/components/useAutoRefresh";
import { Button } from "@/app/components/ui/button";
import { decisionPressureLabel } from "@/app/components/session-runtime/sessionRuntimeUi";
import { Radio, Circle, AlertCircle, AlertTriangle, Flame } from "lucide-react";

function errMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

type Props = {
  sessionId: string;
  selectedId: string | null;
  onSelect: (item: SessionInject) => void;

  severity?: string | null;
  search?: string;
  autoSelectFirst?: boolean;
};

function clampText(s: string, max = 160) {
  const clean = (s ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1) + "…";
}

function initials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "PU";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "PU";
}

function pseudoHandle(senderName?: string | null, senderOrg?: string | null) {
  const base = senderOrg?.trim() || senderName?.trim() || "pulse";
  return `@${base.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20) || "pulse"}`;
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

function makeSeenKey(sessionId: string, severity: string | null) {
  return `seen:${sessionId}:pulse:${severity ?? "all"}`;
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

function severityIcon(sev?: string | null) {
  const v = String(sev ?? "").toLowerCase();
  if (v === "critical") return <Flame className="h-3.5 w-3.5" />;
  if (v === "high") return <AlertTriangle className="h-3.5 w-3.5" />;
  if (v === "medium") return <AlertCircle className="h-3.5 w-3.5" />;
  if (v === "low") return <Circle className="h-3.5 w-3.5" />;
  return <Circle className="h-3.5 w-3.5 opacity-60" />;
}

function badge(kind: "state" | "severity", value: string) {
  const base =
    "inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-bold tracking-wide";
  const pressureBase =
    "inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-bold tracking-wide";
  const v = value.toLowerCase();

  if (kind === "state") {
    if (v === "unread") return `${base} bg-background text-foreground`;
    if (v === "new") return `${base} bg-primary/10 text-primary`;
    return `${base} bg-secondary/60 text-foreground`;
  }

  if (v === "critical") return `${pressureBase} border-red-500/40 bg-red-500/12 text-red-700 dark:text-red-300`;
  if (v === "high") return `${pressureBase} border-orange-500/40 bg-orange-500/12 text-orange-800 dark:text-orange-300`;
  if (v === "medium") return `${pressureBase} border-yellow-500/40 bg-yellow-500/12 text-yellow-800 dark:text-yellow-300`;
  if (v === "low") return `${pressureBase} border-emerald-500/35 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300`;
  return `${pressureBase} border-[var(--studio-border)] bg-secondary/60 text-foreground`;
}

function emphasisClass(severity: string, unread: boolean) {
  if (severity === "critical") {
    return unread
      ? "bg-red-500/[0.055]"
      : "bg-red-500/[0.04]";
  }
  if (severity === "high") {
    return unread
      ? "bg-orange-500/[0.05]"
      : "bg-orange-500/[0.035]";
  }
  return unread ? "bg-primary/[0.035]" : "";
}

export default function PulseFeed({
  sessionId,
  selectedId,
  onSelect,
  severity = null,
  search = "",
  autoSelectFirst = true,
}: Props) {
  const pageSize = 7;

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
  const seenKey = useMemo(() => makeSeenKey(sessionId, severity), [sessionId, severity]);
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

      const res = await getSessionPulse(sessionId, { page: p, pageSize, severity, search });
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
      setErr(errMessage(e, "Failed to load pulse"));
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

    const unsub = subscribePulse(sessionId, () => {
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
  }, [sessionId, severity]);

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
  const hasActiveFilters = Boolean(search.trim() || severity);

  function markSeen(id: string) {
    setSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveSeen(seenKey, next);
      return next;
    });
  }

  // Auto-open first available item (and keep selection valid when filters/pages change)
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
            <div className="rounded-[8px] border border-dashed border-[var(--studio-border)] bg-[hsl(var(--background))] px-4 py-5">
              <div className="text-sm font-semibold text-foreground">
                {hasActiveFilters ? "No pulse items match the current filters." : "No pulse items yet."}
              </div>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">
                {hasActiveFilters
                  ? "Clear the filters or search to return to the full pulse stream."
                  : "Pulse becomes useful when the exercise introduces claims, rumor pressure, or public-facing information that needs confirm or dismiss handling."}
              </div>
            </div>
          ) : null}

          {!loading &&
            visible.map((item) => {
              const active = selectedId === item.id;

              const title = item.injects?.title?.trim() || "Pulse post";
              const preview = item.injects?.body ? clampText(item.injects.body, 122) : "";
              const availableMedia = (item.injects?.media ?? []).filter((media) => Boolean(media.signed_url));
              const firstMedia = availableMedia[0] ?? null;
              const remainingMediaCount = Math.max(0, availableMedia.length - 1);

              const senderName = item.injects?.sender_name?.trim() || item.injects?.sender_org?.trim() || "Pulse source";
              const senderOrg = item.injects?.sender_org?.trim() || null;
              const handle = pseudoHandle(item.injects?.sender_name, item.injects?.sender_org);

              const pressure = item.injects?.severity ? String(item.injects.severity) : null;
              const sv = String(item.injects?.severity ?? "").toLowerCase();

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
                    "mb-2 w-full rounded-[8px] border px-3 py-2.5 text-left transition-all last:mb-0",
                    "outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0",
                    active
                      ? "border-primary/30 bg-primary/[0.055] shadow-[inset_3px_0_0_hsl(var(--primary)/0.65)]"
                      : [
                          "border-[var(--studio-border)] bg-[hsl(var(--background))]",
                          emphasisClass(sv, unread),
                          "hover:border-[var(--studio-border-strong)] hover:bg-[hsl(var(--card))]",
                        ].join(" "),
                    flash ? "shadow-[0_0_0_2px_hsl(var(--primary)/0.08)]" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex items-start gap-3">
                      <div
                        className={[
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[10px] font-bold",
                          active
                            ? "bg-primary/10 text-primary"
                            : "bg-secondary/55 text-[color:var(--studio-muted)]",
                        ].join(" ")}
                      >
                        {initials(senderName)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <div className="truncate text-sm font-semibold text-[color:var(--studio-ink)]">
                            {senderName}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{handle}</div>
                          {senderOrg && senderOrg !== senderName ? (
                            <div className="text-[11px] text-muted-foreground">· {senderOrg}</div>
                          ) : null}
                        </div>

                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-0.5 font-semibold uppercase tracking-wide">
                            <Radio className="h-3 w-3" />
                            Pulse
                          </span>
                          {unread && !flash ? <span className={badge("state", "unread")}>Unread</span> : null}
                          {flash ? (
                            <span className={badge("state", "new")}>
                              <Radio className="h-3.5 w-3.5" />
                              New
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 pt-0.5 text-[11px] font-medium text-muted-foreground">{time}</div>
                  </div>

                  <div className="mt-2 flex gap-2.5">
                    {firstMedia?.signed_url ? (
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[8px] bg-secondary/55">
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

                    <div className="min-w-0">
                      <div className="text-sm font-semibold leading-5 text-[color:var(--studio-ink)]">
                        {title}
                      </div>
                      <div className="mt-1 text-[13px] leading-5 text-[color:var(--studio-muted)]">
                        {preview || "No post body."}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-muted-foreground">
                    <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="truncate">{senderOrg ? `Source: ${senderOrg}` : "Source: pulse stream"}</span>
                      {pressure ? (
                        <span className={badge("severity", pressure)}>
                          {severityIcon(sv)}
                          {decisionPressureLabel(pressure)}
                        </span>
                      ) : null}
                    </span>
                    <span>{firstMedia ? `${availableMedia.length} image${availableMedia.length === 1 ? "" : "s"}` : "Text post"}</span>
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
