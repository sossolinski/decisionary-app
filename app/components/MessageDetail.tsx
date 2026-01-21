"use client";

import type { SessionInject } from "@/lib/sessions";

export default function MessageDetail({
  item,
  mode,
}: {
  item: SessionInject | null;
  mode: "inbox" | "pulse";
}) {
  if (!item) {
    return (
      <div style={{ color: "rgba(0,0,0,0.65)", fontSize: 13 }}>
        Select an item from Inbox or Pulse to view details.
      </div>
    );
  }

  const title = item.injects?.title?.trim() || "Message";
  const body = item.injects?.body?.trim() || "";
  const channel = item.injects?.channel ? String(item.injects.channel).toUpperCase() : null;
  const severity = item.injects?.severity ? String(item.injects.severity).toUpperCase() : null;

  const sender =
    [item.injects?.sender_name, item.injects?.sender_org].filter(Boolean).join(" · ") ||
    "Unknown source";

  const deliveredAt = item.delivered_at
    ? new Date(item.delivered_at).toLocaleString()
    : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ fontWeight: 900, fontSize: 14 }}>{title}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {mode === "pulse" && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 900,
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "rgba(0,0,0,0.03)",
              }}
            >
              UNVERIFIED
            </span>
          )}
          {channel && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "rgba(0,0,0,0.03)",
              }}
            >
              {channel}
            </span>
          )}
          {severity && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "rgba(0,0,0,0.03)",
              }}
            >
              {severity}
            </span>
          )}
        </div>
      </div>

      <div style={{ fontSize: 12, color: "rgba(0,0,0,0.62)", fontWeight: 700 }}>
        {sender} · {deliveredAt}
      </div>

      <div
        style={{
          whiteSpace: "pre-wrap",
          fontSize: 13,
          lineHeight: 1.45,
          color: "rgba(0,0,0,0.82)",
          border: "1px solid rgba(0,0,0,0.08)",
          background: "rgba(0,0,0,0.02)",
          borderRadius: 14,
          padding: 12,
        }}
      >
        {body || <span style={{ color: "rgba(0,0,0,0.45)" }}>(no content)</span>}
      </div>
    </div>
  );
}
