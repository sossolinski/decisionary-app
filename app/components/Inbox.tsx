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
  if (totalPages <= 4)
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  const start = Math.max(1, Math.min(current - 1, totalPages - 3));
  return [start, start + 1, start + 2, start + 3];
}

export default function Inbox({
  sessionId,
  mode = "inbox",
  selectedId,
  onSelect,
  channel = null,
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pages = rangePages(totalPages, page);

  function buildQueryOpts(p: number) {
    // Jeśli channel jest podany, to traktujemy go jako filtr nadrzędny
    if (channel) {
      return { page: p, pageSize, channel };
    }

    // Domyślnie:
    // - inbox = wszystko poza pulse
    // - pulse = tylko pulse
    if (mode === "pulse") {
      return { page: p, pageSize, channel: "pulse" as const };
    }

    return { page: p, pageSize, channelNot: "pulse" as const };
  }

  async function load(p = page) {
    try {
      setErr(null);
      setLoading(true);

      const opts = buildQueryOpts(p);
      const res = await getSessionInbox(sessionId, opts);

      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
      setPage(res.page ?? p);
      pageRef.current = res.page ?? p;
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }

  // Reset page on mode/channel/session changes, and subscribe realtime
  useEffect(() => {
    if (!sessionId) return;

    setPage(1);
    pageRef.current = 1;
    load(1);

    const unsub = subscribeInbox(sessionId, () => {
      // ✅ nie skacz na 1 — odśwież bieżącą stronę
      load(pageRef.current);
    });

    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, mode, channel]);

  // Load when page changes
  useEffect(() => {
    if (!sessionId) return;
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const visible = useMemo(() => items, [items]);

  return (
    <div>
      {err && (
        <div style={{ color: "#b91c1c", marginBottom: 8 }}>
          {err}
        </div>
      )}

      {loading && <div>Loading…</div>}

      {!loading &&
        visible.map((item) => {
          const active = selectedId === item.id;
          const title = item.injects?.title?.trim() || "Message";
          const preview = item.injects?.body ? clampText(item.injects.body, 150) : "";
          const metaLeft =
            [item.injects?.sender_name, item.injects?.sender_org]
              .filter(Boolean)
              .join(" · ") || "Unknown source";

          const metaRightParts = [
            item.injects?.channel ? String(item.injects.channel).toUpperCase() : null,
            item.injects?.severity ? String(item.injects.severity).toUpperCase() : null,
          ].filter(Boolean) as string[];

          const time = fmtTime(item.delivered_at);

          return (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 10px",
                borderRadius: 14,
                border: active
                  ? "1px solid rgba(0,0,0,0.28)"
                  : "1px solid rgba(0,0,0,0.12)",
                background: active ? "rgba(0,0,0,0.04)" : "white",
                cursor: "pointer",
                marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 800 }}>{title}</div>
                {metaRightParts.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {metaRightParts.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: 12,
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: "1px solid rgba(0,0,0,0.12)",
                          opacity: 0.85,
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 6, opacity: 0.85 }}>
                {preview ? preview : <span style={{ opacity: 0.7 }}>(no content)</span>}
              </div>

              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7, display: "flex", justifyContent: "space-between" }}>
                <span>{metaLeft}</span>
                <span>{time}</span>
              </div>
            </button>
          );
        })}

      {!loading && visible.length === 0 && (
        <div style={{ opacity: 0.75 }}>No messages on this page.</div>
      )}

      {/* Pagination */}
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Page {page} / {totalPages}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
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
                fontWeight: p === page ? 700 : 600,
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
            }}
          >
            {">>"}
          </button>
        </div>
      </div>
    </div>
  );
}
