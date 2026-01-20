"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSessionPulse, subscribePulse, type SessionInject } from "@/lib/sessions";

type Props = {
  sessionId: string;
  selectedId: string | null;
  onSelect: (item: SessionInject) => void;
};

function clampText(s: string, max = 160) {
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

export default function PulseFeed({ sessionId, selectedId, onSelect }: Props) {
  const pageSize = 5;

  const [items, setItems] = useState<SessionInject[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const pageRef = useRef(1);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pages = rangePages(totalPages, page);

  async function load(p = page) {
    try {
      setErr(null);
      setLoading(true);
      const res = await getSessionPulse(sessionId, { page: p, pageSize });
      setItems(res.items);
      setTotal(res.total);
      setPage(res.page);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load pulse");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!sessionId) return;
    setPage(1);
    load(1);

    const unsub = subscribePulse(sessionId, () => {
      // ważne: bierzemy aktualny page z refa (bez stale closure)
      load(pageRef.current);
    });

    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const visible = useMemo(() => items, [items]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {err && (
        <div style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)", background: "rgba(255,0,0,0.05)" }}>
          {err}
        </div>
      )}

      {loading && (
        <div style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)" }}>
          Loading…
        </div>
      )}

      {!loading &&
        visible.map((p) => {
          const active = selectedId === p.id;

          const title = p.injects?.title?.trim() || "Pulse post";
          const preview = p.injects?.body ? clampText(p.injects.body, 160) : "";

          const metaLeft =
            [p.injects?.sender_name, p.injects?.sender_org].filter(Boolean).join(" · ") || "Unknown source";

          const metaRightParts = [
            p.injects?.channel ? String(p.injects.channel).toUpperCase() : null,
            p.injects?.severity ? String(p.injects.severity).toUpperCase() : null,
          ].filter(Boolean) as string[];

          const time = fmtTime(p.delivered_at);

          return (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 10px",
                borderRadius: 14,
                border: active ? "1px solid rgba(0,0,0,0.28)" : "1px solid rgba(0,0,0,0.12)",
                background: active ? "rgba(0,0,0,0.04)" : "white",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <div style={{ fontWeight: 700 }}>{title}</div>

                {metaRightParts.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {metaRightParts.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: 12,
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: "1px solid rgba(0,0,0,0.12)",
                          background: "rgba(0,0,0,0.02)",
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 6, color: "rgba(0,0,0,0.72)", fontSize: 13 }}>
                {preview ? preview : <span style={{ color: "rgba(0,0,0,0.45)" }}>(no content)</span>}
              </div>

              <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
                <span>{metaLeft}</span>
                <span>{time}</span>
              </div>
            </button>
          );
        })}

      {!loading && visible.length === 0 && (
        <div style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)" }}>
          No pulse items on this page.
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <div style={{ fontSize: 12, color: "rgba(0,0,0,0.6)" }}>
          Page {page} / {totalPages}
        </div>

        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <button
            onClick={() => setPage((x) => Math.max(1, x - 1))}
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
            onClick={() => setPage((x) => Math.min(totalPages, x + 1))}
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
