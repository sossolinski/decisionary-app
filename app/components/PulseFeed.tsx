"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSessionPulse, subscribePulse, type SessionInject } from "@/lib/sessions";
import { Button } from "@/app/components/ui/button";

type Props = {
  sessionId: string;
  selectedId: string | null;
  onSelect: (item: SessionInject) => void;

  severity?: string | null;
  search?: string;
};

function clampText(s: string, max = 160) {
  const clean = (s ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1) + "…";
}

function fmtTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
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
    if (!raw) return new Set<string>();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set<string>();
    return new Set<string>(arr.filter((x) => typeof x === "string") as string[]);
  } catch {
    return new Set<string>();
  }
}

function saveSeen(key: string, set: Set<string>) {
  try {
    sessionStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {}
}

export default function PulseFeed({
  sessionId,
  selectedId,
  onSelect,
  severity = null,
  search = "",
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
  const seenKey = useMemo(() => makeSeenKey(sessionId, severity), [sessionId, severity]);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setSeen(loadSeen(seenKey));
  }, [seenKey]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pages = rangePages(totalPages, page);

  // =========================
  // anti-load-storm guards
  // =========================
  const inFlightRef = useRef(false);
  const pendingReloadRef = useRef(false);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load(p = page) {
    if (!sessionId) return;

    // if a load is already running, just mark pending and exit
    if (inFlightRef.current) {
      pendingReloadRef.current = true;
      return;
    }

    inFlightRef.current = true;

    try {
      setErr(null);
      setLoading(true);

      const res = await getSessionPulse(sessionId, { page: p, pageSize, severity });
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
        }, 3000);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load pulse");
    } finally {
      setLoading(false);
      inFlightRef.current = false;

      // if something requested reload during the load, run exactly once
      if (pendingReloadRef.current) {
        pendingReloadRef.current = false;
        load(pageRef.current);
      }
    }
  }

  function requestReload() {
    // coalesce multiple realtime events to one reload
    if (reloadTimerRef.current) return;

    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null;
      load(pageRef.current);
    }, 250);
  }

  useEffect(() => {
    if (!sessionId) return;

    // reset state on filter/session change
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

  return (
    <div className="space-y-2">
      {err ? <div className="text-sm text-destructive">{err}</div> : null}
      {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : null}

      {!loading &&
        visible.map((item) => {
          const active = selectedId === item.id;

          const title = item.injects?.title?.trim() || "Pulse post";
          const preview = item.injects?.body ? clampText(item.injects.body, 160) : "";
          const metaLeft =
            [item.injects?.sender_name, item.injects?.sender_org].filter(Boolean).join(" · ") ||
            "Unknown source";

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
                "w-full text-left rounded-[var(--radius)] border px-3 py-3 transition",
                active ? "border-foreground/30 bg-muted/40" : "border-border bg-card hover:bg-muted/30",
                flash ? "shadow-soft ring-2 ring-foreground/10" : "",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {title}{" "}
                    {unread ? (
                      <span className="ml-2 rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        UNREAD
                      </span>
                    ) : null}
                    {flash ? (
                      <span className="ml-2 rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        NEW
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-1 flex flex-wrap gap-1">
                    {channelTag ? (
                      <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-semibold">
                        {channelTag}
                      </span>
                    ) : null}
                    {sevTag ? (
                      <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-semibold">
                        {sevTag}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="shrink-0 text-[10px] font-semibold text-muted-foreground">
                  {time}
                </div>
              </div>

              <div className="mt-2 text-xs text-muted-foreground">
                {preview ? preview : "(no content)"}
              </div>

              <div className="mt-2 text-[10px] font-semibold text-muted-foreground">
                {metaLeft}
              </div>
            </button>
          );
        })}

      {!loading && visible.length === 0 ? (
        <div className="text-sm text-muted-foreground">No pulse items matching filters.</div>
      ) : null}

      {/* Pagination */}
      <div className="mt-2 flex items-center justify-between gap-2">
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
            {"<<"}
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
            {">>"}
          </Button>
        </div>
      </div>
    </div>
  );
}
