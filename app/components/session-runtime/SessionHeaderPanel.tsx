"use client";

import { ChevronDown, Clock3, LayoutDashboard, Radio, Wrench } from "lucide-react";

import type { Scenario } from "@/lib/scenarios";
import type { SessionSituation } from "@/lib/sessions";

import FacilitatorToolsPanel from "@/app/components/FacilitatorToolsPanel";
import SituationCard from "@/app/components/SituationCard";
import { Button } from "@/app/components/ui/button";

import { fmt } from "./sessionRuntimeUi";

type SessionHeaderPanelProps = {
  copPanelId: string;
  toolsPanelId: string;
  heroEyebrow: string;
  participantView: boolean;
  startedAt: string | null;
  sessionTitle: string;
  nextBestAction: string | null;
  sessionMode: "rehearsal" | "live";
  sessionParticipantLimit: number | null;
  copOpen: boolean;
  setCopOpen: React.Dispatch<React.SetStateAction<boolean>>;
  roleLoading: boolean;
  isFacilitator: boolean;
  toolsOpen: boolean;
  setToolsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  exerciseClock: string;
  scenario: Scenario | null;
  situation: SessionSituation | null;
  validSessionId: boolean;
  sessionId: string;
  onUpdateCasualties: (payload: { injured: number; fatalities: number; uninjured: number; unknown: number }) => Promise<void>;
  onUpdateManifest: (payload: {
    passengerCount: number;
    crewCount: number;
    cargoWeightKg: number;
    dangerousGoodsCount: number;
    liveAnimalsCount: number;
  }) => Promise<void>;
  applySessionMeta: (row: { started_at?: string | null } | null | undefined) => void;
};

export default function SessionHeaderPanel({
  copPanelId,
  toolsPanelId,
  heroEyebrow,
  participantView,
  startedAt,
  sessionTitle,
  nextBestAction,
  sessionMode,
  sessionParticipantLimit,
  copOpen,
  setCopOpen,
  roleLoading,
  isFacilitator,
  toolsOpen,
  setToolsOpen,
  exerciseClock,
  scenario,
  situation,
  validSessionId,
  sessionId,
  onUpdateCasualties,
  onUpdateManifest,
  applySessionMeta,
}: SessionHeaderPanelProps) {
  const readableClock = exerciseClock.startsWith("T+")
    ? exerciseClock.slice(2)
    : exerciseClock === "T=—"
      ? "Not started"
      : exerciseClock;

  const participantLabel =
    sessionMode === "rehearsal"
      ? "Rehearsal · single participant · invitations off"
      : sessionParticipantLimit
        ? `Up to ${sessionParticipantLimit} participants`
        : null;

  return (
    <div className="relative z-20 overflow-visible pb-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium text-[color:var(--studio-muted2)]">
            <div className="ui-eyebrow">
              <Radio className="h-3.5 w-3.5" />
              {heroEyebrow}
            </div>
            <span>Started {fmt(startedAt)}</span>
            {participantLabel ? (
              <>
                <span className="h-1 w-1 rounded-full bg-[color:var(--studio-muted2)]/60" aria-hidden="true" />
                <span>{participantLabel}</span>
              </>
            ) : null}
          </div>

          <h1 className="mt-2 max-w-[68rem] text-balance text-2xl font-semibold leading-tight text-[color:var(--studio-ink)] sm:text-[1.7rem]">
            {sessionTitle}
          </h1>

          {nextBestAction ? (
            <div className="mt-3 inline-flex max-w-3xl items-center rounded-[10px] border border-primary/18 bg-primary/8 px-3 py-1.5 text-sm font-medium leading-5 text-[color:var(--studio-ink)]">
              {nextBestAction}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant={copOpen ? "secondary" : "outline"}
              onClick={() => setCopOpen((v) => !v)}
              className="h-8 gap-2 rounded-[8px] px-2.5 text-xs font-semibold"
              title={participantView ? "Toggle situation" : "Toggle COP"}
              aria-expanded={copOpen}
              aria-controls={copPanelId}
            >
              <LayoutDashboard className="h-4 w-4 opacity-80" />
              {participantView ? (copOpen ? "Hide situation" : "Open situation") : copOpen ? "Hide COP" : "Open COP"}
              <ChevronDown className={["h-4 w-4 opacity-70 transition-transform", copOpen ? "rotate-180" : ""].join(" ")} />
            </Button>

            {roleLoading ? (
              <div className="px-2 text-xs text-[color:var(--studio-muted2)]">Loading role…</div>
            ) : isFacilitator ? (
              <Button
                variant={toolsOpen ? "secondary" : "outline"}
                onClick={() => setToolsOpen((v) => !v)}
                className="h-8 gap-2 rounded-[8px] px-2.5 text-xs font-semibold"
                aria-expanded={toolsOpen}
                aria-controls={toolsPanelId}
              >
                <Wrench className="h-4 w-4" />
                {toolsOpen ? "Hide tools" : "Facilitator tools"}
                <ChevronDown className={["h-4 w-4 opacity-70 transition-transform", toolsOpen ? "rotate-180" : ""].join(" ")} />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex w-full items-center justify-between gap-3 rounded-[12px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3.5 py-3 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.02)] sm:w-auto sm:min-w-[220px] xl:mt-1">
          <div>
            <div className="ui-metric-label">Elapsed time</div>
            <div className="mt-0.5 text-lg font-semibold leading-none text-[color:var(--studio-ink)]">{readableClock}</div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-secondary/70 text-[color:var(--studio-ink)]">
            <Clock3 className="h-4 w-4" />
          </div>
        </div>
      </div>

      {copOpen ? (
        <div id={copPanelId} className="mt-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <LayoutDashboard className="h-4 w-4 opacity-80" />
              Common operational picture
            </div>
          </div>
            <SituationCard
              scenario={scenario}
              situation={situation}
              onUpdateCasualties={async (p) => {
                if (!validSessionId) return;
                await onUpdateCasualties(p);
              }}
              onUpdateManifest={async (p) => {
                if (!validSessionId) return;
                await onUpdateManifest(p);
              }}
            />
        </div>
      ) : null}

      {isFacilitator && toolsOpen ? (
        <div id={toolsPanelId} className="mt-4">
          <div className="px-0">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Wrench className="h-4 w-4 opacity-80" />
                    Facilitator tools
                  </div>
                </div>
              </div>

            <FacilitatorToolsPanel
              sessionId={sessionId}
              scenarioId={scenario?.id ?? null}
              compact
              onSessionMetaChange={(meta) => applySessionMeta(meta as { started_at?: string | null } | null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
