"use client";

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
  return (
    <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden">
      <div className="relative px-5 py-5 md:px-6 md:py-6">
        <div className="pointer-events-none absolute right-0 top-0 h-28 w-52 rounded-bl-[28px] bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_62%)]" />
        <div className="relative grid gap-5 lg:grid-cols-[1.3fr_0.9fr] lg:items-start">
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
              <h1 className="text-[28px] font-semibold tracking-tight">Move cleanly from planning into live exercise runs.</h1>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="ui-metric-card">
              <div className="ui-metric-label">Total</div>
              <div className="mt-2 text-3xl font-semibold">{sessionsCount}</div>
            </div>

            <div className="ui-metric-card">
              <div className="ui-metric-label">Live</div>
              <div className="mt-2 text-3xl font-semibold">{activeCount}</div>
            </div>

            <div className="ui-metric-card">
              <div className="ui-metric-label">Ended</div>
              <div className="mt-2 text-3xl font-semibold">{endedCount}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--studio-border)] px-5 py-4 md:px-6">
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
            <Button type="button" variant={createMode === "rehearsal" ? "default" : "outline"} onClick={() => setCreateMode("rehearsal")}>
              Rehearsal
            </Button>
            <Button type="button" variant={createMode === "live" ? "default" : "outline"} onClick={() => setCreateMode("live")}>
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

          {createMode === "live" ? (
            <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-3 text-sm text-[color:var(--studio-muted)]">
              {canCreateLive ? (
                <span>
                  Live access available. Matching entitlements:{" "}
                  {[5, 10, 15]
                    .filter((limit) => (availableLiveTiers.get(limit) ?? 0) > 0)
                    .map((limit) => `${limit}p x${availableLiveTiers.get(limit) ?? 0}`)
                    .join(" • ")}
                </span>
              ) : (
                <span>
                  This organization does not currently have a live exercise entitlement for the selected participant tier.
                  Ask an admin to grant access or create a billing order first.
                </span>
              )}
            </div>
          ) : (
            <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-3 text-sm text-[color:var(--studio-muted)]">
              Rehearsal mode runs the full session flow, but only the creator can join and participant invitations stay disabled.
            </div>
          )}

          {scenarios.length === 0 ? (
            <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-3 text-sm text-[color:var(--studio-muted)]">
              You do not have any scenarios yet. Create one first so this workspace can launch a session.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
