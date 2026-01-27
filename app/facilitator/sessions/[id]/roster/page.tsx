"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import { getMyRole } from "@/lib/users";
import {
  ensureSessionRoleSlots,
  listSessionParticipants,
  assignUserToSessionRole,
} from "@/lib/sessionsRuntime";

type ProfileLite = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  display_name?: string | null;
};

type ScenarioRole = {
  id: string;
  scenario_id: string;
  role_key: string;
  role_name: string | null;
  role_description: string | null;
  is_required: boolean | null;
  sort_order: number | null;
};

function labelForProfile(p?: ProfileLite | null) {
  if (!p) return "Unknown user";
  return (
    p.display_name ||
    p.full_name ||
    p.email ||
    (p.id ? `${p.id.slice(0, 8)}…` : "Unknown user")
  );
}

export default function SessionRosterPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const sessionId = params?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [busyRoleKey, setBusyRoleKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // participants
  const [participants, setParticipants] = useState<
    { user_id: string; joined_at: string | null }[]
  >([]);

  // profiles map (user_id -> profile)
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});

  // scenario roles
  const [roles, setRoles] = useState<ScenarioRole[]>([]);

  // assignments map: role_key -> user_id
  const [assignmentByRoleKey, setAssignmentByRoleKey] = useState<
    Record<string, string | null>
  >({});

  const participantOptions = useMemo(() => {
    return participants
      .map((p) => ({
        userId: p.user_id,
        joinedAt: p.joined_at,
        label: labelForProfile(profiles[p.user_id]),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
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

      // ensure slots exist (idempotent; if RPC missing, it no-ops)
      await ensureSessionRoleSlots(sessionId);

      // read session -> scenario_id
      const { data: sess, error: sErr } = await supabase
        .from("sessions")
        .select("id, scenario_id")
        .eq("id", sessionId)
        .maybeSingle();

      if (sErr) throw sErr;
      const scenarioId = (sess as any)?.scenario_id as string | null;

      // roles from scenario
      if (scenarioId) {
        const { data: r, error: rErr } = await supabase
          .from("scenario_roles")
          .select(
            "id, scenario_id, role_key, role_name, role_description, is_required, sort_order"
          )
          .eq("scenario_id", scenarioId);

        if (rErr) throw rErr;

        const sorted = ((r ?? []) as ScenarioRole[]).slice().sort((a, b) => {
          const ao = a.sort_order ?? 1000;
          const bo = b.sort_order ?? 1000;
          if (ao !== bo) return ao - bo;
          return (a.role_name ?? "").localeCompare(b.role_name ?? "");
        });

        setRoles(sorted);
      } else {
        setRoles([]);
      }

      // participants (who joined)
      const parts = await listSessionParticipants(sessionId);
      const cleanParts = (parts ?? []).map((p: any) => ({
        user_id: p.user_id,
        joined_at: p.joined_at ?? null,
      }));
      setParticipants(cleanParts);

      // fetch profiles for nicer dropdown labels
      const userIds = Array.from(new Set(cleanParts.map((p) => p.user_id)));
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

      // assignments
      const { data: aRows, error: aErr } = await supabase
        .from("session_role_assignments")
        .select("role_key, user_id")
        .eq("session_id", sessionId);

      if (aErr) throw aErr;

      const amap: Record<string, string | null> = {};
      (aRows ?? []).forEach((row: any) => {
        amap[row.role_key] = row.user_id ?? null;
      });
      setAssignmentByRoleKey(amap);
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

  async function refreshAssignmentsOnly() {
    if (!sessionId) return;
    const { data: aRows, error: aErr } = await supabase
      .from("session_role_assignments")
      .select("role_key, user_id")
      .eq("session_id", sessionId);

    if (aErr) throw aErr;

    const amap: Record<string, string | null> = {};
    (aRows ?? []).forEach((row: any) => {
      amap[row.role_key] = row.user_id ?? null;
    });
    setAssignmentByRoleKey(amap);
  }

  async function onAssign(roleKey: string, userId: string) {
    if (!sessionId) return;

    setBusyRoleKey(roleKey);
    setError(null);

    try {
      // IMPORTANT: userId must be string (not null) – fixes Vercel TS build
      await assignUserToSessionRole({
        sessionId,
        roleKey,
        userId,
      });

      await refreshAssignmentsOnly();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyRoleKey(null);
    }
  }

  async function onClear(roleKey: string) {
    if (!sessionId) return;

    setBusyRoleKey(roleKey);
    setError(null);

    try {
      const { error: dErr } = await supabase
        .from("session_role_assignments")
        .delete()
        .eq("session_id", sessionId)
        .eq("role_key", roleKey);

      if (dErr) throw dErr;

      await refreshAssignmentsOnly();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyRoleKey(null);
    }
  }

  if (loading) {
    return <div style={{ padding: 16 }}>Loading roster…</div>;
  }

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h1 style={{ margin: 0 }}>Roster</h1>

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
          onClick={() => loadAll()}
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

      <p style={{ marginTop: 6, opacity: 0.75 }}>
        Assign participants to scenario roles for this session.
      </p>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 12,
            background: "#fee2e2",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: 14,
          marginTop: 14,
        }}
      >
        {/* Participants */}
        <div
          style={{
            background: "white",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 14,
            padding: 12,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Participants</h2>

          {participants.length === 0 ? (
            <div style={{ opacity: 0.75 }}>
              Nobody joined yet. Share the join code and ask participants to join
              first.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {participants
                .slice()
                .sort((a, b) =>
                  labelForProfile(profiles[a.user_id]).localeCompare(
                    labelForProfile(profiles[b.user_id])
                  )
                )
                .map((p) => (
                  <div
                    key={p.user_id}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.12)",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>
                      {labelForProfile(profiles[p.user_id])}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      Joined:{" "}
                      {p.joined_at
                        ? new Date(p.joined_at).toLocaleString()
                        : "(unknown)"}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>
                      {p.user_id}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Roles */}
        <div
          style={{
            background: "white",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 14,
            padding: 12,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Role assignments</h2>

          {roles.length === 0 ? (
            <div style={{ opacity: 0.75 }}>
              No scenario roles found. Add roles in the scenario editor first.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {roles.map((role) => {
                const roleKey = role.role_key;
                const roleName = role.role_name ?? "Role";
                const required = !!role.is_required;

                const assignedUserId = assignmentByRoleKey[roleKey] ?? null;
                const assignedLabel = assignedUserId
                  ? labelForProfile(profiles[assignedUserId]) ||
                    `${assignedUserId.slice(0, 8)}…`
                  : "Unassigned";

                const disabled = busyRoleKey === roleKey;

                return (
                  <div
                    key={roleKey}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      border: "1px solid rgba(0,0,0,0.12)",
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 900, fontSize: 16 }}>
                        {roleName}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {required ? "REQUIRED" : "OPTIONAL"}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        key: <code>{roleKey}</code>
                      </div>
                    </div>

                    <div style={{ marginTop: 6, opacity: 0.8 }}>
                      {role.role_description?.trim()
                        ? role.role_description
                        : "(no description)"}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 10,
                        alignItems: "center",
                        marginTop: 10,
                      }}
                    >
                      <select
                        value={assignedUserId ?? ""}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (!next) return; // don't send null/empty to assignUserToSessionRole
                          onAssign(roleKey, next);
                        }}
                        disabled={disabled || participants.length === 0}
                        style={{
                          width: "100%",
                          padding: "10px 10px",
                          borderRadius: 12,
                          border: "1px solid rgba(0,0,0,0.15)",
                          background: disabled
                            ? "rgba(0,0,0,0.03)"
                            : "white",
                          cursor:
                            disabled || participants.length === 0
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        <option value="">
                          {participants.length
                            ? "Unassigned"
                            : "Unassigned (no participants)"}
                        </option>
                        {participantOptions.map((p) => (
                          <option key={p.userId} value={p.userId}>
                            {p.label}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => onClear(roleKey)}
                        disabled={disabled || !assignedUserId}
                        style={{
                          padding: "10px 10px",
                          borderRadius: 12,
                          border: "1px solid rgba(0,0,0,0.15)",
                          background: "white",
                          cursor:
                            disabled || !assignedUserId
                              ? "not-allowed"
                              : "pointer",
                          opacity: disabled || !assignedUserId ? 0.5 : 1,
                          whiteSpace: "nowrap",
                          fontWeight: 800,
                        }}
                        title={`Clear assignment (currently: ${assignedLabel})`}
                      >
                        Clear
                      </button>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                      Current: <strong>{assignedLabel}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
            Tip: participants must join first (join code) before you can assign
            them to roles (MVP).
          </div>
        </div>
      </div>
    </div>
  );
}
