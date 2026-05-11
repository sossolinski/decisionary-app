// app/(app)/facilitator/sessions/[id]/roster/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { listSessionRoster, kickFromSession, type SessionRosterRow } from "@/lib/sessionsRuntime";
import { useRoleContext } from "@/app/components/useRoleContext";
import useAutoRefresh from "@/app/components/useAutoRefresh";
import ConfirmDialog from "@/app/components/ConfirmDialog";

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

type PendingConfirm = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "default" | "destructive";
  onConfirm: () => Promise<void>;
};

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
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

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
    setPendingConfirm({
      title: "Remove participant?",
      description: `This removes "${label}" from the current session roster. They will no longer be able to participate in this run.`,
      confirmLabel: "Remove participant",
      tone: "destructive",
      onConfirm: () => kickNow(participantId),
    });
  }

  async function kickNow(participantId: string) {
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
    return (
      <div className="rounded-2xl border border-border bg-background px-5 py-5 text-sm text-[color:var(--studio-muted)] shadow-[var(--studio-shadow)]">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[var(--studio-max)] space-y-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-background px-5 py-5 shadow-[var(--studio-shadow)] md:px-6 md:py-6">
        <div className="grid gap-5 lg:grid-cols-[1.25fr_0.55fr] lg:items-start">
          <div className="min-w-0 space-y-4">
            <div className="ui-eyebrow">
              <Sparkles className="h-3.5 w-3.5" />
              Session roster
            </div>
            <div className="space-y-2">
              <h1 className="flex items-center gap-2 text-[28px] font-semibold leading-tight tracking-tight text-foreground">
                <Users className="h-5 w-5 opacity-80" />
                Participants
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-[color:var(--studio-muted)]">
                Review who has joined the exercise and remove participants when needed.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl bg-[var(--studio-inset)] px-4 py-4 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.035)]">
              <div className="ui-metric-label">Total</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{rows.length}</div>
            </div>
            <Button variant="secondary" onClick={() => router.push(`/sessions/${sessionId}`)} className="gap-2 sm:self-end lg:self-auto">
              <ArrowLeft className="h-4 w-4" />
              Back to session
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="notice notice-error">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-background px-5 py-5 shadow-[var(--studio-shadow)] md:px-6">
        <div className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Users className="h-5 w-5 opacity-80" />
            Roster
          </h2>
          <div className="text-sm text-[color:var(--studio-muted)]">{rows.length} total</div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl bg-[var(--studio-inset)] px-5 py-6 text-sm text-[color:var(--studio-muted)] shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.035)]">
            No participants yet.
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {rows.map((r) => {
              const pid = r.participant_id;
              const isBusy = busyId === pid;

              return (
                <div
                  key={pid}
                  className="rounded-2xl bg-[var(--studio-inset)] px-4 py-4 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.04)] transition hover:shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.08)] md:px-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-lg font-semibold tracking-tight text-foreground">
                        {r.display_name ?? "Anonymous"}
                      </div>
                      <div className="mt-1 truncate text-xs text-[color:var(--studio-muted2)]">
                        {shortParticipantId(pid)}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
                      <RolePill role={r.role ?? "participant"} />
                      <div className="text-sm text-[color:var(--studio-muted)]">
                        <span className="font-medium text-foreground">Joined:</span> {fmt(r.joined_at ?? null)}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onKick(pid, r.display_name ?? null)}
                        disabled={isBusy}
                        className="gap-2 sm:ml-1"
                        title="Remove from session"
                        aria-label={`Remove ${r.display_name ?? "participant"} from session`}
                      >
                        <UserMinus className="h-4 w-4" />
                        {isBusy ? "…" : "Remove"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        title={pendingConfirm?.title ?? ""}
        description={pendingConfirm?.description ?? ""}
        confirmLabel={pendingConfirm?.confirmLabel}
        tone={pendingConfirm?.tone}
        onOpenChange={(open) => {
          if (!open) setPendingConfirm(null);
        }}
        onConfirm={async () => {
          await pendingConfirm?.onConfirm();
        }}
      />
    </div>
  );
}
