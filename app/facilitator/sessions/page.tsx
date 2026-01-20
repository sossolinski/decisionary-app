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
  type Session,
  type ScenarioListItem,
} from "@/lib/sessionsRuntime";

export default function FacilitatorSessionsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);

  const [newScenarioId, setNewScenarioId] = useState("");
  const [newTitle, setNewTitle] = useState("");

  const canCreate = useMemo(() => {
    return !!newScenarioId && !!newTitle.trim();
  }, [newScenarioId, newTitle]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [s, sc] = await Promise.all([listSessions(), listScenarios()]);
      setSessions(s);
      setScenarios(sc);
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

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }

  return (
    <div style={{ maxWidth: 1000, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Sessions</h1>

        <button
          onClick={load}
          disabled={!!busyId}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "white",
            cursor: busyId ? "not-allowed" : "pointer",
            opacity: busyId ? 0.6 : 1,
            fontWeight: 800,
          }}
        >
          Refresh
        </button>
      </div>

      {error && <p style={{ color: "#b91c1c", marginTop: 10 }}>{error}</p>}

      {/* CREATE */}
      <div
        style={{
          marginTop: 16,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 14,
          background: "white",
        }}
      >
        <h2 style={{ fontWeight: 900, marginBottom: 10 }}>Create session</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10 }}>
          <select value={newScenarioId} onChange={(e) => setNewScenarioId(e.target.value)}>
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
          />

          <button
            onClick={onCreateSession}
            disabled={!canCreate || busyId === "create"}
            style={{
              fontWeight: 900,
              opacity: !canCreate || busyId === "create" ? 0.6 : 1,
              cursor: !canCreate || busyId === "create" ? "not-allowed" : "pointer",
            }}
          >
            {busyId === "create" ? "Creating…" : "Create"}
          </button>
        </div>
      </div>

      {/* LIST */}
      <div style={{ marginTop: 18 }}>
        {sessions.length === 0 ? (
          <p style={{ opacity: 0.75 }}>No sessions yet.</p>
        ) : (
          <div style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, overflow: "hidden" }}>
            {sessions.map((s) => {
              const isBusy = busyId === s.id;

              return (
                <div
                  key={s.id}
                  style={{
                    padding: 12,
                    borderBottom: "1px solid rgba(0,0,0,0.08)",
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    alignItems: "center",
                    background: "white",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 16 }}>{s.title}</strong>
                      <span style={{ fontSize: 12, opacity: 0.7 }}>
                        Status: <b>{s.status}</b>
                      </span>
                    </div>

                    <div style={{ fontSize: 13, opacity: 0.78, marginTop: 6 }}>
                      Join code:{" "}
                      <b style={{ letterSpacing: 0.5 }}>{s.join_code}</b>{" "}
                      <button
                        onClick={() => copy(s.join_code)}
                        style={{
                          marginLeft: 8,
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: "1px solid rgba(0,0,0,0.12)",
                          background: "white",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 800,
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

                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => router.push(`/sessions/${s.id}`)}
                      disabled={isBusy}
                      style={{ cursor: isBusy ? "not-allowed" : "pointer", opacity: isBusy ? 0.6 : 1 }}
                    >
                      Open
                    </button>

                    <button
                      onClick={() => router.push(`/facilitator/sessions/${s.id}/roster`)}
                      disabled={isBusy}
                      style={{ cursor: isBusy ? "not-allowed" : "pointer", opacity: isBusy ? 0.6 : 1 }}
                    >
                      Roster
                    </button>

                    {s.status !== "live" ? (
                      <button
                        onClick={() => onStart(s.id)}
                        disabled={isBusy}
                        style={{ cursor: isBusy ? "not-allowed" : "pointer", opacity: isBusy ? 0.6 : 1 }}
                      >
                        {isBusy ? "Working…" : "Start"}
                      </button>
                    ) : (
                      <button
                        onClick={() => onEnd(s.id)}
                        disabled={isBusy}
                        style={{ cursor: isBusy ? "not-allowed" : "pointer", opacity: isBusy ? 0.6 : 1 }}
                      >
                        {isBusy ? "Working…" : "End"}
                      </button>
                    )}

                    <button
                      onClick={() => onRestart(s.id)}
                      disabled={isBusy}
                      style={{
                        color: "#b91c1c",
                        cursor: isBusy ? "not-allowed" : "pointer",
                        opacity: isBusy ? 0.6 : 1,
                      }}
                    >
                      {isBusy ? "Working…" : "Restart"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: 12, opacity: 0.65 }}>
        Tip: share <b>Join code</b> with participants. They should open <code>/join</code> (we’ll add a “Join” button in the top nav later).
      </div>
    </div>
  );
}
