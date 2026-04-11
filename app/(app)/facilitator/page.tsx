"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { listScenarios, listSessions } from "@/lib/sessionsRuntime";
import { useRoleContext } from "@/app/components/useRoleContext";
import useAutoRefresh from "@/app/components/useAutoRefresh";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import HintTooltip from "@/app/components/HintTooltip";
import { ArrowRight, BookOpen, ClipboardList, PlayCircle, Sparkles } from "lucide-react";

export default function FacilitatorHomePage() {
  const { activeOrg, loading: roleLoading, canFacilitate } = useRoleContext();
  const [loading, setLoading] = useState(true);
  const [scenarioCount, setScenarioCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function loadCounts() {
    setError(null);
    try {
      const [sc, se] = await Promise.all([listScenarios(), listSessions()]);
      setScenarioCount((sc ?? []).length);
      setSessionCount((se ?? []).length);
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
      <Card className="overflow-hidden bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--card)/0.94))]">
        <CardContent className="relative pt-5 pb-5 md:pt-6 md:pb-6">
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-56 rounded-bl-[32px] bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_62%)]" />
          <div className="relative grid gap-4 lg:grid-cols-[1.45fr_0.8fr] lg:items-start">
            <div className="space-y-4">
              <div className="ui-eyebrow">
                <Sparkles className="h-3.5 w-3.5" />
                Facilitator workspace
                <HintTooltip
                  text="Build scenarios, launch sessions, and coordinate the exercise flow from one calm control surface."
                  side="top"
                />
              </div>

              <div className="space-y-2">
                <h1 className="text-[28px] font-semibold tracking-tight">Run realistic exercises with less friction.</h1>
                <div className="text-sm text-[color:var(--studio-muted)]">
                  Active organization: <b className="text-foreground">{activeOrg?.name ?? "not selected"}</b>
                </div>
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
                  <div className="rounded-[12px] border border-[color:var(--studio-border)] bg-background/80 p-2">
                    <BookOpen className="h-4 w-4 text-foreground/80" />
                  </div>
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
                  <div className="rounded-[12px] border border-[color:var(--studio-border)] bg-background/80 p-2">
                    <PlayCircle className="h-4 w-4 text-foreground/80" />
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
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CardTitle>1. Prepare</CardTitle>
                <HintTooltip text="Create or refine scenarios and inject libraries before you start a run." />
              </div>
              <div className="rounded-[12px] border border-[color:var(--studio-border)] bg-background/80 p-2">
                <BookOpen className="h-4 w-4 text-foreground/80" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-[92px] items-end justify-between gap-4 pt-0">
            <span className="max-w-[26ch] text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              Create and iterate on content.
            </span>
            <Button asChild variant="secondary" size="sm" className="shrink-0">
              <Link href="/facilitator/scenarios">Scenarios</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CardTitle>2. Run</CardTitle>
                <HintTooltip text="Launch a session, bring in participants, and coordinate exercise flow in real time." />
              </div>
              <div className="rounded-[12px] border border-[color:var(--studio-border)] bg-background/80 p-2">
                <PlayCircle className="h-4 w-4 text-foreground/80" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-[92px] items-end justify-between gap-4 pt-0">
            <span className="max-w-[26ch] text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              Lifecycle control and live tools.
            </span>
            <Button asChild variant="secondary" size="sm" className="shrink-0">
              <Link href="/facilitator/sessions">Sessions</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CardTitle>3. Review</CardTitle>
                <HintTooltip text="Track decisions and timeline points, then turn them into a clearer after-action review." />
              </div>
              <div className="rounded-[12px] border border-[color:var(--studio-border)] bg-background/80 p-2">
                <ClipboardList className="h-4 w-4 text-foreground/80" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-[92px] items-end pt-0 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            <span className="max-w-[28ch]">(Next) Add after-action reports and exports.</span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
