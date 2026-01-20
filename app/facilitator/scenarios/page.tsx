"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listScenarios, createScenario, deleteScenario, Scenario } from "../../../lib/facilitator";
import { getMyRole } from "../../../lib/users";

export default function FacilitatorScenariosPage() {
  const router = useRouter();

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    })().catch((e) => setError(e.message));
  }, [router]);

  async function load() {
    setError(null);
    const data = await listScenarios();
    setScenarios(data);
  }

  /* ================= ACTIONS ================= */

  async function onCreate() {
    if (!newTitle.trim()) return;
    setLoading(true);
    try {
      const s = await createScenario(newTitle.trim());
      setScenarios((prev) => [s, ...prev]);
      setNewTitle("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this scenario?")) return;
    try {
      await deleteScenario(id);
      setScenarios((prev) => prev.filter((s) => s.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  }

  /* ================= UI ================= */

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>
        Scenarios
      </h1>

      {error && (
        <p style={{ marginBottom: 12, color: "#b91c1c" }}>
          {error}
        </p>
      )}

      {/* CREATE */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 18,
        }}
      >
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New scenario title"
          style={{ flex: 1, padding: 10 }}
        />
        <button onClick={onCreate} disabled={loading}>
          {loading ? "..." : "Create"}
        </button>
      </div>

      {/* LIST */}
      <div
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {scenarios.length === 0 && (
          <p style={{ padding: 14, opacity: 0.7 }}>
            No scenarios yet.
          </p>
        )}

        {scenarios.map((s) => (
          <div
            key={s.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 14,
              borderBottom: "1px solid rgba(0,0,0,0.08)",
            }}
          >
            <div>
              <strong>{s.title}</strong>
              {s.description && (
                <div style={{ fontSize: 13, opacity: 0.75 }}>
                  {s.description}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => router.push(`/facilitator/scenarios/${s.id}`)}
              >
                Open
              </button>
              <button
                onClick={() => onDelete(s.id)}
                style={{ color: "#b91c1c" }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
