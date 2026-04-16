"use client";

import { CheckSquare, Sparkles } from "lucide-react";

import type { SessionConsequence, SessionTask } from "@/lib/sessionEngine";

import HintTooltip from "@/app/components/HintTooltip";
import { Button } from "@/app/components/ui/button";

import {
  consequenceImpactLabel,
  consequenceSeverityTone,
  consequenceTypeLabel,
  fmt,
  taskPriorityTone,
  taskStatusTone,
} from "./sessionRuntimeUi";

type SessionParticipantBoardsProps = {
  isMobile: boolean;
  overdueTaskCount: number;
  openTasks: SessionTask[];
  selectedItemExists: boolean;
  participantFocusText: string;
  latestConsequence: SessionConsequence | null;
  participantVisibleTasks: SessionTask[];
  taskBusyId: string | null;
  handleTaskStatus: (taskId: string, status: SessionTask["status"]) => void;
};

export default function SessionParticipantBoards({
  isMobile,
  overdueTaskCount,
  openTasks,
  selectedItemExists,
  participantFocusText,
  latestConsequence,
  participantVisibleTasks,
  taskBusyId,
  handleTaskStatus,
}: SessionParticipantBoardsProps) {
  return (
    <div className={isMobile ? "grid grid-cols-1 gap-4" : "grid grid-cols-12 gap-4"}>
      <div className={isMobile ? "" : "col-span-4"}>
        <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden border border-[var(--studio-border)]">
          <div className="border-b border-[var(--studio-border)] px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
              <Sparkles className="h-4 w-4 opacity-80" />
              What matters now
            </div>
            <div className="mt-1 text-xs text-[color:var(--studio-muted2)]">
              A short read on the most important thing to address next.
            </div>
          </div>
          <div className="p-5">
            <div className="rounded-[18px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-4 py-4 shadow-[0_10px_24px_hsl(220_20%_20%/0.03)]">
              <div className="text-sm leading-7 text-[color:var(--studio-muted)]">
                {overdueTaskCount > 0
                  ? "There are overdue follow-ups waiting. Start with the oldest open task and close the loop before moving on."
                  : openTasks.length > 0
                  ? participantFocusText
                  : selectedItemExists
                  ? "No follow-up has been assigned yet. Review this update and record the response that best fits the situation."
                  : "Choose an update from the left to continue the exercise."}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[color:var(--studio-muted2)]">
                {overdueTaskCount > 0 ? (
                  <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 font-semibold text-orange-800 dark:text-orange-300">
                    Suggested next move: clear overdue follow-ups
                  </span>
                ) : selectedItemExists ? (
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 font-semibold text-[color:var(--studio-ink)]">
                    Suggested next move: record a response for the selected update
                  </span>
                ) : (
                  <span className="rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface)] px-2.5 py-1 font-semibold">
                    Suggested next move: choose one update chain to focus
                  </span>
                )}
              </div>
              {latestConsequence?.description ? (
                <div className="mt-3 rounded-[14px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-3 py-3 text-sm text-[color:var(--studio-muted)]">
                  <div className="ui-section-label">Latest change</div>
                  <div className="mt-1 font-medium text-[color:var(--studio-ink)]">{latestConsequence.title}</div>
                  <div className="mt-1">{latestConsequence.description}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className={isMobile ? "" : "col-span-8"}>
        <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden border border-[var(--studio-border)]">
          <div className="flex items-center justify-between border-b border-[var(--studio-border)] px-4 py-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
                <CheckSquare className="h-4 w-4 opacity-80" />
                Current follow-ups
              </div>
              <div className="mt-1 text-xs text-[color:var(--studio-muted2)]">
                The actions that currently need attention during the exercise.
              </div>
            </div>
            <div className="text-xs text-[color:var(--studio-muted2)]">{`${participantVisibleTasks.length} shown`}</div>
          </div>

          <div className="p-5">
            <div className="space-y-3">
              {participantVisibleTasks.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-4 py-5 text-sm text-[color:var(--studio-muted2)]">
                  No follow-ups are assigned right now.
                </div>
              ) : (
                participantVisibleTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-[18px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-4 py-4 shadow-[0_10px_24px_hsl(220_20%_20%/0.03)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex items-start gap-3">
                        <div
                          className={[
                            "mt-0.5 h-5 w-5 shrink-0 rounded-full border-2",
                            task.status === "done"
                              ? "border-emerald-500 bg-emerald-500"
                              : task.status === "in_progress"
                              ? "border-sky-500 bg-sky-500/15"
                              : "border-[var(--studio-border-strong)] bg-transparent",
                          ].join(" ")}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-[color:var(--studio-ink)]">{task.title}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--studio-muted2)]">
                            <span className={["rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase", taskStatusTone(task.status)].join(" ")}>
                              {task.status.replaceAll("_", " ")}
                            </span>
                            <span>{task.due_at ? `Due ${fmt(task.due_at)}` : "No deadline"}</span>
                          </div>
                        </div>
                      </div>
                      <span className={["rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase", taskPriorityTone(task.priority)].join(" ")}>
                        {task.priority}
                      </span>
                    </div>
                    {task.description ? (
                      <div className="mt-3 pl-8 text-sm leading-6 text-[color:var(--studio-muted)]">{task.description}</div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--studio-border)] pt-3 pl-8">
                      <div className="text-xs text-[color:var(--studio-muted2)]">
                        {task.assigned_role ? `Owner: ${task.assigned_role}` : "No owner yet"}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {task.status !== "in_progress" && task.status !== "done" ? (
                          <Button size="sm" variant="outline" disabled={taskBusyId === task.id} onClick={() => handleTaskStatus(task.id, "in_progress")}>
                            Start
                          </Button>
                        ) : null}
                        {task.status !== "done" ? (
                          <Button size="sm" variant="secondary" disabled={taskBusyId === task.id} onClick={() => handleTaskStatus(task.id, "done")}>
                            Mark done
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
