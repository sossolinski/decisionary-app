"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listScenarios,
  createScenario,
  deleteScenario,
  Scenario,
  listFacilitators,
  transferScenarioOwnership,
  shareScenario,
  revokeScenarioShare,
  FacilitatorProfile,
} from "@/lib/facilitator";
import { getMyRole } from "@/lib/users";

export default function FacilitatorScenariosPage() {
  const router = useRouter();

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [facilitators, setFacilitators] = useState<FacilitatorProfile[]>([]);

  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [shareTargetByScenario, setShareTargetByScenario] = useState<
    Record<string, string>
  >({});

  /* ================= AUTH GUARD ================= */
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
    })().catch((e: any) => setError(e?.message ?? "Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function load() {
    setError(null);
    try {
      const [scs, facs] = await Promise.all([listScenarios(), listFacilitators()]);
      setScenarios(scs);
      setFacilitators(facs ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Load failed");
    }
  }

  /* ================= ACTIONS ================= */
  async function onCreate() {
    if (!newTitle.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const s = await createScenario(newTitle.trim());
      setScenarios((prev) => [s, ...prev]);
      setNewTitle("");
    } catch (e: any) {
      setError(e?.message ?? "Create failed");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this scenario?")) return;
    setError(null);

    try {
      await deleteScenario(id);
      setScenarios((prev) => prev.filter((s) => s.id !== id));
    } catch (e: any) {
      setError(e?.message ?? "Delete failed");
    }
  }

  async function onAssign(scenarioId: string, newOwnerId: string) {
    if (!newOwnerId) return;
    setError(null);
    setAssigningId(scenarioId);

    try {
      await transferScenarioOwnership(scenarioId, newOwnerId);
      setScenarios((prev) => prev.filter((s) => s.id !== scenarioId));
    } catch (e: any) {
      setError(e?.message ?? "Assign failed");
    } finally {
      setAssigningId(null);
    }
  }

  async function onShare(scenarioId: string) {
    const targetId = shareTargetByScenario[scenarioId];
    if (!targetId) {
      setError("Select facilitator to share with.");
      return;
    }

    setError(null);
    setSharingId(scenarioId);

    try {
      await shareScenario(scenarioId, targetId, "read");
      alert("Shared (read-only).");
    } catch (e: any) {
      setError(e?.message ?? "Share failed");
    } finally {
      setSharingId(null);
    }
  }

  async function onRevoke(scenarioId: string) {
    const targetId = shareTargetByScenario[scenarioId];
    if (!targetId) {
      setError("Select facilitator to revoke.");
      return;
    }

    setError(null);
    setSharingId(scenarioId);

    try {
      await revokeScenarioShare(scenarioId, targetId);
      alert("Share revoked.");
    } catch (e: any) {
      setError(e?.message ?? "Revoke failed");
    } finally {
      setSharingId(null);
    }
  }

  /* ================= HELPERS ================= */
  const idToEmail = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of facilitators) {
      if (f.email) m.set(f.id, f.email);
    }
    return m;
  }, [facilitators]);

  function fmt(dt?: string | null) {
    if (!dt) return "—";
    try {
      return new Date(dt).toLocaleString();
    } catch {
      return dt;
    }
  }

  function who(userId?: string | null) {
    if (!userId) return "—";
    return idToEmail.get(userId) ?? userId;
  }

  /* ================= UI ================= */
  return (
    <div style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ margin: 0, marginBottom: 12 }}>Scenarios</h1>

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

      {/* CREATE */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New scenario title"
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
          onClick={onCreate}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            fontWeight: 800,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "..." : "Create"}
        </button>

        <button
          onClick={load}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {/* LIST */}
      {scenarios.length === 0 ? (
        <div style={{ opacity: 0.75 }}>No scenarios yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {scenarios.map((s) => {
            const selectedTarget = shareTargetByScenario[s.id] ?? "";

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
                    <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 4 }}>{s.title}</div>

                    <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 8 }}>
                      <div>
                        <b>Created:</b> {fmt(s.created_at)} by {who(s.created_by)}
                      </div>
                      <div>
                        <b>Updated:</b> {fmt(s.updated_at)} by {who(s.updated_by)}
                      </div>
                    </div>

                    {s.description ? (
                      <div style={{ opacity: 0.75, marginBottom: 8 }}>{s.description}</div>
                    ) : (
                      <div style={{ opacity: 0.5, marginBottom: 8, fontSize: 13 }}>
                        No description
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      onClick={() => router.push(`/facilitator/scenarios/${s.id}`)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.15)",
                        background: "white",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      Open
                    </button>

                    <button
                      onClick={() => onDelete(s.id)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(185,28,28,0.35)",
                        background: "rgba(185,28,28,0.06)",
                        color: "#b91c1c",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* ASSIGN */}
                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 700 }}>
                    Assign (transfer owner):
                  </span>
                  <select
                    defaultValue=""
                    disabled={assigningId === s.id}
                    onChange={(e) => onAssign(s.id, e.target.value)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.15)",
                      background: "white",
                      minWidth: 260,
                    }}
                  >
                    <option value="" disabled>
                      Select facilitator…
                    </option>
                    {facilitators.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.email ?? f.id}
                      </option>
                    ))}
                  </select>
                </div>

                {/* SHARE */}
                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 700 }}>
                    Share (keeps owner):
                  </span>
                  <select
                    value={selectedTarget}
                    disabled={sharingId === s.id}
                    onChange={(e) =>
                      setShareTargetByScenario((prev) => ({ ...prev, [s.id]: e.target.value }))
                    }
                    style={{
                      padding: "8px 10px",
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.15)",
                      background: "white",
                      minWidth: 260,
                    }}
                  >
                    <option value="" disabled>
                      Select facilitator…
                    </option>
                    {facilitators.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.email ?? f.id}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => onShare(s.id)}
                    disabled={sharingId === s.id}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.15)",
                      background: "white",
                      fontWeight: 800,
                    }}
                  >
                    Share
                  </button>

                  <button
                    onClick={() => onRevoke(s.id)}
                    disabled={sharingId === s.id}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.15)",
                      background: "rgba(0,0,0,0.03)",
                      fontWeight: 800,
                    }}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
