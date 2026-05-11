"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { listScenarios, listSessions } from "@/lib/sessionsRuntime";
import { useRoleContext } from "@/app/components/useRoleContext";
import useAutoRefresh from "@/app/components/useAutoRefresh";

import { Button } from "@/app/components/ui/button";
import { ArrowRight, BookOpen, ClipboardList, PlayCircle, Sparkles } from "lucide-react";

export default function FacilitatorHomePage() {
  const { activeOrg, loading: roleLoading, canFacilitate } = useRoleContext();
  const [loading, setLoading] = useState(true);
  const [scenarioCount, setScenarioCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [reviewTargetHref, setReviewTargetHref] = useState("/facilitator/sessions");
  const [reviewSummary, setReviewSummary] = useState("Open session reviews from the library when you want to inspect decisions, timeline, and exports.");
  const [error, setError] = useState<string | null>(null);

  async function loadCounts() {
    setError(null);
    try {
      const [sc, se] = await Promise.all([listScenarios(), listSessions()]);
      setScenarioCount((sc ?? []).length);
      const sessions = se ?? [];
      setSessionCount(sessions.length);

      const latestReviewableSession = [...sessions]
        .filter((session) => session.status === "ended" || session.started_at || session.ended_at)
        .sort((a, b) => {
          const aTime = new Date(a.ended_at ?? a.started_at ?? a.created_at ?? 0).getTime();
          const bTime = new Date(b.ended_at ?? b.started_at ?? b.created_at ?? 0).getTime();
          return bTime - aTime;
        })[0];

      if (latestReviewableSession?.id) {
        setReviewTargetHref(`/facilitator/sessions/${latestReviewableSession.id}/review`);
        setReviewSummary(
          latestReviewableSession.status === "ended"
            ? `Open the latest finished run, "${latestReviewableSession.title ?? "Session"}", and turn it into an after-action review.`
            : `Open the latest active run, "${latestReviewableSession.title ?? "Session"}", to inspect decisions and timeline so far.`
        );
      } else {
        setReviewTargetHref("/facilitator/sessions");
        setReviewSummary("Open session reviews from the library when you want to inspect decisions, timeline, and exports.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    if (roleLoading || !canFacilitate) return;
    void (async () => {
      await loadCounts();
      setLoading(false);
    })();
  }, [roleLoading, canFacilitate]);

  useAutoRefresh(
    async () => {
      await loadCounts();
    },
    { enabled: !roleLoading && canFacilitate, intervalMs: 30000 }
  );

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-background px-5 py-5 shadow-[var(--studio-shadow)] md:px-6 md:py-6">
        <div className="grid gap-4 lg:grid-cols-[1.45fr_0.8fr] lg:items-start">
          <div className="space-y-4">
            <div className="ui-eyebrow">
              <Sparkles className="h-3.5 w-3.5" />
              Facilitator workspace
            </div>

            <div className="space-y-2">
              <h1 className="max-w-3xl text-[28px] font-semibold leading-tight tracking-tight text-foreground">
                Run realistic exercises with less friction.
              </h1>
              <div className="text-sm text-[color:var(--studio-muted)]">
                Active organization: <b className="text-foreground">{activeOrg?.name ?? "not selected"}</b>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-[color:var(--studio-muted)]">
                Build the scenario, run the exercise live, then come back to review the timeline, decisions, and exports.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Button asChild>
                <Link href="/facilitator/sessions">
                  Go to Sessions
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button asChild variant="secondary">
                <Link href="/facilitator/sessions#create-session">New Session</Link>
              </Button>

              <Button asChild variant="outline">
                <Link href="/facilitator/scenarios">Manage Scenarios</Link>
              </Button>

              <Button asChild variant="ghost">
                <Link href="/facilitator/guide">Open Guide</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 self-start sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background px-4 py-4 shadow-[0_8px_20px_hsl(220_20%_20%/0.025)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="ui-metric-label">
                    Scenarios
                  </div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{loading ? "—" : scenarioCount}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-[color:var(--studio-muted)]">
                  <BookOpen className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background px-4 py-4 shadow-[0_8px_20px_hsl(220_20%_20%/0.025)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="ui-metric-label">
                    Sessions
                  </div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{loading ? "—" : sessionCount}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-[color:var(--studio-muted)]">
                  <PlayCircle className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="notice notice-error mt-5">
            {error}
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="group flex h-full min-h-[220px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--studio-shadow)] transition hover:border-[var(--studio-border-strong)]">
          <div className="h-1 bg-blue-500/65" />
          <div className="flex flex-1 flex-col px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-800 dark:text-blue-300">
                  Step 1
                </div>
                <h2 className="mt-3 text-lg font-semibold text-foreground">Prepare</h2>
                <p className="mt-2 max-w-[34ch] text-sm leading-6 text-[color:var(--studio-muted)]">
                  Create the scenario, inject flow, and rule logic before you launch a run.
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-[color:var(--studio-muted)] transition group-hover:border-blue-500/25 group-hover:text-blue-600 dark:group-hover:text-blue-300">
                <BookOpen className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
              <span className="text-xs font-semibold text-[color:var(--studio-muted2)]">Scenario design</span>
              <Button asChild variant="secondary" size="sm" className="shrink-0 gap-1.5">
                <Link href="/facilitator/scenarios">
                  Scenarios
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="group flex h-full min-h-[220px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--studio-shadow)] transition hover:border-[var(--studio-border-strong)]">
          <div className="h-1 bg-emerald-500/65" />
          <div className="flex flex-1 flex-col px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-800 dark:text-emerald-300">
                  Step 2
                </div>
                <h2 className="mt-3 text-lg font-semibold text-foreground">Run</h2>
                <p className="mt-2 max-w-[34ch] text-sm leading-6 text-[color:var(--studio-muted)]">
                  Start the session, release injects, coordinate responses, and steer the live exercise.
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-[color:var(--studio-muted)] transition group-hover:border-emerald-500/25 group-hover:text-emerald-600 dark:group-hover:text-emerald-300">
                <PlayCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
              <span className="text-xs font-semibold text-[color:var(--studio-muted2)]">Live control</span>
              <Button asChild variant="secondary" size="sm" className="shrink-0 gap-1.5">
                <Link href="/facilitator/sessions">
                  Sessions
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="group flex h-full min-h-[220px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--studio-shadow)] transition hover:border-[var(--studio-border-strong)]">
          <div className="h-1 bg-violet-500/65" />
          <div className="flex flex-1 flex-col px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-800 dark:text-violet-300">
                  Step 3
                </div>
                <h2 className="mt-3 text-lg font-semibold text-foreground">Review</h2>
                <p className="mt-2 max-w-[36ch] text-sm leading-6 text-[color:var(--studio-muted)]">
                  {reviewSummary}
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-[color:var(--studio-muted)] transition group-hover:border-violet-500/25 group-hover:text-violet-600 dark:group-hover:text-violet-300">
                <ClipboardList className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
              <span className="text-xs font-semibold text-[color:var(--studio-muted2)]">After-action review</span>
              <Button asChild variant="secondary" size="sm" className="shrink-0 gap-1.5">
                <Link href={reviewTargetHref}>
                  Review
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
