"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import {
  getSessionSituation,
  type SessionSituation,
  type SessionInject,
  getSessionActions,
  addSessionAction,
  type SessionAction,
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

  // Actions + log state
  const [actions, setActions] = useState<SessionAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [actionsError, setActionsError] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  // Load situation (COP)
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

  // Load action log
  useEffect(() => {
    if (!validSessionId) return;

    let alive = true;
    setActionsLoading(true);
    setActionsError(null);

    getSessionActions(sessionId, 50)
      .then((rows) => alive && setActions(rows))
      .catch((e) => alive && setActionsError(e?.message ?? "Failed to load actions"))
      .finally(() => alive && setActionsLoading(false));

    return () => {
      alive = false;
    };
  }, [sessionId, validSessionId]);

  async function doAction(actionType: "ignore" | "escalate" | "act") {
    if (!selectedItem) return;

    try {
      const saved = await addSessionAction({
        sessionId,
        sessionInjectId: selectedItem.id,
        source: activeTab,
        actionType,
        comment: comment.trim() ? comment.trim() : null,
      });

      // prepend
      setActions((prev) => [saved, ...prev]);
      setComment("");
    } catch (e: any) {
      alert(e?.message ?? "Failed to save action");
    }
  }

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
      {/* Facilitator tools (later hide by role) */}
      <div style={{ display: "grid", gap: 10 }}>
        <FacilitatorControls sessionId={sessionId} />
        <AddInjectForm sessionId={sessionId} />
      </div>

      {/* Context */}
      <SituationCard s={situation} />

      {/* Workspace */}
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

            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional comment (what you did / why)"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                marginBottom: 10,
              }}
            />

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => doAction("ignore")}
                disabled={!selectedItem}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                  cursor: selectedItem ? "pointer" : "not-allowed",
                  opacity: selectedItem ? 1 : 0.5,
                }}
              >
                Ignore
              </button>

              <button
                onClick={() => doAction("escalate")}
                disabled={!selectedItem}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                  cursor: selectedItem ? "pointer" : "not-allowed",
                  opacity: selectedItem ? 1 : 0.5,
                }}
              >
                Escalate
              </button>

              <button
                onClick={() => doAction("act")}
                disabled={!selectedItem}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                  cursor: selectedItem ? "pointer" : "not-allowed",
                  opacity: selectedItem ? 1 : 0.5,
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

      {/* Bottom log */}
      <div
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 16,
          background: "white",
          padding: 12,
          minHeight: 64,
          opacity: 0.95,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Log</div>

        {actionsLoading && (
          <div style={{ fontSize: 12, opacity: 0.7 }}>Loading…</div>
        )}
        {actionsError && (
          <div style={{ fontSize: 12, color: "crimson" }}>{actionsError}</div>
        )}

        {!actionsLoading && !actionsError && actions.length === 0 && (
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            No actions recorded yet.
          </div>
        )}

        <div style={{ display: "grid", gap: 8 }}>
          {actions.slice(0, 12).map((a) => (
            <div
              key={a.id}
              style={{
                border: "1px solid rgba(0,0,0,0.10)",
                borderRadius: 12,
                padding: 10,
                fontSize: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div>
                  <strong>{a.action_type.toUpperCase()}</strong>{" "}
                  <span style={{ opacity: 0.7 }}>({a.source})</span>
                  {a.session_inject_id ? (
                    <span style={{ opacity: 0.6 }}>
                      {" "}
                      · {a.session_inject_id}
                    </span>
                  ) : null}
                </div>
                <div style={{ opacity: 0.65 }}>
                  {new Date(a.created_at).toLocaleString()}
                </div>
              </div>

              {a.comment ? (
                <div
                  style={{
                    marginTop: 6,
                    whiteSpace: "pre-wrap",
                    opacity: 0.9,
                  }}
                >
                  {a.comment}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
