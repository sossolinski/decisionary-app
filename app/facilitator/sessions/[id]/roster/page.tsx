"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import { getMyRole } from "@/lib/users";

// Zakładam, że dopisałeś te funkcje do lib/sessionsRuntime.ts zgodnie z naszym krokiem 2.
// Jeśli nazwy masz inne — podmień importy.
import {
  ensureSessionRoleSlots,
  listSessionParticipants,
  listSessionRoleAssignments,
  assignUserToSessionRole,
} from "@/lib/sessionsRuntime";

type ProfileLite = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  display_name?: string | null;
};

function labelForProfile(p?: ProfileLite | null) {
  if (!p) return "Unknown user";
  return (
    p.display_name ||
    p.full_name ||
    p.email ||
    `${p.id.slice(0, 8)}…`
  );
}

export default function SessionRosterPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const sessionId = params?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [busyRoleId, setBusyRoleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // participants
  const [participants, setParticipants] = useState<
    { user_id: string; joined_at: string }[]
  >([]);

  // profiles map (user_id -> profile)
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});

  // assignments rows (join z scenario_roles)
  const [assignments, setAssignments] = useState<any[]>([]);

  const participantOptions = useMemo(() => {
    // sort: display name then join time
    const rows = participants
      .map((p) => ({
        userId: p.user_id,
        joinedAt: p.joined_at,
        label: labelForProfile(profiles[p.user_id]),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return rows;
  }, [participants, profiles]);

  async function loadAll() {
    if (!sessionId) return;
    setLoading(true);
    setError(null);

    try {
      // facilitator guard
      const role = await getMyRole();
      if (!role) {
        router.replace("/login");
        return;
      }
      if (role !== "facilitator") {
        router.replace("/participant");
        return;
      }

      // ensure slots exist (idempotent)
      await ensureSessionRoleSlots(sessionId);

      // participants (who joined)
      const parts = await listSessionParticipants(sessionId);
      setParticipants(parts.map((p: any) => ({ user_id: p.user_id, joined_at: p.joined_at })));

      // fetch profiles for nicer dropdown labels
      const userIds = Array.from(new Set(parts.map((p: any) => p.user_id)));
      if (userIds.length > 0) {
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("id, email, full_name, display_name")
          .in("id", userIds);

        if (pErr) throw pErr;

        const map: Record<string, ProfileLite> = {};
        (profs ?? []).forEach((p: any) => {
          map[p.id] = p;
        });
        setProfiles(map);
      } else {
        setProfiles({});
      }

      // assignments (slots + scenario role info)
      const rows = await listSessionRoleAssignments(sessionId);
      // sort by scenario_roles.sort_order then name
      const sorted = [...rows].sort((a: any, b: any) => {
        const ao = a.scenario_roles?.sort_order ?? 1000;
        const bo = b.scenario_roles?.sort_order ?? 1000;
        if (ao !== bo) return ao - bo;
        const an = a.scenario_roles?.role_name ?? "";
        const bn = b.scenario_roles?.role_name ?? "";
        return an.localeCompare(bn);
      });
      setAssignments(sorted);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function onAssign(scenarioRoleId: string, userId: string | null) {
    if (!sessionId) return;
    setBusyRoleId(scenarioRoleId);
    setError(null);

    try {
      await assignUserToSessionRole({
        sessionId,
        scenarioRoleId,
        userId,
      });

      // refresh assignments only (fast)
      const rows = await listSessionRoleAssignments(sessionId);
      const sorted = [...rows].sort((a: any, b: any) => {
        const ao = a.scenario_roles?.sort_order ?? 1000;
        const bo = b.scenario_roles?.sort_order ?? 1000;
        if (ao !== bo) return ao - bo;
        const an = a.scenario_roles?.role_name ?? "";
        const bn = b.scenario_roles?.role_name ?? "";
        return an.localeCompare(bn);
      });
      setAssignments(sorted);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyRoleId(null);
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading roster…</div>;
  }

  return (
    <div style={{ maxWidth: 1000, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Roster</h1>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>
            Assign participants to scenario roles for this session.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => router.push(`/sessions/${sessionId}`)}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "white",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Back to room
          </button>

          <button
            onClick={loadAll}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "white",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 12, color: "#b91c1c" }}>
          {error}
        </div>
      )}

      {/* Participants panel */}
      <div
        style={{
          marginTop: 16,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 14,
          background: "white",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Participants</div>
        {participants.length === 0 ? (
          <div style={{ opacity: 0.75 }}>
            Nobody joined yet. Share the join code and ask participants to join first.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {participants
              .slice()
              .sort((a, b) =>
                labelForProfile(profiles[a.user_id]).localeCompare(labelForProfile(profiles[b.user_id]))
              )
              .map((p) => (
                <div key={p.user_id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>{labelForProfile(profiles[p.user_id])}</div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>
                    Joined: {new Date(p.joined_at).toLocaleString()}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Roles / Assignments */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Role assignments</div>

        {assignments.length === 0 ? (
          <div style={{ opacity: 0.75 }}>
            No scenario roles found. Add roles in the scenario editor first.
          </div>
        ) : (
          <div style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, overflow: "hidden" }}>
            {assignments.map((row: any) => {
              const role = row.scenario_roles;
              const roleId = role?.id as string;
              const roleName = role?.role_name ?? "Role";
              const roleKey = role?.role_key ?? "";
              const required = !!role?.is_required;

              const assignedUserId = row.user_id as string | null;
              const assignedLabel = assignedUserId
                ? labelForProfile(profiles[assignedUserId]) || `${assignedUserId.slice(0, 8)}…`
                : "Unassigned";

              const disabled = busyRoleId === roleId;

              return (
                <div
                  key={row.id}
                  style={{
                    padding: 12,
                    borderBottom: "1px solid rgba(0,0,0,0.08)",
                    display: "grid",
                    gridTemplateColumns: "1fr 340px",
                    gap: 12,
                    alignItems: "center",
                    background: "white",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800 }}>{roleName}</div>

                      {required ? (
                        <span
                          style={{
                            fontSize: 12,
                            padding: "2px 8px",
                            borderRadius: 999,
                            border: "1px solid rgba(0,0,0,0.12)",
                            opacity: 0.85,
                          }}
                        >
                          REQUIRED
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 12,
                            padding: "2px 8px",
                            borderRadius: 999,
                            border: "1px solid rgba(0,0,0,0.12)",
                            opacity: 0.65,
                          }}
                        >
                          OPTIONAL
                        </span>
                      )}

                      {roleKey ? (
                        <span style={{ fontSize: 12, opacity: 0.65 }}>
                          key: <code>{roleKey}</code>
                        </span>
                      ) : null}
                    </div>

                    {role?.role_description ? (
                      <div style={{ marginTop: 6, opacity: 0.75 }}>
                        {role.role_description}
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, opacity: 0.55 }}>
                        (no description)
                      </div>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                    <select
                      value={assignedUserId ?? ""}
                      disabled={disabled}
                      onChange={(e) => onAssign(roleId, e.target.value ? e.target.value : null)}
                      style={{
                        width: "100%",
                        padding: "10px 10px",
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.15)",
                        background: disabled ? "rgba(0,0,0,0.03)" : "white",
                        cursor: disabled ? "not-allowed" : "pointer",
                      }}
                    >
                      <option value="">{participants.length ? "Unassigned" : "Unassigned (no participants)"}</option>
                      {participantOptions.map((p) => (
                        <option key={p.userId} value={p.userId}>
                          {p.label}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => onAssign(roleId, null)}
                      disabled={disabled || !assignedUserId}
                      style={{
                        padding: "10px 10px",
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.15)",
                        background: "white",
                        cursor: disabled || !assignedUserId ? "not-allowed" : "pointer",
                        opacity: disabled || !assignedUserId ? 0.5 : 1,
                        whiteSpace: "nowrap",
                      }}
                      title={`Clear assignment (currently: ${assignedLabel})`}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: 12, opacity: 0.65 }}>
        Tip: participants must join first (join code) before you can assign them to roles (MVP).
      </div>
    </div>
  );
}
