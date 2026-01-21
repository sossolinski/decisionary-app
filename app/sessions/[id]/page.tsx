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

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    onChange();
    m.addEventListener?.("change", onChange);
    return () => m.removeEventListener?.("change", onChange);
  }, [query]);

  return matches;
}

export default function SessionParticipantPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params?.id ?? "";
  const validSessionId = useMemo(() => isUuid(sessionId), [sessionId]);

  const isMobile = useMediaQuery("(max-width: 1100px)");

  const [situation, setSituation] = useState<SessionSituation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<FeedTab>("inbox");
  const [selectedItem, setSelectedItem] = useState<SessionInject | null>(null);

  // Filters (LEFT)
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<string | null>(null);
  const [channel, setChannel] = useState<string | null>(null); // only Inbox
  const [feedOpen, setFeedOpen] = useState(false); // mobile drawer

  // Actions + log state
  const [actions, setActions] = useState<SessionAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [actionsError, setActionsError] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  // Collapsible casualties editor
  const [casualtiesOpen, setCasualtiesOpen] = useState(false);

  // Notes (simple local notepad)
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState<"idle" | "saved">("idle");

  useEffect(() => {
    try {
      const key = `decisionary_notes_${sessionId}`;
      const existing = localStorage.getItem(key);
      if (existing) setNotes(existing);
    } catch {}
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const t = setTimeout(() => {
      try {
        const key = `decisionary_notes_${sessionId}`;
        localStorage.setItem(key, notes);
        setNotesSaved("saved");
        setTimeout(() => setNotesSaved("idle"), 900);
      } catch {}
    }, 350);

    return () => clearTimeout(t);
  }, [notes, sessionId]);

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

  // Inbox actions
  async function doAction(actionType: "ignore" | "escalate" | "act") {
    if (!selectedItem) return;

    try {
      const saved = await addSessionAction({
        sessionId,
        sessionInjectId: selectedItem.id,
        source: activeTab, // should be "inbox" for these buttons
        actionType,
        comment: comment.trim() ? comment.trim() : null,
      });

      // prepend to log
      setActions((prev) => [saved, ...prev]);

      // CONSEQUENCE (MVP): after ACT, generate a new official inject
      if (actionType === "act") {
        const title = `Update: action taken on "${selectedItem.injects?.title ?? "message"}"`;
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

  function clearFilters() {
    setSearch("");
    setSeverity(null);
    setChannel(null);
  }

  if (!sessionId) return <>Loading…</>;

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

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <strong>Error:</strong> {error}
      </div>
    );
  }

  if (!situation) return <>Loading…</>;

  const feed = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Filters */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title/body/sender…"
          style={{
            width: "100%",
            padding: "9px 10px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.14)",
            background: "white",
            fontSize: 12,
            fontWeight: 700,
            outline: "none",
          }}
        />

        <select
          value={severity ?? ""}
          onChange={(e) => setSeverity(e.target.value ? e.target.value : null)}
          style={{
            width: "100%",
            padding: "9px 10px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.14)",
            background: "white",
            fontSize: 12,
            fontWeight: 800,
            outline: "none",
          }}
        >
          <option value="">Severity: All</option>
          <option value="low">Severity: LOW</option>
          <option value="medium">Severity: MEDIUM</option>
          <option value="high">Severity: HIGH</option>
          <option value="critical">Severity: CRITICAL</option>
        </select>

        {activeTab === "inbox" && (
          <select
            value={channel ?? ""}
            onChange={(e) => setChannel(e.target.value ? e.target.value : null)}
            style={{
              width: "100%",
              padding: "9px 10px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.14)",
              background: "white",
              fontSize: 12,
              fontWeight: 800,
              outline: "none",
            }}
          >
            <option value="">Channel: All (non-pulse)</option>
            <option value="ops">Channel: OPS</option>
            <option value="media">Channel: MEDIA</option>
            <option value="social">Channel: SOCIAL</option>
          </select>
        )}

        <button
          onClick={clearFilters}
          style={{
            padding: "9px 10px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.14)",
            background: "white",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          Clear filters
        </button>
      </div>

      {/* List */}
      {activeTab === "inbox" ? (
        <Inbox
          sessionId={sessionId}
          mode="inbox"
          selectedId={selectedItem?.id ?? null}
          onSelect={(item: SessionInject) => {
            setSelectedItem(item);
            if (isMobile) setFeedOpen(false);
          }}
          channel={channel}
          severity={severity}
          search={search}
        />
      ) : (
        <PulseFeed
          sessionId={sessionId}
          selectedId={selectedItem?.id ?? null}
          onSelect={(item: SessionInject) => {
            setSelectedItem(item);
            if (isMobile) setFeedOpen(false);
          }}
          severity={severity}
          search={search}
        />
      )}
    </div>
  );

  const lastUpdatedAt = situation.updated_at
    ? new Date(situation.updated_at).toLocaleString()
    : "—";
  const lastUpdatedBy = situation.updated_by ? String(situation.updated_by) : null;

  const workspaceGrid = isMobile
    ? "1fr"
    : "340px minmax(520px, 1fr) 360px";

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Facilitator tools (later hide by role) */}
      <div
        style={{
          background: "white",
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 16,
          padding: 12,
        }}
      >
        <FacilitatorControls sessionId={sessionId} />
        <div style={{ height: 10 }} />
        <AddInjectForm sessionId={sessionId} />
      </div>

      {/* Context */}
      <div
        style={{
          background: "white",
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 16,
          padding: 12,
        }}
      >
        <SituationCard situation={situation} />

        {/* Casualties editor toggle (right-aligned on desktop, full-width on mobile) */}
        <div
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "340px 1fr 360px",
            gap: 12,
            alignItems: "start",
          }}
        >
          {!isMobile ? <div /> : null}
          {!isMobile ? <div /> : null}

          <div
            style={{
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.10)",
              background: "rgba(0,0,0,0.02)",
              padding: 12,
            }}
          >
            <button
              onClick={() => setCasualtiesOpen((v) => !v)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: casualtiesOpen
                  ? "2px solid #2563eb"
                  : "1px solid rgba(0,0,0,0.14)",
                background: "white",
                cursor: "pointer",
                fontWeight: 900,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>Update casualties</span>
              <span
                style={{
                  opacity: 0.7,
                  transform: casualtiesOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 180ms ease",
                  display: "inline-block",
                }}
              >
                ▼
              </span>
            </button>

            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: "rgba(0,0,0,0.55)",
                fontWeight: 800,
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <span>Last updated: {lastUpdatedAt}</span>
              <span>{lastUpdatedBy ? `By: ${lastUpdatedBy}` : ""}</span>
            </div>

            {casualtiesOpen && (
              <div style={{ marginTop: 10 }}>
                <CasualtyEditor
                  situation={situation}
                  editable={true}
                  onUpdated={(next: SessionSituation) => setSituation(next)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Workspace */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: workspaceGrid,
          gap: 12,
          alignItems: "start",
        }}
      >
        {/* LEFT: Tabs + Feed */}
        <div
          style={{
            background: "white",
            border: "1px solid rgba(0,0,0,0.10)",
            borderRadius: 16,
            padding: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                padding: 6,
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "rgba(0,0,0,0.03)",
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
                  fontWeight: 700,
                }}
              >
                Inbox
              </button>
              <button
                onClick={() => {
                  setActiveTab("pulse");
                  setSelectedItem(null);
                  setChannel(null);
                }}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: activeTab === "pulse" ? "white" : "transparent",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Pulse
              </button>
            </div>

            {/* Mobile: open drawer */}
            {isMobile && (
              <button
                onClick={() => setFeedOpen(true)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.14)",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                Feed
              </button>
            )}
          </div>

          {/* Desktop feed */}
          {!isMobile ? feed : null}
        </div>

        {/* MIDDLE: Detail + Actions (linked) */}
        <div
          style={{
            background: "white",
            border: "1px solid rgba(0,0,0,0.10)",
            borderRadius: 16,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <h3 style={{ marginTop: 0, marginBottom: 6 }}>Message detail</h3>
              <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.55)" }}>
                {selectedItem ? "Selected" : "No selection"}
              </div>
            </div>
            <MessageDetail item={selectedItem} mode={activeTab} />
          </div>

          <div
            style={{
              borderTop: "1px solid rgba(0,0,0,0.08)",
              paddingTop: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 14 }}>Actions</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.55)" }}>
                {selectedItem ? (
                  <>
                    For: <span style={{ fontWeight: 900 }}>{selectedItem.injects?.title ?? "Message"}</span>
                  </>
                ) : (
                  <>Pick a message to act</>
                )}
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
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
                  minHeight: 70,
                }}
              />
            </div>

            <div style={{ marginTop: 10 }}>
              {activeTab === "pulse" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button
                    onClick={() => doPulseDecision("confirm")}
                    disabled={!selectedItem}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.15)",
                      cursor: selectedItem ? "pointer" : "not-allowed",
                      opacity: selectedItem ? 1 : 0.5,
                      fontWeight: 800,
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
                      fontWeight: 800,
                    }}
                  >
                    Deny
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <button
                    onClick={() => doAction("ignore")}
                    disabled={!selectedItem}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.15)",
                      cursor: selectedItem ? "pointer" : "not-allowed",
                      opacity: selectedItem ? 1 : 0.5,
                      fontWeight: 800,
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
                      fontWeight: 800,
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
                      fontWeight: 800,
                    }}
                  >
                    Act
                  </button>
                </div>
              )}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.60)" }}>
              {selectedItem ? (
                <>
                  Responding to: <code>{selectedItem.injects?.title ?? selectedItem.id}</code>
                </>
              ) : (
                <>Select a message to enable context-aware actions.</>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Notes */}
        <div
          style={{
            background: "white",
            border: "1px solid rgba(0,0,0,0.10)",
            borderRadius: 16,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            minHeight: 220,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Notes</h3>
            <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.55)" }}>
              {notesSaved === "saved" ? "Saved" : " "}
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.55)" }}>
            {selectedItem ? (
              <>
                Linked to: <span style={{ fontWeight: 900 }}>{selectedItem.injects?.title ?? "Message"}</span>
              </>
            ) : (
              <>Session notes (no message selected)</>
            )}
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Write your facilitator notes here…"
            style={{
              width: "100%",
              minHeight: 260,
              resize: "vertical",
              padding: 10,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              fontSize: 13,
              lineHeight: 1.4,
            }}
          />

          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)", fontWeight: 800 }}>
            Auto-saves locally for this session.
          </div>
        </div>
      </div>

      {/* Bottom log */}
      <div
        style={{
          background: "white",
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 16,
          padding: 12,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Log</h3>

        {actionsLoading && <div>Loading…</div>}
        {actionsError && <div style={{ color: "crimson" }}>{actionsError}</div>}
        {!actionsLoading && !actionsError && actions.length === 0 && (
          <div>No actions recorded yet.</div>
        )}

        {actions.slice(0, 12).map((a) => (
          <div
            key={a.id}
            style={{
              padding: "10px 10px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.10)",
              background: "white",
              marginBottom: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 12 }}>
                {a.action_type.toUpperCase()}{" "}
                <span style={{ color: "rgba(0,0,0,0.55)" }}>({a.source})</span>
                {a.session_inject_id ? (
                  <span style={{ color: "rgba(0,0,0,0.55)" }}> · {a.session_inject_id}</span>
                ) : null}
              </div>
              <div style={{ fontSize: 11, color: "rgba(0,0,0,0.55)", fontWeight: 700 }}>
                {new Date(a.created_at).toLocaleString()}
              </div>
            </div>

            {a.comment ? (
              <div style={{ marginTop: 6, fontSize: 12, color: "rgba(0,0,0,0.78)" }}>
                {a.comment}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Mobile drawer */}
      {isMobile && feedOpen && (
        <div
          onClick={() => setFeedOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.40)",
            zIndex: 200,
            display: "flex",
            justifyContent: "flex-start",
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(92vw, 420px)",
              height: "100%",
              background: "rgba(255,255,255,0.96)",
              borderRight: "1px solid rgba(0,0,0,0.10)",
              boxShadow: "20px 0 40px rgba(0,0,0,0.20)",
              padding: 12,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 13 }}>
                {activeTab === "inbox" ? "Inbox" : "Pulse"} · Feed
              </div>
              <button
                onClick={() => setFeedOpen(false)}
                style={{
                  padding: "9px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.14)",
                  background: "white",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                Close
              </button>
            </div>

            {feed}
          </div>
        </div>
      )}
    </div>
  );
}
