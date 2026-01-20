"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { useRequireAuth } from "@/lib/useRequireAuth";
import { supabase } from "@/lib/supabaseClient";

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
import MessageDetail from "@/app/components/MessageDetail";
import FacilitatorControls from "@/app/components/FacilitatorControls";
import AddInjectForm from "@/app/components/AddInjectForm";
import Inbox from "@/app/components/Inbox";
import PulseFeed from "@/app/components/PulseFeed";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

type FeedTab = "inbox" | "pulse";
type AppRole = "facilitator" | "participant";

export default function SessionParticipantPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params?.id ?? "";
  const validSessionId = useMemo(() => isUuid(sessionId), [sessionId]);

  // ✅ Auth guard (hook robi redirect do /login; my tylko pokazujemy fallback)
  const { loading: authLoading, userId } = useRequireAuth();

  // ✅ Role (MVP): profiles.role
  const [role, setRole] = useState<AppRole>("participant");
  const [roleLoading, setRoleLoading] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);

  // Session data
  const [situation, setSituation] = useState<SessionSituation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<FeedTab>("inbox");
  const [selectedItem, setSelectedItem] = useState<SessionInject | null>(null);

  // Actions + log
  const [actions, setActions] = useState<SessionAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [actionsError, setActionsError] = useState<string | null>(null);

  const [comment, setComment] = useState("");

  const isFacilitator = role === "facilitator";

  // Load role
  useEffect(() => {
    let alive = true;

    async function loadRole() {
      if (authLoading) return;
      if (!userId) return;
      setRoleLoading(true);
      setRoleError(null);

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();

        if (error) throw error;

        const r = (data?.role ?? "participant") as AppRole;
        if (alive) setRole(r);
      } catch (e: any) {
        if (alive) {
          setRoleError(e?.message ?? "Failed to load role");
          setRole("participant");
        }
      } finally {
        if (alive) setRoleLoading(false);
      }
    }

    loadRole();
    return () => {
      alive = false;
    };
  }, [authLoading, userId]);

  // Load situation (COP)
  useEffect(() => {
    if (authLoading || roleLoading) return;
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
  }, [sessionId, validSessionId, authLoading, roleLoading]);

  // Load action log
  useEffect(() => {
    if (authLoading || roleLoading) return;
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
  }, [sessionId, validSessionId, authLoading, roleLoading]);

  // Inbox actions
  async function doAction(actionType: "ignore" | "escalate" | "act") {
    if (!selectedItem) return;

    try {
      const saved = await addSessionAction({
        sessionId,
        sessionInjectId: selectedItem.id,
        source: activeTab, // inbox/pulse
        actionType,
        comment: comment.trim() ? comment.trim() : null,
      });

      // prepend to log
      setActions((prev) => [saved, ...prev]);

      // ✅ CONSEQUENCE (MVP): only facilitator can publish official comms
      if (actionType === "act" && isFacilitator) {
        const title = `Update: action taken on "${
          selectedItem.injects?.title ?? "message"
        }"`;

        const body =
          `Decision recorded.\n\n` +
          `Action: ACT\n` +
          `Source: ${activeTab.toUpperCase()}\n` +
          `Reference message ID: ${selectedItem.id}\n` +
          (comment.trim() ? `\nComment:\n${comment.trim()}\n` : "") +
          `\nNext update will follow.`;

        const { sendInjectToSession } = await import("@/lib/sessions");
        await sendInjectToSession(sessionId, title, body);
      }

      setComment("");
    } catch (e: any) {
      alert(e?.message ?? "Failed to save action");
    }
  }

  // Pulse decisions -> official comms into Inbox
  async function doPulseDecision(decision: "confirm" | "deny") {
    if (!selectedItem) return;

    // ✅ Only facilitator can publish confirm/deny as official comms
    if (!isFacilitator) {
      alert("Only facilitator can publish official confirmation/denial.");
      return;
    }

    try {
      // log as an action (MVP mapping: confirm -> act, deny -> ignore)
      const saved = await addSessionAction({
        sessionId,
        sessionInjectId: selectedItem.id,
        source: "pulse",
        actionType: decision === "confirm" ? "act" : "ignore",
        comment: comment.trim()
          ? `${decision.toUpperCase()}: ${comment.trim()}`
          : `${decision.toUpperCase()}`,
      });

      setActions((prev) => [saved, ...prev]);

      const pulseTitle = selectedItem.injects?.title ?? "pulse post";
      const pulseBody = selectedItem.injects?.body ?? "";

      const title =
        decision === "confirm"
          ? `Official confirmation regarding "${pulseTitle}"`
          : `Official denial regarding "${pulseTitle}"`;

      const body =
        (decision === "confirm"
          ? `We confirm that the information circulating is accurate.`
          : `We deny the information currently circulating.`) +
        `\n\nReference pulse message ID: ${selectedItem.id}` +
        (comment.trim() ? `\n\nComment:\n${comment.trim()}` : "") +
        (pulseBody ? `\n\nQuoted content:\n${pulseBody}` : "");

      const { sendInjectToSession } = await import("@/lib/sessions");
      await sendInjectToSession(sessionId, title, body);

      setComment("");
    } catch (e: any) {
      alert(e?.message ?? "Failed to process Pulse decision");
    }
  }

  // ================= RENDER GUARDS =================

  if (authLoading) {
    return <div style={{ padding: 16 }}>Loading…</div>;
  }


if (loading) return <div>Loading…</div>;
if (!userId) return <div>Not authenticated</div>;

  if (!sessionId) return <div style={{ padding: 16 }}>Loading…</div>;

  if (!validSessionId) {
    return (
      <div style={{ padding: 16 }}>
        <h2>Invalid session id</h2>
        <p>
          This URL parameter must be a UUID. Go back and paste a valid{" "}
          <code>sessions.id</code> from Supabase.
        </p>
      </div>
    );
  }

  if (roleLoading) {
    return <div style={{ padding: 16 }}>Loading permissions…</div>;
  }

  if (roleError) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Role error</div>
        <div style={{ opacity: 0.8 }}>{roleError}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ fontWeight: 700 }}>Error:</div>
        <div>{error}</div>
      </div>
    );
  }

  if (!situation) return <div style={{ padding: 16 }}>Loading…</div>;

  // ================= UI =================

  return (
    <div style={{ padding: 16 }}>
      {/* ✅ Facilitator-only tools */}
      {isFacilitator ? (
        <div style={{ marginBottom: 12 }}>
          <FacilitatorControls sessionId={sessionId} />
          <div style={{ height: 10 }} />
          <AddInjectForm sessionId={sessionId} />
        </div>
      ) : null}

      {/* Context */}
      <div style={{ marginBottom: 12 }}>
        <SituationCard situation={situation} />
      </div>

      {/* Workspace */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr 360px",
          gap: 12,
          alignItems: "start",
        }}
      >
        {/* LEFT: Tabs + Feed */}
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
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

          {activeTab === "inbox" ? (
            <Inbox
              sessionId={sessionId}
              mode="inbox"
              selectedId={selectedItem?.id ?? null}
              onSelect={(item) => setSelectedItem(item)}
            />
          ) : (
            <PulseFeed
              sessionId={sessionId}
              selectedId={selectedItem?.id ?? null}
              onSelect={(item) => setSelectedItem(item)}
            />
          )}
        </div>

        {/* MIDDLE: Detail */}
        <div>
          <MessageDetail item={selectedItem} />
        </div>

        {/* RIGHT: Actions + Casualties */}
        <div>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Actions</div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              activeTab === "pulse"
                ? "Optional comment (why confirm/deny)"
                : "Optional comment (what you did / why)"
            }
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              marginBottom: 10,
            }}
          />

          {activeTab === "pulse" ? (
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => doPulseDecision("confirm")}
                disabled={!selectedItem}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                  cursor: selectedItem ? "pointer" : "not-allowed",
                  opacity: selectedItem ? 1 : 0.5,
                  fontWeight: 700,
                  width: "100%",
                }}
              >
                Confirm
              </button>

              <button
                onClick={() => doPulseDecision("deny")}
                disabled={!selectedItem}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                  cursor: selectedItem ? "pointer" : "not-allowed",
                  opacity: selectedItem ? 1 : 0.5,
                  width: "100%",
                }}
              >
                Deny
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
                  gridColumn: "1 / -1",
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
          )}

          <div style={{ marginTop: 10, opacity: 0.85 }}>
            {selectedItem ? (
              <>
                Responding to: <code>{selectedItem.injects?.title ?? selectedItem.id}</code>
                {!isFacilitator && activeTab === "pulse" ? (
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                    Note: Only facilitator can publish Confirm/Deny.
                  </div>
                ) : null}
                {!isFacilitator && activeTab !== "pulse" ? (
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                    Note: Participant actions are logged; only facilitator publishes official updates.
                  </div>
                ) : null}
              </>
            ) : (
              <>Select a message to enable context-aware actions.</>
            )}
          </div>

          {/* ✅ Casualties editor only for facilitator (MVP) */}
          {isFacilitator ? (
            <div style={{ marginTop: 14 }}>
              <CasualtyEditor situation={situation} onSaved={setSituation} />
            </div>
          ) : null}
        </div>
      </div>

      {/* Bottom log */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Log</div>

        {actionsLoading && <div>Loading…</div>}
        {actionsError && <div style={{ color: "#b91c1c" }}>{actionsError}</div>}

        {!actionsLoading && !actionsError && actions.length === 0 && (
          <div>No actions recorded yet.</div>
        )}

        {actions.slice(0, 12).map((a) => (
          <div
            key={a.id}
            style={{
              padding: "10px 10px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.10)",
              background: "white",
              marginBottom: 8,
            }}
          >
            <div style={{ fontWeight: 700 }}>
              {a.action_type.toUpperCase()} ({a.source})
              {a.session_inject_id ? <> · {a.session_inject_id}</> : null}
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {new Date(a.created_at).toLocaleString()}
            </div>
            {a.comment ? (
              <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{a.comment}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
