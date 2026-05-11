"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  listMyParticipantSessions,
  type ParticipantSession,
} from "@/lib/sessionsRuntime";
import { useRoleContext } from "@/app/components/useRoleContext";
import useAutoRefresh from "@/app/components/useAutoRefresh";

import { Button } from "@/app/components/ui/button";
import { ArrowRight, CheckCircle2, Clock3, Copy, PlayCircle, ShieldCheck, Sparkles, UserRound } from "lucide-react";

function fmt(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function errMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function statusLabel(status: ParticipantSession["status"]) {
  return status.replaceAll("_", " ");
}

function roleLabel(role?: string | null) {
  if (!role) return "Participant";
  return role.replaceAll("_", " ");
}

function sessionTiming(session: ParticipantSession) {
  if (session.status === "ended" && session.ended_at) return `Ended ${fmt(session.ended_at)}`;
  if (session.started_at) return `Started ${fmt(session.started_at)}`;
  if (session.joined_at) return `Joined ${fmt(session.joined_at)}`;
  return "Joined session";
}

export default function ParticipantPage() {
  const router = useRouter();
  const { loading, userId, email, activeRole, isAnonymous, needsEmailConfirmation } = useRoleContext();

  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<ParticipantSession[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);
  const copyResetRef = useRef<number | null>(null);

  async function load() {
    setErr(null);
    setBusy(true);
    try {
      const rows = await listMyParticipantSessions();
      setItems(rows ?? []);
    } catch (e: unknown) {
      setErr(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!loading && userId) void load();
  }, [loading, userId]);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) window.clearTimeout(copyResetRef.current);
    };
  }, []);

  useAutoRefresh(
    async () => {
      await load();
    },
    { enabled: !loading && !!userId, intervalMs: 30000 }
  );

  async function copyJoinCode(session: ParticipantSession) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(session.join_code);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = session.join_code;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";
        document.body.appendChild(textarea);
        textarea.select();

        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!copied) throw new Error("Copy command failed.");
      }

      setErr(null);
      setCopiedSessionId(session.id);
      if (copyResetRef.current) window.clearTimeout(copyResetRef.current);
      copyResetRef.current = window.setTimeout(() => setCopiedSessionId(null), 1800);
    } catch {
      setErr("Could not copy the session code. Select and copy it manually.");
    }
  }

  if (loading) {
    return <div className="text-sm text-[color:var(--studio-muted)]">Loading…</div>;
  }

  if (!userId || (activeRole !== "participant" && activeRole !== "admin")) {
    return (
      <div className="rounded-2xl border border-border bg-background px-5 py-5 shadow-[var(--studio-shadow)]">
        <div className="text-sm font-semibold">Sign in to continue.</div>
        <p className="mt-1 max-w-[58ch] text-sm leading-6 text-[color:var(--studio-muted)]">
          Participant access starts with a session code or an existing account.
        </p>
        <div className="flex gap-2">
          <Button asChild className="mt-4">
            <Link href="/login">Go to login</Link>
          </Button>
          <Button asChild variant="secondary" className="mt-4">
            <Link href="/join">Join session</Link>
          </Button>
        </div>
      </div>
    );
  }

  const label = email ?? `Anonymous (${userId.slice(0, 8)})`;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-background px-5 py-5 shadow-[var(--studio-shadow)] md:px-6 md:py-6">
        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.8fr] lg:items-start">
          <div className="space-y-4">
            <div className="ui-eyebrow">
              <Sparkles className="h-3.5 w-3.5" />
              Participant room
            </div>

            <div className="space-y-2">
              <h1 className="max-w-3xl text-[28px] font-semibold leading-tight tracking-tight text-foreground">
                Enter the live exercise with context.
              </h1>
              <div className="text-sm text-[color:var(--studio-muted)]">
                Current identity: <b className="text-foreground">{label}</b>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-[color:var(--studio-muted)]">
                Join sessions, return to active exercises, and keep your participant access in one place.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Button asChild>
                <Link href="/join">
                  Join session
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              {isAnonymous ? (
                <Button asChild variant="secondary">
                  <Link href="/settings">Upgrade guest</Link>
                </Button>
              ) : (
                <Button asChild variant="secondary">
                  <Link href="/settings">Account settings</Link>
                </Button>
              )}

              {activeRole === "admin" ? (
                <Button asChild variant="outline">
                  <Link href="/facilitator">Facilitator</Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 self-start sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background px-4 py-4 shadow-[0_8px_20px_hsl(220_20%_20%/0.025)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="ui-metric-label">Joined sessions</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                    {busy && items.length === 0 ? "—" : items.length}
                  </div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-[color:var(--studio-muted)]">
                  <PlayCircle className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background px-4 py-4 shadow-[0_8px_20px_hsl(220_20%_20%/0.025)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="ui-metric-label">Access</div>
                  <div className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                    {isAnonymous ? "Guest" : "Account"}
                  </div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-[color:var(--studio-muted)]">
                  {isAnonymous ? <UserRound className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                </div>
              </div>
            </div>
          </div>
        </div>

        {err ? (
          <div className="notice notice-error mt-5">
            {err}
          </div>
        ) : null}
      </section>

      {isAnonymous ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-5 py-4 shadow-[var(--studio-shadow)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <UserRound className="h-4 w-4 text-amber-600 dark:text-amber-300" />
              Guest access
            </div>
            <p className="max-w-[60ch] text-sm leading-6 text-[color:var(--studio-muted2)]">
              Add an email and password to keep this participant identity and joined sessions across devices.
            </p>
          </div>
          <Button asChild>
            <Link href="/settings">Open settings</Link>
          </Button>
        </section>
      ) : null}

      {needsEmailConfirmation ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-5 py-4 shadow-[var(--studio-shadow)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-300" />
              Confirm your email
            </div>
            <p className="max-w-[60ch] text-sm leading-6 text-[color:var(--studio-muted2)]">
              Your account is active in this browser. Confirm your email to finish setup.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/settings">Open settings</Link>
          </Button>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--studio-shadow)]">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-foreground">
              <PlayCircle className="h-4 w-4 text-[color:var(--studio-muted2)]" />
              My sessions
            </div>
            <p className="mt-1 text-sm leading-6 text-[color:var(--studio-muted)]">
              Sessions you joined with a code or through a roster assignment.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {busy ? (
              <span className="rounded-full border border-[var(--studio-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Refreshing
              </span>
            ) : null}
            <Button asChild variant="secondary" size="sm">
              <Link href="/join">Join session</Link>
            </Button>
          </div>
        </div>

        <div className="px-5 py-5">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-[var(--studio-inset)] px-5 py-6 text-sm leading-6 text-[color:var(--studio-muted)]">
              No sessions yet. Use <b className="text-foreground">Join session</b> when you receive a code from the facilitator.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((s) => (
                <div
                  key={s.id}
                  className="group flex flex-col gap-3 rounded-2xl border border-border bg-background px-4 py-4 shadow-[0_8px_20px_hsl(220_20%_20%/0.025)] transition hover:border-[var(--studio-border-strong)] lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {s.title ?? "Session"}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[color:var(--studio-muted2)]">
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {statusLabel(s.status)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        {sessionTiming(s)}
                      </span>
                      <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2 py-0.5">
                        {roleLabel(s.my_role_key)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => router.push(`/sessions/${s.id}`)}
                    >
                      Open
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void copyJoinCode(s)}
                      title="Copy join code"
                      aria-label={`Copy join code for session ${s.title ?? "session"}`}
                    >
                      {copiedSessionId === s.id ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copiedSessionId === s.id ? "Copied" : "Code"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
