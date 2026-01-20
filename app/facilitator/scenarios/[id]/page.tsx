"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getMyRole } from "../../../../lib/users";
import {
  Scenario,
  ScenarioInject,
  getScenario,
  updateScenario,
  listScenarioInjects,
  createInject,
  attachInjectToScenario,
  detachScenarioInject,
  updateScenarioInject,
} from "../../../../lib/scenarios";

function asInt(v: string) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

// Build "YYYY-MM-DDTHH:MM" for <input type="datetime-local">
function makeDatetimeLocal(dateStr: string | null, timeStr: string | null) {
  const d = (dateStr ?? "").trim();
  const t = (timeStr ?? "").trim();
  if (!d && !t) return "";
  const safeD = d || "2000-01-01";
  const safeT = t || "00:00";
  const hhmm = safeT.length >= 5 ? safeT.slice(0, 5) : safeT;
  return `${safeD}T${hhmm}`;
}

// Split "YYYY-MM-DDTHH:MM" into {event_date, event_time}
function splitDatetimeLocal(v: string): { event_date: string; event_time: string } {
  if (!v) return { event_date: "", event_time: "" };
  const [d, t] = v.split("T");
  return { event_date: d ?? "", event_time: (t ?? "").slice(0, 5) };
}

export default function ScenarioEditorPage() {
  const router = useRouter();
  const params = useParams();
  const scenarioId = String(params?.id ?? "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [injects, setInjects] = useState<ScenarioInject[]>([]);

  // Injects tabs
  const [injectTab, setInjectTab] = useState<"inbox" | "pulse">("inbox");

  // Add inject form
  const [addOpen, setAddOpen] = useState(false);
  const [iTitle, setITitle] = useState("");
  const [iBody, setIBody] = useState("");
  const [iChannel, setIChannel] = useState<"ops" | "pulse">("ops");
  const [iSeverity, setISeverity] = useState<string>("info");
  const [iSenderName, setISenderName] = useState("Facilitator");
  const [iSenderOrg, setISenderOrg] = useState("Decisionary");
  const [iScheduled, setIScheduled] = useState<string>(""); // datetime-local

  const sortedInjects = useMemo(() => {
    return [...injects].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  }, [injects]);

  // For now:
  // - Pulse tab shows channel === "pulse"
  // - Inbox tab shows everything else (including any legacy "media/social" you might already have)
  const inboxInjects = useMemo(() => {
    return sortedInjects.filter((si) => (si.injects?.channel ?? "") !== "pulse");
  }, [sortedInjects]);

  const pulseInjects = useMemo(() => {
    return sortedInjects.filter((si) => (si.injects?.channel ?? "") === "pulse");
  }, [sortedInjects]);

  const visibleInjects = injectTab === "pulse" ? pulseInjects : inboxInjects;

  /* ================= AUTH GUARD + LOAD ================= */

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

      setLoading(true);
      setError(null);

      const s = await getScenario(scenarioId);
      if (!s) {
        setScenario(null);
        setInjects([]);
        setError("Scenario not found.");
        setLoading(false);
        return;
      }

      const si = await listScenarioInjects(scenarioId);
      setScenario(s);
      setInjects(si);
      setLoading(false);
    })().catch((e: any) => {
      setError(e?.message ?? String(e));
      setLoading(false);
    });
  }, [router, scenarioId]);

  async function reloadInjects() {
    const si = await listScenarioInjects(scenarioId);
    setInjects(si);
  }

  /* ================= SAVE SCENARIO ================= */

  async function onSaveScenario() {
    if (!scenario) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateScenario(scenario.id, {
        title: scenario.title,
        description: scenario.description,

        event_date: scenario.event_date,
        event_time: scenario.event_time,
        timezone: scenario.timezone,
        location: scenario.location,
        situation_type: scenario.situation_type,
        short_description: scenario.short_description,

        injured: scenario.injured,
        fatalities: scenario.fatalities,
        uninjured: scenario.uninjured,
        unknown: scenario.unknown,
      });

      setScenario(updated);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  /* ================= INJECTS ================= */

  function openAddInject() {
    // Keep creation aligned with tab:
    // inbox -> ops, pulse -> pulse
    setIChannel(injectTab === "pulse" ? "pulse" : "ops");
    setAddOpen(true);
  }

  function closeAddInject() {
    setAddOpen(false);
  }

  async function onAddInject() {
    if (!iTitle.trim() || !iBody.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const inj = await createInject({
        title: iTitle.trim(),
        body: iBody.trim(),
        channel: iChannel, // only "ops" or "pulse"
        severity: iSeverity || null,
        sender_name: iSenderName.trim() || "Facilitator",
        sender_org: iSenderOrg.trim() || "Decisionary",
      });

      const scheduled_at = iScheduled ? new Date(iScheduled).toISOString() : null;

      const attached = await attachInjectToScenario({
        scenarioId,
        injectId: inj.id,
        scheduled_at,
      });

      setInjects((prev) => [...prev, attached]);
      setAddOpen(false);

      // reset form (keep channel aligned with current tab)
      setITitle("");
      setIBody("");
      setIChannel(injectTab === "pulse" ? "pulse" : "ops");
      setISeverity("info");
      setISenderName("Facilitator");
      setISenderOrg("Decisionary");
      setIScheduled("");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  async function onDetach(scenarioInjectId: string) {
    if (!confirm("Remove this inject from scenario?")) return;
    setSaving(true);
    setError(null);
    try {
      await detachScenarioInject(scenarioInjectId);
      setInjects((prev) => prev.filter((x) => x.id !== scenarioInjectId));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  async function onMoveWithin(list: ScenarioInject[], id: string, dir: -1 | 1) {
  const idx = list.findIndex((x) => x.id === id);
  if (idx < 0) return;

  const swapIdx = idx + dir;
  if (swapIdx < 0 || swapIdx >= list.length) return;

  const a = list[idx];
  const b = list[swapIdx];

  // Treat order_index <= 0 as "missing"
  const aHas = typeof a.order_index === "number" && a.order_index > 0;
  const bHas = typeof b.order_index === "number" && b.order_index > 0;

  // If we detect legacy/broken data (0), normalize all injects for this scenario once.
  if (!aHas || !bHas) {
    setSaving(true);
    setError(null);
    try {
      // normalize using current sortedInjects order (created_at/order_index)
      const all = [...sortedInjects];

      // Phase 1: put temp unique indices to avoid collisions
      for (let i = 0; i < all.length; i++) {
        const tempOrder = 1000000000 + i;
        await updateScenarioInject({ id: all[i].id, order_index: tempOrder });
      }

      // Phase 2: assign clean 1..N
      for (let i = 0; i < all.length; i++) {
        await updateScenarioInject({ id: all[i].id, order_index: i + 1 });
      }

      await reloadInjects(); // refresh state after normalization
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
    return; // user clicks arrow again (now it will work)
  }

  const aOrder = a.order_index;
  const bOrder = b.order_index;

  // temp order_index avoids UNIQUE collisions
  const tempOrder = 1000000000 + Math.floor(Math.random() * 1000000);

  setSaving(true);
  setError(null);

  try {
    await updateScenarioInject({ id: a.id, order_index: tempOrder });
    await updateScenarioInject({ id: b.id, order_index: aOrder });
    await updateScenarioInject({ id: a.id, order_index: bOrder });

    setInjects((prev) =>
      prev.map((x) => {
        if (x.id === a.id) return { ...x, order_index: bOrder };
        if (x.id === b.id) return { ...x, order_index: aOrder };
        return x;
      })
    );
  } catch (e: any) {
    setError(e?.message ?? String(e));
    await reloadInjects();
  } finally {
    setSaving(false);
  }
}


  async function onSchedule(id: string, datetimeLocalValue: string) {
    setSaving(true);
    setError(null);
    try {
      const scheduled_at = datetimeLocalValue ? new Date(datetimeLocalValue).toISOString() : null;
      await updateScenarioInject({ id, scheduled_at });

      setInjects((prev) =>
        prev.map((x) => (x.id === id ? { ...x, scheduled_at } : x))
      );
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  /* ================= UI ================= */

  if (loading) {
    return (
      <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>
        <p>Loading…</p>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>
        <button onClick={() => router.push("/facilitator/scenarios")}>← Back to scenarios</button>
        {error && <p style={{ marginTop: 10, color: "#b91c1c" }}>{error}</p>}
      </div>
    );
  }

  const eventDT = makeDatetimeLocal(scenario.event_date ?? null, scenario.event_time ?? null);

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <button onClick={() => router.push("/facilitator/scenarios")}>← Back to scenarios</button>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginTop: 10 }}>Scenario Editor</h1>
          <p style={{ opacity: 0.75, marginTop: 6 }}>Configure situation and injects.</p>
        </div>

        <button onClick={onSaveScenario} disabled={saving} style={{ padding: "10px 14px" }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {error && <p style={{ marginTop: 12, color: "#b91c1c" }}>{error}</p>}

      {/* ======= SITUATION ======= */}
      <div style={{ marginTop: 16, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, padding: 14 }}>
        <h2 style={{ fontWeight: 800, marginBottom: 10 }}>Scenario</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Title</label>
            <input
              value={scenario.title ?? ""}
              onChange={(e) => setScenario({ ...scenario, title: e.target.value })}
              style={{ width: "100%", padding: 10 }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Situation type</label>
            <input
              value={scenario.situation_type ?? ""}
              onChange={(e) => setScenario({ ...scenario, situation_type: e.target.value })}
              placeholder="e.g. Aircraft accident / Cyber incident"
              style={{ width: "100%", padding: 10 }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Location</label>
            <input
              value={scenario.location ?? ""}
              onChange={(e) => setScenario({ ...scenario, location: e.target.value })}
              placeholder="e.g. WAW / Warsaw / HQ"
              style={{ width: "100%", padding: 10 }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Timezone</label>
            <input
              value={scenario.timezone ?? ""}
              onChange={(e) => setScenario({ ...scenario, timezone: e.target.value })}
              placeholder="e.g. Europe/Warsaw"
              style={{ width: "100%", padding: 10 }}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", marginBottom: 6 }}>Event date & time</label>
            <input
              type="datetime-local"
              value={eventDT}
              onChange={(e) => {
                const { event_date, event_time } = splitDatetimeLocal(e.target.value);
                setScenario({
                  ...scenario,
                  event_date: event_date || null,
                  event_time: event_time || null,
                });
              }}
              style={{ padding: 10, width: "100%", maxWidth: 360 }}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", marginBottom: 6 }}>Short description</label>
            <textarea
              value={scenario.short_description ?? ""}
              onChange={(e) => setScenario({ ...scenario, short_description: e.target.value })}
              rows={3}
              style={{ width: "100%", padding: 10 }}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", marginBottom: 6 }}>Notes / description</label>
            <textarea
              value={scenario.description ?? ""}
              onChange={(e) => setScenario({ ...scenario, description: e.target.value })}
              rows={3}
              style={{ width: "100%", padding: 10 }}
            />
          </div>
        </div>

        <h3 style={{ fontWeight: 800, marginTop: 14, marginBottom: 8 }}>Casualties</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Injured</label>
            <input
              value={scenario.injured ?? 0}
              onChange={(e) => setScenario({ ...scenario, injured: asInt(e.target.value) })}
              style={{ width: "100%", padding: 10 }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Fatalities</label>
            <input
              value={scenario.fatalities ?? 0}
              onChange={(e) => setScenario({ ...scenario, fatalities: asInt(e.target.value) })}
              style={{ width: "100%", padding: 10 }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Uninjured</label>
            <input
              value={scenario.uninjured ?? 0}
              onChange={(e) => setScenario({ ...scenario, uninjured: asInt(e.target.value) })}
              style={{ width: "100%", padding: 10 }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Unknown</label>
            <input
              value={scenario.unknown ?? 0}
              onChange={(e) => setScenario({ ...scenario, unknown: asInt(e.target.value) })}
              style={{ width: "100%", padding: 10 }}
            />
          </div>
        </div>
      </div>

      {/* ======= INJECTS ======= */}
      <div style={{ marginTop: 16, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontWeight: 800 }}>Injects</h2>
          <button onClick={() => (addOpen ? closeAddInject() : openAddInject())} style={{ padding: "9px 12px" }}>
            {addOpen ? "Close" : "Add inject"}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setInjectTab("inbox")}
            style={{
              padding: "8px 10px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.14)",
              background: injectTab === "inbox" ? "rgba(0,0,0,0.06)" : "transparent",
            }}
          >
            Inbox ({inboxInjects.length})
          </button>

          <button
            type="button"
            onClick={() => setInjectTab("pulse")}
            style={{
              padding: "8px 10px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.14)",
              background: injectTab === "pulse" ? "rgba(0,0,0,0.06)" : "transparent",
            }}
          >
            Pulse ({pulseInjects.length})
          </button>
        </div>

        {addOpen && (
          <div style={{ marginTop: 12, border: "1px solid rgba(0,0,0,0.10)", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Title</label>
                <input value={iTitle} onChange={(e) => setITitle(e.target.value)} style={{ width: "100%", padding: 10 }} />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Destination</label>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIChannel("ops");
                      setInjectTab("inbox");
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.14)",
                      background: iChannel === "ops" ? "rgba(0,0,0,0.06)" : "transparent",
                    }}
                  >
                    Inbox
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIChannel("pulse");
                      setInjectTab("pulse");
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.14)",
                      background: iChannel === "pulse" ? "rgba(0,0,0,0.06)" : "transparent",
                    }}
                  >
                    Pulse
                  </button>
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", marginBottom: 6 }}>Body</label>
                <textarea value={iBody} onChange={(e) => setIBody(e.target.value)} rows={4} style={{ width: "100%", padding: 10 }} />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Severity</label>
                <input value={iSeverity} onChange={(e) => setISeverity(e.target.value)} placeholder="info / low / high" style={{ width: "100%", padding: 10 }} />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Scheduled (optional)</label>
                <input type="datetime-local" value={iScheduled} onChange={(e) => setIScheduled(e.target.value)} style={{ width: "100%", padding: 10 }} />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Sender name</label>
                <input value={iSenderName} onChange={(e) => setISenderName(e.target.value)} style={{ width: "100%", padding: 10 }} />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Sender org</label>
                <input value={iSenderOrg} onChange={(e) => setISenderOrg(e.target.value)} style={{ width: "100%", padding: 10 }} />
              </div>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
              <button onClick={onAddInject} disabled={saving} style={{ padding: "9px 12px" }}>
                {saving ? "…" : "Create & attach"}
              </button>
              <button onClick={closeAddInject} style={{ padding: "9px 12px" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          {visibleInjects.length === 0 ? (
            <p style={{ opacity: 0.75 }}>
              No {injectTab === "pulse" ? "pulse" : "inbox"} injects yet.
            </p>
          ) : (
            <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, overflow: "hidden" }}>
              {visibleInjects.map((si, index) => {
                const inj = si.injects;
                const localValue = si.scheduled_at ? new Date(si.scheduled_at).toISOString().slice(0, 16) : "";
                const isPulse = (inj?.channel ?? "") === "pulse";

                return (
                  <div
                    key={si.id}
                    style={{
                      padding: 12,
                      borderBottom: "1px solid rgba(0,0,0,0.08)",
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 10,
                      alignItems: "start",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <strong>{inj?.title ?? "(no title)"}</strong>
                        <span style={{ opacity: 0.7, fontSize: 13 }}>
                          #{index + 1} • {isPulse ? "Pulse" : "Inbox"} • {inj?.severity ?? "—"}
                        </span>
                      </div>

                      {inj?.body && (
                        <div style={{ marginTop: 8, whiteSpace: "pre-wrap", opacity: 0.9 }}>
                          {inj.body}
                        </div>
                      )}

                      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "200px 1fr", gap: 10, alignItems: "center" }}>
                        <label style={{ opacity: 0.75, fontSize: 13 }}>Scheduled</label>
                        <input
                          type="datetime-local"
                          value={localValue}
                          onChange={(e) => onSchedule(si.id, e.target.value)}
                          style={{ padding: 8, maxWidth: 260 }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => onMoveWithin(visibleInjects, si.id, -1)} disabled={saving || index === 0}>
                          ↑
                        </button>
                        <button
                          onClick={() => onMoveWithin(visibleInjects, si.id, +1)}
                          disabled={saving || index === visibleInjects.length - 1}
                        >
                          ↓
                        </button>
                      </div>

                      <button onClick={() => onDetach(si.id)} disabled={saving} style={{ color: "#b91c1c" }}>
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
