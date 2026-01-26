"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getSessionInbox,
  subscribeInbox,
  type SessionInject,
} from "@/lib/sessions";

type Props = {
  sessionId: string;
  mode?: "inbox" | "pulse";
  selectedId: string | null;
  onSelect: (item: SessionInject) => void;

  channel?: string | null;
  severity?: string | null;
  search?: string;
};

function clampText(s: string, max = 150) {
  const clean = s.replace(/\s+/g, " ").trim();
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
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveSeen(key: string, set: Set<string>) {
  try {
    sessionStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {}
}

export default function Inbox({
  sessionId,
  mode = "inbox",
  selectedId,
  onSelect,
  channel = null,
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

  const [flashIds, setFlashIds] = useState<Set<string>>(() => new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());

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

  function buildQueryOpts(p: number) {
    if (channel) return { page: p, pageSize, channel, severity };

    if (mode === "pulse") {
      return { page: p, pageSize, channel: "pulse" as const, severity };
    }

    return { page: p, pageSize, channelNot: "pulse" as const, severity };
  }

  async function load(p = page) {
    try {
      setErr(null);
      setLoading(true);

      const opts = buildQueryOpts(p);
      const res = await getSessionInbox(sessionId, opts as any);

      const next = res.items ?? [];
      setItems(next);
      setTotal(res.total ?? 0);
      setPage(res.page ?? p);
      pageRef.current = res.page ?? p;

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
      setErr(e?.message ?? "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!sessionId) return;

    setPage(1);
    pageRef.current = 1;
    prevIdsRef.current = new Set();

    load(1);

    const unsub = subscribeInbox(sessionId, () => {
      load(pageRef.current);
    });

    return () => unsub?.();
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

  return (
    <>
      {err && (
        <div style={{ padding: 10, borderRadius: 12, background: "#fee2e2", marginBottom: 10 }}>
          {err}
        </div>
      )}

      {loading && <div style={{ padding: 10 }}>Loading…</div>}

      {!loading &&
        visible.map((item) => {
          const active = selectedId === item.id;
          const title = item.injects?.title?.trim() || "Message";
          const preview = item.injects?.body ? clampText(item.injects.body, 150) : "";
          const metaLeft =
            [item.injects?.sender_name, item.injects?.sender_org].filter(Boolean).join(" · ") ||
            "Unknown source";
          const channelTag = item.injects?.channel ? String(item.injects.channel).toUpperCase() : null;
          const sevTag = item.injects?.severity ? String(item.injects.severity).toUpperCase() : null;
          const time = fmtTime(item.delivered_at);
          const unread = !seen.has(item.id);
          const flash = flashIds.has(item.id);

          return (
            <button
              key={item.id}
              onClick={() => {
                markSeen(item.id);
                onSelect(item);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 10px",
                borderRadius: 14,
                border: active ? "1px solid rgba(0,0,0,0.28)" : "1px solid rgba(0,0,0,0.12)",
                background: active ? "rgba(0,0,0,0.04)" : "white",
                cursor: "pointer",
                marginBottom: 8,
                position: "relative",
                boxShadow: flash ? "0 0 0 3px rgba(34,197,94,0.18)" : "none",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 4 }}>
                {title}{" "}
                {unread && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 900 }}>UNREAD</span>
                )}
                {flash && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 900 }}>NEW</span>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                {channelTag && <span style={{ fontSize: 11, fontWeight: 800 }}>{channelTag}</span>}
                {sevTag && <span style={{ fontSize: 11, fontWeight: 800 }}>{sevTag}</span>}
              </div>

              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>
                {preview ? preview : "(no content)"}
              </div>

              <div style={{ fontSize: 11, opacity: 0.7 }}>
                {metaLeft} · {time}
              </div>
            </button>
          );
        })}

      {!loading && visible.length === 0 && (
        <div style={{ padding: 10, opacity: 0.7 }}>No messages matching filters.</div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>
          Page {page} / {totalPages}
        </div>

        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "white",
            cursor: page <= 1 ? "not-allowed" : "pointer",
            opacity: page <= 1 ? 0.5 : 1,
            fontWeight: 700,
          }}
        >
          {"<<"}
        </button>

        {pages.map((p) => (
          <button
            key={p}
            onClick={() => setPage(p)}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.12)",
              background: p === page ? "rgba(0,0,0,0.06)" : "white",
              fontWeight: p === page ? 900 : 700,
              cursor: "pointer",
            }}
          >
            {p}
          </button>
        ))}

        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "white",
            cursor: page >= totalPages ? "not-allowed" : "pointer",
            opacity: page >= totalPages ? 0.5 : 1,
            fontWeight: 700,
          }}
        >
          {">>"}
        </button>
      </div>
    </>
  );
}
