"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import {
  getSessionSituation,
  type SessionSituation,
  type SessionInject,
} from "@/lib/sessions";

import SituationCard from "@/app/components/SituationCard";
import CasualtyEditor from "@/app/components/CasualtyEditor";
import Inbox from "@/app/components/Inbox";
import MessageDetail from "@/app/components/MessageDetail";
import FacilitatorControls from "@/app/components/FacilitatorControls";
import AddInjectForm from "@/app/components/AddInjectForm";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

type FeedTab = "inbox" | "pulse";

export default function SessionParticipantPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params?.id ?? "";

  const validSessionId = useMemo(() => isUuid(sessionId), [sessionId]);

  const [situation, setSituation] = useState<SessionSituation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<FeedTab>("inbox");
  const [selectedItem, setSelectedItem] = useState<SessionInject | null>(null);

  useEffect(() => {
    if (!validSessionId) return;

    let alive = true;
    setError(null);

    getSessionSituation(sessionId)
      .then((s) => {
        if (!alive) return;
        if (!s) {
          setError("No session_situation row for this session.");
          return;
        }
        setSituation(s);
      })
      .catch((e) => alive && setError(e?.message ?? "Failed to load situation"));

    return () => {
      alive = false;
    };
  }, [sessionId, validSessionId]);

  if (!sessionId) return <div style={{ padding: 24 }}>Loading…</div>;

  if (!validSessionId) {
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ marginBottom: 8 }}>Invalid session id</h2>
        <div style={{ opacity: 0.75 }}>
          This URL parameter must be a UUID. Go back and paste a valid{" "}
          <code>sessions.id</code> from Supabase.
        </div>
      </div>
    );
  }

  if (error) return <div style={{ padding: 24 }}>Error: {error}</div>;
  if (!situation) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <div style={{ padding: 24, display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 10 }}>
        <FacilitatorControls sessionId={sessionId} />
        <AddInjectForm sessionId={sessionId} />
      </div>

      <SituationCard s={situation} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr 420px",
          gap: 14,
          alignItems: "start",
        }}
      >
        {/* LEFT: Inbox/Pulse */}
        <section
          style={{
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 16,
            overflow: "hidden",
            background: "white",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: 10,
              borderBottom: "1px solid rgba(0,0,0,0.08)",
              background: "rgba(0,0,0,0.02)",
            }}
          >
            <button
              onClick={() => {
                setActiveTab("inbox");
                setSelectedItem(null);
              }}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.12)",
                background: activeTab === "inbox" ? "white" : "transparent",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Inbox
            </button>

            <button
              onClick={() => {
                setActiveTab("pulse");
                setSelectedItem(null);
              }}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.12)",
                background: activeTab === "pulse" ? "white" : "transparent",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Pulse
            </button>
          </div>

          <div style={{ padding: 10 }}>
            <Inbox
              sessionId={sessionId}
              mode={activeTab}
              selectedId={selectedItem?.id ?? null}
              onSelect={(item) => setSelectedItem(item)}
            />
          </div>
        </section>

        {/* MIDDLE: Message detail */}
        <section
          style={{
            minHeight: 420,
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 16,
            background: "white",
            padding: 14,
          }}
        >
          <MessageDetail item={selectedItem} mode={activeTab} />
        </section>

        {/* RIGHT: Actions + Casualties */}
        <section style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              border: "1px solid rgba(0,0,0,0.12)",
              borderRadius: 16,
              background: "white",
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Actions</div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                  cursor: "pointer",
                }}
              >
                Ignore
              </button>
              <button
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                  cursor: "pointer",
                }}
              >
                Escalate
              </button>
              <button
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Act
              </button>
            </div>

            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
              {selectedItem ? (
                <>
                  Responding to:{" "}
                  <code>{selectedItem.injects?.title ?? selectedItem.id}</code>
                </>
              ) : (
                <>Select a message to enable context-aware actions.</>
              )}
            </div>
          </div>

          <CasualtyEditor
            situation={situation}
            editable={true}
            onUpdated={setSituation}
          />
        </section>
      </div>

      {/* Bottom log placeholder */}
      <div
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 16,
          background: "white",
          padding: 12,
          minHeight: 64,
          opacity: 0.85,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Log</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          (Next step) Actions and updates will appear here with timestamps.
        </div>
      </div>
    </div>
  );
}
