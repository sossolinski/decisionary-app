"use client";

import { useEffect, useMemo, useState } from "react";
import { getSessionInbox, subscribeInbox, type SessionInject } from "@/lib/sessions";

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
  // proste: pokazujemy max 4 numery + zawsze bieżącą
  if (totalPages <= 4) return Array.from({ length: totalPages }, (_, i) => i + 1);

  // okno 4 stron wokół current
  const start = Math.max(1, Math.min(current - 1, totalPages - 3));
  return [start, start + 1, start + 2, start + 3];
}

export default function Inbox({ sessionId, selectedId, onSelect, channel = null }: Props) {
  const pageSize = 5;

  const [items, setItems] = useState<SessionInject[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pages = rangePages(totalPages, page);

  async function load(p = page) {
    try {
      setErr(null);
      setLoading(true);

      const res = await getSessionInbox(sessionId, { page: p, pageSize });

      // Jeśli user jest na stronie > totalPages (np. po realtime), koryguj
      const newTotalPages = Math.max(1, Math.ceil(res.total / pageSize));
      const safePage = Math.min(res.page, newTotalPages);

      setTotal(res.total);
      setPage(safePage);
      setItems(res.items);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!sessionId) return;
    setPage(1);
    load(1);

    // realtime: po zmianie danych przeładuj aktualną stronę
    const unsub = subscribeInbox(sessionId, () => load(page));
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // przeładuj po zmianie strony
  useEffect(() => {
    if (!sessionId) return;
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const filtered = useMemo(() => {
    if (!channel) return items;
    return items.filter((x) => x.injects?.channel === channel);
  }, [items, channel]);

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700 }}>Inbox</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {loading ? "Loading…" : `${total} total`}
        </div>
      </div>

      {err && (
        <div
          style={{
            marginBottom: 10,
            padding: 10,
            borderRadius: 12,
            border: "1px solid rgba(220,38,38,0.35)",
            background: "rgba(220,38,38,0.08)",
            color: "crimson",
            fontSize: 12,
          }}
        >
          {err}
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {filtered.map((row) => {
          const inj = row.injects;
          const active = selectedId === row.id;

          const title = inj?.title?.trim() || "Untitled";
          const preview = inj?.body ? clampText(inj.body, 160) : "";
          const metaLeft =
            [inj?.sender_name, inj?.sender_org].filter(Boolean).join(" · ") || "Unknown sender";
          const metaRightParts = [
            inj?.channel ? inj.channel.toUpperCase() : null,
            inj?.severity ? inj.severity.toUpperCase() : null,
          ].filter(Boolean);

          const time = fmtTime(row.delivered_at);

          return (
            <button
              key={row.id}
              onClick={() => onSelect(row)}
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
                transition: "background 120ms ease, border 120ms ease",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  lineHeight: 1.25,
                  marginBottom: 4,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {title}
                </div>

                {metaRightParts.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {metaRightParts.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: "1px solid rgba(0,0,0,0.12)",
                          opacity: 0.8,
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {preview ? (
                <div style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.3, marginBottom: 8 }}>
                  {preview}
                </div>
              ) : (
                <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 8 }}>(no content)</div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  fontSize: 11,
                  opacity: 0.68,
                }}
              >
                <div
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "70%",
                  }}
                >
                  {metaLeft}
                </div>
                <div style={{ flexShrink: 0 }}>{time}</div>
              </div>
            </button>
          );
        })}

        {!loading && filtered.length === 0 && (
          <div
            style={{
              border: "1px solid rgba(0,0,0,0.10)",
              borderRadius: 14,
              padding: 12,
              fontSize: 12,
              opacity: 0.7,
            }}
          >
            No messages on this page.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div
        style={{
          marginTop: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          fontSize: 12,
        }}
      >
        <div style={{ opacity: 0.7 }}>
          Page {page} / {totalPages}
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
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
