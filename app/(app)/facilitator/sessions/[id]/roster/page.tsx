// app/(app)/facilitator/sessions/[id]/roster/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { listSessionRoster, kickFromSession, type SessionRosterRow } from "@/lib/sessionsRuntime";
import { useRoleContext } from "@/app/components/useRoleContext";
import useAutoRefresh from "@/app/components/useAutoRefresh";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Users, UserMinus, ArrowLeft, Shield, User, Sparkles } from "lucide-react";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function fmt(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function errMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

function shortParticipantId(value: string) {
  return `Participant ${value.slice(0, 8)}`;
}

function RolePill({ role }: { role?: string | null }) {
  const r = String(role ?? "participant").toLowerCase();
  const base =
    "inline-flex items-center gap-1 rounded-full border border-[var(--studio-border)] px-2.5 py-1 text-xs font-semibold";
  const cls =
    r === "facilitator"
      ? "bg-primary/10 text-primary"
      : "bg-[var(--studio-surface2)] text-foreground";

  return (
    <span className={`${base} ${cls}`}>
      {r === "facilitator" ? <Shield className="h-3.5 w-3.5 opacity-80" /> : <User className="h-3.5 w-3.5 opacity-70" />}
      {r.charAt(0).toUpperCase() + r.slice(1)}
    </span>
  );
}

export default function FacilitatorRosterPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { loading: roleLoading, canFacilitate } = useRoleContext();
  const sessionId = params?.id ?? "";
  const valid = useMemo(() => isUuid(sessionId), [sessionId]);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SessionRosterRow[]>([]);

  const load = useCallback(async () => {
    if (!valid) {
      setLoading(false);
      setError("This session link is not valid.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const r = await listSessionRoster(sessionId);
      setRows((r ?? []) as SessionRosterRow[]);
    } catch (e: unknown) {
      setError(errMessage(e, "Failed to load roster."));
    } finally {
      setLoading(false);
    }
  }, [sessionId, valid]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (roleLoading || !canFacilitate) return;
        if (cancelled) return;

        await load();
      } catch (e: unknown) {
        if (cancelled) return;
        setError(errMessage(e, "Failed to load roster."));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roleLoading, canFacilitate, sessionId, valid, load]);

  useAutoRefresh(
    async () => {
      await load();
    },
    { enabled: !roleLoading && canFacilitate && valid && !busyId, intervalMs: 30000 }
  );

  async function onKick(participantId: string, displayName?: string | null) {
    if (!valid) return;
    if (busyId) return;

    const label = displayName?.trim() ? displayName.trim() : shortParticipantId(participantId);
    if (!confirm(`Remove "${label}" from this session?`)) return;

    setBusyId(participantId);
    setError(null);
    try {
      await kickFromSession(sessionId, participantId);
      // optimistic remove
      setRows((prev) => prev.filter((x) => x.participant_id !== participantId));
    } catch (e: unknown) {
      setError(errMessage(e, "Failed to remove participant."));
      // fallback to reload if needed
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[var(--studio-max)] space-y-5">
      {/* Header */}
      <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden">
        <div className="relative px-5 py-5 md:px-6 md:py-6">
          <div className="pointer-events-none absolute right-0 top-0 h-28 w-52 rounded-bl-[28px] bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_62%)]" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <div className="ui-eyebrow">
                <Sparkles className="h-3.5 w-3.5" />
                Session roster
              </div>
              <h1 className="text-[28px] font-semibold tracking-tight flex items-center gap-2">
                <Users className="h-5 w-5 opacity-80" />
                Participants
              </h1>
              <p className="text-sm leading-7 text-[color:var(--studio-muted)]">
                Review who has joined the exercise and remove participants when needed.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => router.push(`/sessions/${sessionId}`)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to session
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error ? (
        <div className="notice notice-error">
          {error}
        </div>
      ) : null}

      {/* List */}
      <Card className="surface shadow-soft border border-[var(--studio-border)] overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 opacity-80" />
            Participants
          </CardTitle>
          <CardDescription className="text-sm">
            {rows.length} total
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No participants yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--studio-border)] bg-[var(--studio-surface2)]">
                    <th className="px-4 py-3 text-left ui-section-label">Participant</th>
                    <th className="px-4 py-3 text-left ui-section-label">Role</th>
                    <th className="px-4 py-3 text-left ui-section-label">Joined</th>
                    <th className="px-4 py-3 text-right ui-section-label">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const pid = r.participant_id;
                    const isBusy = busyId === pid;

                    return (
                      <tr key={pid} className="border-b border-[var(--studio-border)]">
                        <td className="px-4 py-3">
                          <div className="font-semibold truncate max-w-[520px]">
                            {r.display_name ?? "Anonymous"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate max-w-[520px]">
                            {shortParticipantId(pid)}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <RolePill role={r.role ?? "participant"} />
                        </td>

                        <td className="px-4 py-3 text-muted-foreground">
                          {fmt(r.joined_at ?? null)}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onKick(pid, r.display_name ?? null)}
                            disabled={isBusy}
                            className="gap-2"
                            title="Remove from session"
                            aria-label={`Remove ${r.display_name ?? "participant"} from session`}
                          >
                            <UserMinus className="h-4 w-4" />
                            {isBusy ? "…" : "Remove"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
