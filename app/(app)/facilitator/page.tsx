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
      <section className="ui-section-panel">
        <div className="grid gap-4 lg:grid-cols-[1.45fr_0.8fr] lg:items-start">
          <div className="space-y-4">
            <div className="ui-eyebrow">
              <Sparkles className="h-3.5 w-3.5" />
              Facilitator workspace
            </div>

            <div className="space-y-2">
              <h1 className="text-[28px] font-semibold tracking-tight">Run realistic exercises with less friction.</h1>
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
            <div className="ui-metric-card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="ui-metric-label">
                    Scenarios
                  </div>
                  <div className="mt-2 text-3xl font-semibold">{loading ? "—" : scenarioCount}</div>
                </div>
                <BookOpen className="h-4 w-4 text-foreground/60" />
              </div>
            </div>

            <div className="ui-metric-card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="ui-metric-label">
                    Sessions
                  </div>
                  <div className="mt-2 text-3xl font-semibold">{loading ? "—" : sessionCount}</div>
                </div>
                <PlayCircle className="h-4 w-4 text-foreground/60" />
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
        <section className="ui-row-panel h-full">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">1. Prepare</h2>
              </div>
              <BookOpen className="h-4 w-4 text-foreground/60" />
            </div>
          <div className="mt-3 flex min-h-[92px] items-end justify-between gap-4">
            <span className="max-w-[26ch] text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              Create the scenario, inject flow, and rule logic before you launch a run.
            </span>
            <Button asChild variant="secondary" size="sm" className="shrink-0">
              <Link href="/facilitator/scenarios">Scenarios</Link>
            </Button>
          </div>
        </section>

        <section className="ui-row-panel h-full">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">2. Run</h2>
              </div>
              <PlayCircle className="h-4 w-4 text-foreground/60" />
            </div>
          <div className="mt-3 flex min-h-[92px] items-end justify-between gap-4">
            <span className="max-w-[26ch] text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              Start the session, release injects, coordinate responses, and steer the live exercise.
            </span>
            <Button asChild variant="secondary" size="sm" className="shrink-0">
              <Link href="/facilitator/sessions">Sessions</Link>
            </Button>
          </div>
        </section>

        <section className="ui-row-panel h-full">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">3. Review</h2>
              </div>
              <ClipboardList className="h-4 w-4 text-foreground/60" />
            </div>
          <div className="mt-3 flex min-h-[92px] items-end justify-between gap-4">
            <span className="max-w-[30ch] text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              {reviewSummary}
            </span>
            <Button asChild variant="secondary" size="sm" className="shrink-0">
              <Link href={reviewTargetHref}>Review</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
