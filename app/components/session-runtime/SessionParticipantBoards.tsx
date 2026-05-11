"use client";

import { CheckSquare, Sparkles } from "lucide-react";

import type { SessionConsequence, SessionTask } from "@/lib/sessionEngine";

import { Button } from "@/app/components/ui/button";

import {
  fmt,
  taskPriorityTone,
  taskStatusTone,
} from "./sessionRuntimeUi";

type SessionParticipantBoardsProps = {
  participantView: boolean;
  overdueTaskCount: number;
  openTasks: SessionTask[];
  selectedItemExists: boolean;
  participantFocusText: string;
  latestConsequence: SessionConsequence | null;
  participantVisibleTasks: SessionTask[];
  suggestedTaskId: string | null;
  canManageTasks: boolean;
  taskBusyId: string | null;
  handleTaskStatus: (taskId: string, status: SessionTask["status"]) => void;
};

export default function SessionParticipantBoards({
  participantView,
  overdueTaskCount,
  openTasks,
  selectedItemExists,
  participantFocusText,
  latestConsequence,
  participantVisibleTasks,
  suggestedTaskId,
  canManageTasks,
  taskBusyId,
  handleTaskStatus,
}: SessionParticipantBoardsProps) {
  if (!selectedItemExists && participantVisibleTasks.length === 0 && !latestConsequence) {
    return null;
  }

  const summaryText =
    overdueTaskCount > 0
      ? participantView
        ? "There are overdue next steps waiting. Start with the oldest open item before moving on."
        : "There are overdue follow-ups waiting. Start with the oldest open task and close the loop before moving on."
      : openTasks.length > 0
      ? participantFocusText
      : selectedItemExists
      ? participantView
        ? "No next step has been captured yet. Review this update and record the response that best fits the situation."
        : "No follow-up has been assigned yet. Review this update and record the response that best fits the situation."
      : participantView
      ? "No next steps yet."
      : "No follow-ups yet.";

  const summaryChip =
    overdueTaskCount > 0
      ? participantView
        ? "Clear overdue next steps first"
        : "Clear overdue follow-ups first"
      : null;

  return (
    <section className="space-y-2">
      <div className="overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
              <CheckSquare className="h-4 w-4 opacity-80" />
              {participantView ? "Next steps" : "Current follow-ups"}
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="ui-session-shell px-4 py-3">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 opacity-80 text-[color:var(--studio-muted2)]" />
              <div className="min-w-0">
                <div className="text-sm leading-7 text-[color:var(--studio-muted)]">{summaryText}</div>
                {summaryChip ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span
                      className={[
                        "rounded-full border px-2.5 py-1 font-semibold",
                        overdueTaskCount > 0
                          ? "border-orange-500/20 bg-orange-500/10 text-orange-800 dark:text-orange-300"
                          : "border-primary/20 bg-primary/10 text-[color:var(--studio-ink)]",
                      ].join(" ")}
                    >
                      Next move: {summaryChip}
                    </span>
                  </div>
                ) : null}
                {latestConsequence?.description ? (
                  <div className="mt-3 rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[color:var(--studio-muted)]">
                    <div className="ui-section-label">Latest change</div>
                    <div className="mt-1 font-medium text-[color:var(--studio-ink)]">{latestConsequence.title}</div>
                    <div className="mt-1">{latestConsequence.description}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {participantVisibleTasks.length > 0
              ? participantVisibleTasks.map((task) => (
                <div
                  key={task.id}
                  className={[
                    "rounded-[8px] border px-4 py-4 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.018)]",
                    suggestedTaskId === task.id
                      ? "border-primary/20 bg-primary/[0.06]"
                      : "border-[var(--studio-border)] bg-[hsl(var(--card))]",
                  ].join(" ")}
                >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex items-start gap-3">
                        <div
                          className={[
                            "mt-0.5 h-5 w-5 shrink-0 rounded-full border-2",
                            task.status === "done"
                              ? "border-emerald-500 bg-emerald-500"
                              : task.status === "blocked"
                              ? "border-red-500 bg-red-500/15"
                              : task.status === "in_progress"
                              ? "border-sky-500 bg-sky-500/15"
                              : "border-[var(--studio-border-strong)] bg-transparent",
                          ].join(" ")}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-[color:var(--studio-ink)]">{task.title}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--studio-muted2)]">
                            {suggestedTaskId === task.id ? (
                              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--studio-ink)]">
                                {participantView ? "Suggested next step" : "Suggested first follow-up"}
                              </span>
                            ) : null}
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
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-1 pl-8">
                      <div className="text-xs text-[color:var(--studio-muted2)]">
                        {task.assigned_role ? `Owner: ${task.assigned_role}` : "No owner yet"}
                      </div>
                      {canManageTasks ? (
                        <div className="flex flex-wrap gap-2">
                          {task.status !== "in_progress" && task.status !== "done" && task.status !== "cancelled" ? (
                            <Button size="sm" variant="outline" disabled={taskBusyId === task.id} onClick={() => handleTaskStatus(task.id, "in_progress")}>
                              Start
                            </Button>
                          ) : null}
                          {task.status !== "blocked" && task.status !== "done" && task.status !== "cancelled" ? (
                            <Button size="sm" variant="outline" disabled={taskBusyId === task.id} onClick={() => handleTaskStatus(task.id, "blocked")}>
                              Block
                            </Button>
                          ) : null}
                          {task.status !== "done" ? (
                            <Button size="sm" variant="secondary" disabled={taskBusyId === task.id} onClick={() => handleTaskStatus(task.id, "done")}>
                              Mark done
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                </div>
              ))
              : null}
          </div>
        </div>
      </div>
    </section>
  );
}
