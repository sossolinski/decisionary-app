"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import type { Scenario } from "@/lib/scenarios";

import {
  getSessionSituation,
  updateCasualties,
  type SessionSituation,
  type SessionInject,
  getSessionActions,
  addSessionAction,
  type SessionAction,
} from "@/lib/sessions";

import SituationCard from "@/app/components/SituationCard";
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
  const [scenario, setScenario] = useState<Scenario | null>(null);
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

  // Notes (simple local notepad)
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState<"idle" | "saved">("idle");

  // Facilitator tools popover
  const [toolsOpen, setToolsOpen] = useState(false);

  // Role gating
  const [isFacilitator, setIsFacilitator] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  // Session owner (fallback facilitator)
  const [sessionOwnerId, setSessionOwnerId] = useState<string | null>(null);

  // Top bar clock (live clock for now)
  const [liveClock, setLiveClock] = useState<string>("");

  useEffect(() => {
    const tick = () =>
      setLiveClock(
        new Date().toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

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

  // Close tools popover on Escape / outside click
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setToolsOpen(false);
    }
    function onClick() {
      if (toolsOpen) setToolsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [toolsOpen]);

  // Load role (with owner fallback)
  useEffect(() => {
    if (!validSessionId) return;

    let alive = true;

    (async () => {
      try {
        setRoleLoading(true);

        const { data: u } = await supabase.auth.getUser();
        const authUserId = u.user?.id;

        if (!authUserId) {
          if (alive) setIsFacilitator(false);
          return;
        }

        // Fallback: session owner is facilitator
        if (sessionOwnerId && sessionOwnerId === authUserId) {
          if (alive) setIsFacilitator(true);
          return;
        }

        // Pull all assignments for the session and match on common keys client-side.
        const { data, error } = await supabase
          .from("session_role_assignments")
          .select("*")
          .eq("session_id", sessionId);

        if (error) throw error;

        const rows = (data ?? []) as any[];

        const match = rows.find((r) => {
          const roleKey = r?.role_key ?? r?.role ?? r?.role_id ?? null;
          const uid =
            r?.user_id ??
            r?.member_id ??
            r?.profile_id ??
            r?.participant_id ??
            r?.owner_id ??
            null;

          return roleKey === "facilitator" && uid === authUserId;
        });

        if (alive) setIsFacilitator(Boolean(match));
      } catch {
        if (alive) setIsFacilitator(false);
      } finally {
        if (alive) setRoleLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [sessionId, validSessionId, sessionOwnerId]);

  // Load situation (COP)
  useEffect(() => {
    if (!validSessionId) return;
    let alive = true;
    setError(null);

    getSessionSituation(sessionId)
      .then((s) => {
        if (!alive) return;
        setSituation(s);
      })
      .catch((e) => alive && setError(e?.message ?? "Failed to load situation"));

    return () => {
      alive = false;
    };
  }, [sessionId, validSessionId]);

  // Load scenario fallback (sessions.scenario_id -> scenarios.*) + owner (safe)
  useEffect(() => {
    if (!validSessionId) return;
    let alive = true;

    (async () => {
      try {
        // 1) scenario_id (should exist)
        const { data: sess1, error: sessErr1 } = await supabase
          .from("sessions")
          .select("scenario_id")
          .eq("id", sessionId)
          .single();

        if (sessErr1) throw sessErr1;

        const scenarioId =
          (sess1 as any)?.scenario_id ??
          (sess1 as any)?.scenario ??
          (sess1 as any)?.scenarioId ??
          null;

        // 2) owner lookup (best-effort; missing column must NOT crash)
        const ownerCandidates = [
          "owner_id",
          "created_by",
          "created_by_id",
          "owner",
          "user_id",
        ] as const;

        let ownerId: string | null = null;

        for (const col of ownerCandidates) {
          const { data, error } = await supabase
            .from("sessions")
            .select(col)
            .eq("id", sessionId)
            .single();

          if (!error) {
            const v = (data as any)?.[col];
            if (typeof v === "string" && v) ownerId = v;
            break; // column exists (even if null)
          }
        }

        if (alive) setSessionOwnerId(ownerId);

        // 3) load scenario
        if (!scenarioId) {
          if (alive) setScenario(null);
          return;
        }

        const { data: sc, error: scErr } = await supabase
          .from("scenarios")
          .select("*")
          .eq("id", scenarioId)
          .single();

        if (scErr) throw scErr;

        if (alive) setScenario(sc as Scenario);
      } catch (e: any) {
        if (alive) {
          setScenario(null);
          setError(
            (prev) =>
              prev ??
              (e?.message ? `Scenario load: ${e.message}` : "Scenario load failed")
          );
        }
      }
    })();

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
        source: activeTab,
        actionType,
        comment: comment.trim() ? comment.trim() : null,
      });

      setActions((prev) => [saved, ...prev]);

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

  const feed = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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

  const workspaceGrid = isMobile ? "1fr" : "340px minmax(520px, 1fr) 360px";

  const sessionTitle = scenario?.title ? scenario.title : "Session";
  const sessionMeta = scenario?.short_description ? scenario.short_description : " ";

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* TOP BAR + CLOCK */}
      <div
        style={{
          position: "sticky",
          top: 10,
          zIndex: 50,
          background: "rgba(255,255,255,0.92)",
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 16,
          padding: 12,
          backdropFilter: "blur(8px)",
          boxShadow: "0 12px 28px rgba(11,18,32,0.10)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr auto",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 950, fontSize: 14, lineHeight: 1.15 }}>
              {sessionTitle}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                fontWeight: 800,
                color: "rgba(0,0,0,0.55)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={sessionMeta}
            >
              {sessionMeta}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: isMobile ? "flex-start" : "flex-end",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {/* Clock */}
            <div
              style={{
                padding: "9px 10px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.14)",
                background: "white",
                fontSize: 12,
                fontWeight: 900,
              }}
              title="Live clock (local)"
            >
              ⏱ {liveClock}
            </div>

            {/* Facilitator tools (role gated) */}
            {roleLoading ? (
              <div
                style={{
                  padding: "9px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.14)",
                  background: "white",
                  fontSize: 12,
                  fontWeight: 900,
                  opacity: 0.7,
                }}
              >
                Loading role…
              </div>
            ) : isFacilitator ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setToolsOpen((v) => !v);
                }}
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
                Facilitator tools
              </button>
            ) : null}

            {isMobile && (
              <button
                onClick={() => setFeedOpen(true)}
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
                Open feed
              </button>
            )}
          </div>
        </div>

        {/* Tools popover */}
        {isFacilitator && toolsOpen ? (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              marginTop: 10,
              borderTop: "1px solid rgba(0,0,0,0.08)",
              paddingTop: 10,
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 12,
            }}
          >
            <div
              style={{
                background: "white",
                border: "1px solid rgba(0,0,0,0.10)",
                borderRadius: 14,
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 950, fontSize: 13, marginBottom: 8 }}>
                In-session controls
              </div>
              <FacilitatorControls sessionId={sessionId} />
            </div>

            <div
              style={{
                background: "white",
                border: "1px solid rgba(0,0,0,0.10)",
                borderRadius: 14,
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 950, fontSize: 13, marginBottom: 8 }}>
                New inject
              </div>
              <AddInjectForm sessionId={sessionId} />
            </div>

            <div
              style={{
                gridColumn: isMobile ? "auto" : "1 / -1",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setToolsOpen(false)}
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
          </div>
        ) : null}
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
        <SituationCard
          scenario={scenario}
          situation={situation}
          onUpdateCasualties={async (p) => {
            const next = await updateCasualties({
              sessionId,
              injured: p.injured,
              fatalities: p.fatalities,
              uninjured: p.uninjured,
              unknown: p.unknown,
            });
            setSituation(next);
          }}
        />
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
        {/* LEFT */}
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

          {!isMobile ? feed : null}
        </div>

        {/* MIDDLE */}
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

          <div style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 14 }}>Actions</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.55)" }}>
                {selectedItem ? <>Ready</> : <>Pick a message to act</>}
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
                <>Select a message to enable context-aware actions.</>
              ) : (
                <>Select a message to enable context-aware actions.</>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT */}
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

      {/* LOG SECTION (bottom) */}
      <div
        style={{
          background: "white",
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 16,
          padding: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <h3 style={{ margin: 0 }}>Log</h3>
          <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.55)" }}>
            {actionsLoading ? "Loading…" : `${actions.length} entries`}
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          {actionsError ? (
            <div style={{ fontSize: 12, color: "#b91c1c", fontWeight: 800 }}>{actionsError}</div>
          ) : null}

          {actionsLoading ? (
            <div style={{ fontSize: 12, opacity: 0.7 }}>Loading…</div>
          ) : actions.length === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.7 }}>No actions yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {actions.map((a) => (
                <div
                  key={a.id}
                  style={{
                    border: "1px solid rgba(0,0,0,0.10)",
                    borderRadius: 12,
                    padding: 10,
                    background: "rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 900, fontSize: 12 }}>
                      {a.action_type.toUpperCase()} <span style={{ opacity: 0.6 }}>· {a.source}</span>
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 800 }}>
                      {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
                    </div>
                  </div>
                  {a.comment ? (
                    <div style={{ marginTop: 6, fontSize: 12, whiteSpace: "pre-wrap", opacity: 0.85 }}>
                      {a.comment}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MOBILE FEED DRAWER */}
      {isMobile && feedOpen ? (
        <div
          onClick={() => setFeedOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 100,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 92vw)",
              height: "100%",
              background: "white",
              padding: 12,
              borderLeft: "1px solid rgba(0,0,0,0.10)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 950 }}>Feed</div>
              <button
                onClick={() => setFeedOpen(false)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.14)",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                Close
              </button>
            </div>
            {feed}
          </div>
        </div>
      ) : null}
    </div>
  );
}
