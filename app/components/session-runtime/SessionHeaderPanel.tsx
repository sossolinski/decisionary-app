"use client";

import { ChevronDown, LayoutDashboard, Radio, Wrench } from "lucide-react";

import type { Scenario } from "@/lib/scenarios";
import type { SessionSituation } from "@/lib/sessions";

import FacilitatorToolsPanel from "@/app/components/FacilitatorToolsPanel";
import HintTooltip from "@/app/components/HintTooltip";
import SituationCard from "@/app/components/SituationCard";
import { Button } from "@/app/components/ui/button";

import { fmt, RuntimeMetric } from "./sessionRuntimeUi";

type SessionHeaderPanelProps = {
  copPanelId: string;
  toolsPanelId: string;
  heroEyebrow: string;
  heroHint: string | null;
  startedAt: string | null;
  sessionTitle: string;
  heroSummary: string;
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
  applySessionMeta: (row: { started_at?: string | null } | null | undefined) => void;
};

export default function SessionHeaderPanel({
  copPanelId,
  toolsPanelId,
  heroEyebrow,
  heroHint,
  startedAt,
  sessionTitle,
  heroSummary,
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
  applySessionMeta,
}: SessionHeaderPanelProps) {
  return (
    <div className="relative z-20 surface shadow-soft rounded-[var(--studio-radius)] overflow-visible border border-[var(--studio-border)]">
      <div className="relative overflow-visible rounded-[var(--studio-radius)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-12 rounded-t-[var(--studio-radius)] bg-[linear-gradient(180deg,hsl(220_22%_96%/0.62),transparent_78%)] dark:bg-[linear-gradient(180deg,hsl(225_20%_18%/0.24),transparent_80%)]" />

        <div className="relative px-5 py-3.5 sm:px-6 sm:py-4">
          <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1.58fr)_220px] xl:items-start">
            <div className="min-w-0">
              <div className="ui-eyebrow">
                <Radio className="h-3.5 w-3.5" />
                {heroEyebrow}
                {heroHint ? <HintTooltip text={heroHint} side="right" /> : null}
              </div>

              <div className="mt-2 text-xs text-[color:var(--studio-muted2)]">Started {fmt(startedAt)}</div>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--studio-ink)] sm:text-[1.68rem]">
                {sessionTitle}
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[color:var(--studio-muted)]">{heroSummary}</p>
              <div className="mt-2 text-xs font-medium text-[color:var(--studio-muted2)]">
                {sessionMode === "rehearsal"
                  ? "Rehearsal mode · single participant only · invitations disabled"
                  : `Live exercise${sessionParticipantLimit ? ` · participant cap ${sessionParticipantLimit}` : ""}`}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  variant={copOpen ? "secondary" : "outline"}
                  onClick={() => setCopOpen((v) => !v)}
                  className="gap-2"
                  title="Toggle COP"
                  aria-expanded={copOpen}
                  aria-controls={copPanelId}
                >
                  <LayoutDashboard className="h-4 w-4 opacity-80" />
                  {copOpen ? "Hide COP" : "Open COP"}
                  <ChevronDown className={["h-4 w-4 opacity-70 transition-transform", copOpen ? "rotate-180" : ""].join(" ")} />
                </Button>

                {roleLoading ? (
                  <div className="px-2 text-xs text-[color:var(--studio-muted2)]">Loading role…</div>
                ) : isFacilitator ? (
                  <Button
                    variant={toolsOpen ? "secondary" : "outline"}
                    onClick={() => setToolsOpen((v) => !v)}
                    className="gap-2"
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

            <div className="grid gap-2.5">
              <RuntimeMetric label="Exercise clock" value={exerciseClock} icon={<Radio className="h-4 w-4" />} compact />
            </div>
          </div>
        </div>
      </div>

      {copOpen ? (
        <div id={copPanelId} className="border-t border-[var(--studio-border)]">
          <div className="px-5 py-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <LayoutDashboard className="h-4 w-4 opacity-80" />
                  COP
                  <HintTooltip
                    side="right"
                    text="Keep the shared situation picture current: event details, location, timing, and casualty counts."
                  />
                </div>
              </div>
            </div>

            <SituationCard
              scenario={scenario}
              situation={situation}
              onUpdateCasualties={async (p) => {
                if (!validSessionId) return;
                await onUpdateCasualties(p);
              }}
            />
          </div>
        </div>
      ) : null}

      {isFacilitator && toolsOpen ? (
        <div id={toolsPanelId} className="border-t border-[var(--studio-border)]">
          <div className="px-5 py-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Wrench className="h-4 w-4 opacity-80" />
                  Facilitator tools
                  <HintTooltip
                    side="right"
                    text="Release injects, manage runtime pressure, and steer the live run from one place."
                  />
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

