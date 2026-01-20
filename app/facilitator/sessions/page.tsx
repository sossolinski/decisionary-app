"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyRole } from "../../../lib/users";
import {
  listSessions,
  listScenarios,
  createSessionFromScenario,
  restartSession,
  setSessionStatus,
  Session,
  ScenarioListItem,
} from "../../../lib/sessionsRuntime";

export default function FacilitatorSessionsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);

  const [newScenarioId, setNewScenarioId] = useState("");
  const [newTitle, setNewTitle] = useState("");

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
  }, [router]);

  async function onCreateSession() {
    if (!newScenarioId || !newTitle.trim()) return;
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
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }

  return (
    <div style={{ maxWidth: 1000, margin: "24px auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Sessions</h1>

      {error && <p style={{ color: "#b91c1c", marginTop: 8 }}>{error}</p>}

      {/* CREATE */}
      <div style={{ marginTop: 16, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, padding: 14 }}>
        <h2 style={{ fontWeight: 700, marginBottom: 10 }}>Create session</h2>

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

          <button onClick={onCreateSession}>Create</button>
        </div>
      </div>

      {/* LIST */}
      <div style={{ marginTop: 24 }}>
        {sessions.length === 0 ? (
          <p style={{ opacity: 0.75 }}>No sessions yet.</p>
        ) : (
          <div style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, overflow: "hidden" }}>
            {sessions.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: 12,
                  borderBottom: "1px solid rgba(0,0,0,0.08)",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 10,
                }}
              >
                <div>
                  <strong>{s.title}</strong>
                  <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
                    Status: {s.status} • Join code: <b>{s.join_code}</b>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={() => router.push(`/sessions/${s.id}`)}>
                    Open
                  </button>

                  {s.status !== "live" && (
                    <button onClick={() => setSessionStatus(s.id, "live")}>
                      Start
                    </button>
                  )}

                  {s.status === "live" && (
                    <button onClick={() => setSessionStatus(s.id, "ended")}>
                      End
                    </button>
                  )}

                  <button
                    onClick={async () => {
                      if (!confirm("Restart session? This clears all runtime data.")) return;
                      await restartSession(s.id);
                      await load();
                    }}
                    style={{ color: "#b91c1c" }}
                  >
                    Restart
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
