"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyRole } from "@/lib/users";
import {
  listSessions,
  listScenarios,
  createSessionFromScenario,
  restartSession,
  setSessionStatus,
  deleteSession,
  type Session,
  type ScenarioListItem,
} from "@/lib/sessionsRuntime";
import { listFacilitators, type FacilitatorProfile } from "@/lib/facilitator";

export default function FacilitatorSessionsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [facilitators, setFacilitators] = useState<FacilitatorProfile[]>([]);

  const [newScenarioId, setNewScenarioId] = useState("");
  const [newTitle, setNewTitle] = useState("");

  const canCreate = useMemo(() => {
    return !!newScenarioId && !!newTitle.trim();
  }, [newScenarioId, newTitle]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [s, sc, facs] = await Promise.all([
        listSessions(),
        listScenarios(),
        listFacilitators(),
      ]);
      setSessions(s);
      setScenarios(sc);
      setFacilitators(facs ?? []);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const role = await getMyRole();
      if (!role) {
        router.replace("/login");
        return;
      }
      if (role !== "facilitator") {
        router.replace("/participant");
        return;
      }
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  /* ================= HELPERS ================= */
  const idToEmail = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of facilitators) {
      if (f.email) m.set(f.id, f.email);
    }
    return m;
  }, [facilitators]);

  function who(userId?: string | null) {
    if (!userId) return "—";
    return idToEmail.get(userId) ?? userId;
  }

  function fmt(dt?: string | null) {
    if (!dt) return "—";
    try {
      return new Date(dt).toLocaleString();
    } catch {
      return dt;
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
  }

  /* ================= ACTIONS ================= */
  async function onCreateSession() {
    if (!canCreate) return;

    setBusyId("create");
    setError(null);
    try {
      await createSessionFromScenario({
        scenarioId: newScenarioId,
        title: newTitle.trim(),
      });
      setNewScenarioId("");
      setNewTitle("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function onStart(sessionId: string) {
    setBusyId(sessionId);
    setError(null);
    try {
      await setSessionStatus(sessionId, "live");
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function onEnd(sessionId: string) {
    setBusyId(sessionId);
    setError(null);
    try {
      await setSessionStatus(sessionId, "ended");
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function onRestart(sessionId: string) {
    if (!confirm("Restart session? This clears all runtime data.")) return;

    setBusyId(sessionId);
    setError(null);
    try {
      await restartSession(sessionId);
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(sessionId: string) {
    if (!confirm("Delete this session? This will remove runtime data.")) return;

    setBusyId(sessionId);
    setError(null);
    try {
      await deleteSession(sessionId);
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "baseline",
          marginBottom: 12,
        }}
      >
        <h1 style={{ margin: 0 }}>Sessions</h1>

        <button
          onClick={load}
          disabled={!!busyId}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            fontWeight: 800,
            cursor: busyId ? "not-allowed" : "pointer",
            opacity: busyId ? 0.6 : 1,
          }}
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(239,68,68,0.35)",
            background: "rgba(239,68,68,0.06)",
            color: "#991b1b",
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      ) : null}

      {/* CREATE (stylistycznie jak w Scenarios) */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <select
          value={newScenarioId}
          onChange={(e) => setNewScenarioId(e.target.value)}
          style={{
            flex: 1,
            minWidth: 260,
            padding: 10,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
          }}
        >
          <option value="">Select scenario…</option>
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>

        <input
          placeholder="Session title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          style={{
            flex: 1,
            minWidth: 240,
            padding: 10,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
          }}
        />

        <button
          onClick={onCreateSession}
          disabled={!canCreate || busyId === "create"}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            fontWeight: 800,
            cursor: !canCreate || busyId === "create" ? "not-allowed" : "pointer",
            opacity: !canCreate || busyId === "create" ? 0.6 : 1,
          }}
        >
          {busyId === "create" ? "..." : "Create"}
        </button>
      </div>

      {/* LIST (karty jak w Scenarios) */}
      {sessions.length === 0 ? (
        <div style={{ opacity: 0.75 }}>No sessions yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {sessions.map((s: any) => {
            const isBusy = busyId === s.id;

            const createdAt = fmt(s.created_at);
            const createdBy = who(s.created_by);

            const startedAt = fmt(s.started_at ?? null);
            const endedAt = fmt(s.ended_at ?? null);

            return (
              <div
                key={s.id}
                style={{
                  padding: 14,
                  borderRadius: 16,
                  border: "1px solid rgba(0,0,0,0.10)",
                  background: "rgba(255,255,255,0.92)",
                  boxShadow: "0 12px 28px rgba(11,18,32,0.06)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 4 }}>
                      {s.title ?? "Untitled session"}
                      <span style={{ opacity: 0.6, fontWeight: 800 }}> · {String(s.status ?? "—")}</span>
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 8 }}>
                      <div>
                        <b>Created:</b> {createdAt} by {createdBy}
                      </div>
                      <div>
                        <b>Started:</b> {startedAt}
                      </div>
                      <div>
                        <b>Ended:</b> {endedAt}
                      </div>
                    </div>

                    <div style={{ fontSize: 13, opacity: 0.78, marginTop: 6 }}>
                      Join code:{" "}
                      <b style={{ letterSpacing: 0.5 }}>{s.join_code}</b>{" "}
                      <button
                        onClick={() => copy(s.join_code)}
                        disabled={isBusy}
                        style={{
                          marginLeft: 8,
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: "1px solid rgba(0,0,0,0.12)",
                          background: "white",
                          cursor: isBusy ? "not-allowed" : "pointer",
                          fontSize: 12,
                          fontWeight: 800,
                          opacity: isBusy ? 0.6 : 1,
                        }}
                        title="Copy join code"
                      >
                        Copy
                      </button>
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
                      Session ID: <code>{s.id}</code>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      onClick={() => router.push(`/sessions/${s.id}`)}
                      disabled={isBusy}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.15)",
                        background: "white",
                        fontWeight: 800,
                        cursor: isBusy ? "not-allowed" : "pointer",
                        opacity: isBusy ? 0.6 : 1,
                      }}
                    >
                      Open
                    </button>

                    <button
                      onClick={() => router.push(`/facilitator/sessions/${s.id}/roster`)}
                      disabled={isBusy}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.15)",
                        background: "white",
                        fontWeight: 800,
                        cursor: isBusy ? "not-allowed" : "pointer",
                        opacity: isBusy ? 0.6 : 1,
                      }}
                    >
                      Roster
                    </button>

                    {s.status !== "live" ? (
                      <button
                        onClick={() => onStart(s.id)}
                        disabled={isBusy}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 12,
                          border: "1px solid rgba(0,0,0,0.15)",
                          background: "white",
                          fontWeight: 800,
                          cursor: isBusy ? "not-allowed" : "pointer",
                          opacity: isBusy ? 0.6 : 1,
                        }}
                      >
                        {isBusy ? "..." : "Start"}
                      </button>
                    ) : (
                      <button
                        onClick={() => onEnd(s.id)}
                        disabled={isBusy}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 12,
                          border: "1px solid rgba(0,0,0,0.15)",
                          background: "white",
                          fontWeight: 800,
                          cursor: isBusy ? "not-allowed" : "pointer",
                          opacity: isBusy ? 0.6 : 1,
                        }}
                      >
                        {isBusy ? "..." : "End"}
                      </button>
                    )}

                    <button
                      onClick={() => onRestart(s.id)}
                      disabled={isBusy}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.15)",
                        background: "rgba(0,0,0,0.03)",
                        fontWeight: 800,
                        cursor: isBusy ? "not-allowed" : "pointer",
                        opacity: isBusy ? 0.6 : 1,
                      }}
                    >
                      {isBusy ? "..." : "Restart"}
                    </button>

                    <button
                      onClick={() => onDelete(s.id)}
                      disabled={isBusy}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(185,28,28,0.35)",
                        background: "rgba(185,28,28,0.06)",
                        color: "#b91c1c",
                        fontWeight: 900,
                        cursor: isBusy ? "not-allowed" : "pointer",
                        opacity: isBusy ? 0.6 : 1,
                      }}
                    >
                      {isBusy ? "..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 14, fontSize: 12, opacity: 0.65 }}>
        Tip: share <b>Join code</b> with participants. They should open <code>/join</code>.
      </div>
    </div>
  );
}
