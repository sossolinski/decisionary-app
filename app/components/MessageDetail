"use client";

import type { SessionInject } from "@/lib/sessions";

function formatTs(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function labelForMode(mode: "inbox" | "pulse") {
  return mode === "pulse" ? "Pulse (Unverified)" : "Inbox (Official)";
}

export default function MessageDetail({
  item,
  mode,
}: {
  item: SessionInject | null;
  mode: "inbox" | "pulse";
}) {
  if (!item) {
    return (
      <div>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Message detail</div>
        <div style={{ opacity: 0.7, lineHeight: 1.45 }}>
          Select an item from Inbox or Pulse to view details.
        </div>
      </div>
    );
  }

  const inj = item.injects;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{labelForMode(mode)}</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>
            {inj?.title ?? "(missing title)"}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, opacity: 0.65 }}>Delivered</div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>
            {formatTs(item.delivered_at)}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <Chip>{inj?.channel ? String(inj.channel) : "message"}</Chip>

        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {inj?.sender_name || "Unknown"}
          {inj?.sender_org ? ` · ${inj.sender_org}` : ""}
        </div>

        {mode !== "pulse" && inj?.severity && (
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            · severity: <strong>{inj.severity}</strong>
          </div>
        )}

        {mode === "pulse" && (
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            · <strong>Unverified</strong>
          </div>
        )}
      </div>

      {mode === "pulse" && (
        <div
          style={{
            border: "1px solid rgba(245, 158, 11, 0.35)",
            background: "rgba(245, 158, 11, 0.08)",
            padding: 10,
            borderRadius: 12,
            fontSize: 12,
            lineHeight: 1.35,
          }}
        >
          ⚠️ Information from Pulse is unverified and may be inaccurate.
        </div>
      )}

      <div
        style={{
          borderTop: "1px solid rgba(0,0,0,0.08)",
          paddingTop: 12,
          whiteSpace: "pre-wrap",
          lineHeight: 1.5,
        }}
      >
        {inj?.body ?? ""}
      </div>

      <div style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Item ID: <code>{item.id}</code>
        </div>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid rgba(0,0,0,0.12)",
        opacity: 0.85,
      }}
    >
      {children}
    </span>
  );
}
