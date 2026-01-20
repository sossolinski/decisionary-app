"use client";

import { useEffect, useMemo, useState } from "react";
import type { SessionInject } from "@/lib/sessions";
import { getSessionInbox } from "@/lib/sessions";

export type InboxMode = "inbox" | "pulse";

function badgeText(channel?: string | null) {
  const c = (channel ?? "").toLowerCase();
  if (!c) return "message";
  return c;
}

function formatTs(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function Inbox({
  sessionId,
  mode = "inbox",
  selectedId,
  onSelect,
  title,
}: {
  sessionId: string;
  mode?: InboxMode;
  selectedId?: string | null;
  onSelect?: (item: SessionInject) => void;
  title?: string;
}) {
  const [items, setItems] = useState<SessionInject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // MVP: we reuse the same source.
      // Next step: create getSessionPulse(sessionId) and switch by mode.
      const data = await getSessionInbox(sessionId);

      // Temporary heuristic filter for Pulse
      const filtered =
        mode === "pulse"
          ? data.filter((x) => {
              const ch = String(x.injects?.channel ?? "").toLowerCase();
              return ch.includes("pulse") || ch.includes("social");
            })
          : data;

      setItems(filtered);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!sessionId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, mode]);

  const headerTitle = useMemo(() => {
    if (title) return title;
    return mode === "pulse" ? "Pulse feed" : "Inbox";
  }, [mode, title]);

  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: 14,
        padding: 14,
        background: "white",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ fontWeight: 800 }}>{headerTitle}</div>
        <button
          onClick={load}
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {loading && <div style={{ marginTop: 12, opacity: 0.7 }}>Loading…</div>}
      {error && <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div style={{ marginTop: 12, opacity: 0.7 }}>
          {mode === "pulse"
            ? "No posts yet. Ask facilitator to inject social activity."
            : "No messages yet. Ask facilitator to deliver an inject."}
        </div>
      )}

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {items.map((it) => (
          <MessageCard
            key={it.id}
            it={it}
            selected={selectedId === it.id}
            onClick={() => onSelect?.(it)}
            mode={mode}
          />
        ))}
      </div>
    </div>
  );
}

function MessageCard({
  it,
  selected,
  onClick,
  mode,
}: {
  it: SessionInject;
  selected: boolean;
  onClick?: () => void;
  mode: InboxMode;
}) {
  const inj = it.injects;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        width: "100%",
        border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: 14,
        padding: 12,
        background: selected ? "rgba(37,99,235,0.07)" : "white",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "baseline",
        }}
      >
        <div style={{ fontWeight: 800 }}>
          {inj?.title ?? (mode === "pulse" ? "(missing post)" : "(missing inject)")}
        </div>
        <div style={{ fontSize: 12, opacity: 0.6 }}>
          {formatTs(it.delivered_at)}
        </div>
      </div>

      <div
        style={{
          marginTop: 6,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 12,
            padding: "2px 8px",
            borderRadius: 999,
            border: "1px solid rgba(0,0,0,0.12)",
            opacity: 0.8,
          }}
        >
          {badgeText(inj?.channel)}
        </span>

        <span style={{ fontSize: 12, opacity: 0.75 }}>
          {inj?.sender_name || "Unknown"}
          {inj?.sender_org ? ` · ${inj.sender_org}` : ""}
        </span>

        {inj?.severity && mode !== "pulse" && (
          <span style={{ fontSize: 12, opacity: 0.75 }}>
            · severity: <strong>{inj.severity}</strong>
          </span>
        )}

        {mode === "pulse" && (
          <span style={{ fontSize: 12, opacity: 0.75 }}>
            · <strong>Unverified</strong>
          </span>
        )}
      </div>

      <div
        style={{
          marginTop: 10,
          whiteSpace: "pre-wrap",
          lineHeight: 1.35,
          opacity: 0.9,
          display: "-webkit-box",
          WebkitLineClamp: 4,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {inj?.body ?? ""}
      </div>
    </button>
  );
}
