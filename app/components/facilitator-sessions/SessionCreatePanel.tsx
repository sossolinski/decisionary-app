import type { RefObject } from "react";
import { Play, Sparkles } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import HintTooltip from "@/app/components/HintTooltip";
import type { ScenarioListItem } from "@/lib/sessionsRuntime";

import { Select } from "./sessionUi";

type SessionCreatePanelProps = {
  ids: string;
  sessionsCount: number;
  activeCount: number;
  endedCount: number;
  scenarios: ScenarioListItem[];
  scenarioId: string;
  setScenarioId: (value: string) => void;
  title: string;
  setTitle: (value: string) => void;
  createMode: "rehearsal" | "live";
  setCreateMode: (value: "rehearsal" | "live") => void;
  participantTier: string;
  setParticipantTier: (value: string) => void;
  canCreateLive: boolean;
  availableLiveTiers: Map<number, number>;
  busyId: string | null;
  onCreate: () => void;
  scenarioSelectRef: RefObject<HTMLSelectElement | null>;
};

export default function SessionCreatePanel({
  ids,
  sessionsCount,
  activeCount,
  endedCount,
  scenarios,
  scenarioId,
  setScenarioId,
  title,
  setTitle,
  createMode,
  setCreateMode,
  participantTier,
  setParticipantTier,
  canCreateLive,
  availableLiveTiers,
  busyId,
  onCreate,
  scenarioSelectRef,
}: SessionCreatePanelProps) {
  const detailsSummary =
    createMode === "live"
      ? canCreateLive
        ? `Live access available${[5, 10, 15].some((limit) => (availableLiveTiers.get(limit) ?? 0) > 0) ? ` · ${[5, 10, 15]
            .filter((limit) => (availableLiveTiers.get(limit) ?? 0) > 0)
            .map((limit) => `${limit}p x${availableLiveTiers.get(limit) ?? 0}`)
            .join(" • ")}` : ""}`
        : "No live entitlement for this tier"
      : "Rehearsal runs full flow for facilitator only";

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-background px-5 py-5 shadow-[var(--studio-shadow)] md:px-6 md:py-6">
      <div className="relative">
        <div className="grid gap-5 lg:grid-cols-[1.3fr_0.9fr] lg:items-start">
          <div className="space-y-4">
            <div className="ui-eyebrow">
              <Sparkles className="h-3.5 w-3.5" />
              Session control
              <HintTooltip
                text="Create sessions from scenarios, distribute join codes, and manage the exercise lifecycle without leaving the operations surface."
                side="right"
              />
            </div>

            <div className="space-y-2">
              <h1 className="max-w-3xl text-[28px] font-semibold leading-tight tracking-tight text-foreground">
                Move cleanly from planning into live exercise runs.
              </h1>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="rounded-2xl bg-[var(--studio-inset)] px-4 py-4 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.035)]">
              <div className="ui-metric-label">Total</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{sessionsCount}</div>
            </div>

            <div className="rounded-2xl bg-[var(--studio-inset)] px-4 py-4 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.035)]">
              <div className="ui-metric-label">Live</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{activeCount}</div>
            </div>

            <div className="rounded-2xl bg-[var(--studio-inset)] px-4 py-4 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.035)]">
              <div className="ui-metric-label">Ended</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{endedCount}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-[var(--studio-inset)] px-4 py-4 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.035)]">
        <div id="create-session" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="ui-section-label">Create session</div>
              <HintTooltip
                text="Use rehearsal for a solo dry run, or start a paid live exercise when your organization has access."
                side="right"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={createMode === "rehearsal" ? "default" : "outline"} onClick={() => setCreateMode("rehearsal")} className="rounded-full">
              Rehearsal
            </Button>
            <Button type="button" variant={createMode === "live" ? "default" : "outline"} onClick={() => setCreateMode("live")} className="rounded-full">
              Live exercise
            </Button>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.75fr)_auto] xl:items-center">
            <div>
              <Select id={`${ids}-scenario`} inputRef={scenarioSelectRef} value={scenarioId} onChange={setScenarioId}>
                <option value="">Select scenario…</option>
                {scenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.title ?? "Untitled scenario"}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              {createMode === "rehearsal" ? (
                <Input
                  id={`${ids}-title`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="New rehearsal"
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                  <Input
                    id={`${ids}-title`}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="New live exercise"
                  />
                  <Select value={participantTier} onChange={setParticipantTier}>
                    <option value="5">Up to 5</option>
                    <option value="10">Up to 10</option>
                    <option value="15">Up to 15</option>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={onCreate}
                disabled={busyId === "create" || (createMode === "live" && !canCreateLive)}
                className="gap-2 xl:w-auto"
              >
                <Play className="h-4 w-4" />
                {busyId === "create" ? "…" : createMode === "rehearsal" ? "Create rehearsal" : "Create live"}
              </Button>
              <HintTooltip
                text={
                  createMode === "rehearsal"
                    ? "Rehearsal mode is free and limited to the creator only."
                    : "Live exercise creation consumes one eligible organization entitlement and unlocks participant joins up to the purchased tier."
                }
                side="left"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-background px-4 py-3 text-sm shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.04)]">
            <span className="font-semibold text-[color:var(--studio-ink)]">Mode:</span>{" "}
            <span className="text-[color:var(--studio-muted)]">{detailsSummary}</span>
          </div>

          {scenarios.length === 0 ? (
            <div className="rounded-2xl bg-background px-4 py-4 text-sm text-[color:var(--studio-muted)] shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.04)]">
              You do not have any scenarios yet. Create one first so this workspace can launch a session.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
