"use client";

import { createPortal } from "react-dom";
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import { ChevronDown, ClipboardList, Play, RotateCcw, Search, Square, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";

import HintTooltip from "@/app/components/HintTooltip";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import type { Session } from "@/lib/sessionsRuntime";

import { Chip, CopyButton, fmt, ModePill, Select, StatusPill, type StatusFilter, toStatusFilter } from "./sessionUi";

type SessionLibraryProps = {
  filteredSessions: Session[];
  scenariosAvailable: boolean;
  q: string;
  setQ: Dispatch<SetStateAction<string>>;
  statusFilter: StatusFilter;
  setStatusFilter: Dispatch<SetStateAction<StatusFilter>>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  scenarioSelectRef: RefObject<HTMLSelectElement | null>;
  scenarioTitleById: Map<string, string | null>;
  router: ReturnType<typeof useRouter>;
  busyId: string | null;
  openMenuId: string | null;
  setOpenMenuId: Dispatch<SetStateAction<string | null>>;
  menuButtonRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  menuPanelRef: RefObject<HTMLDivElement | null>;
  menuPanelPosition: { top: number; left: number } | null;
  onEnd: (sessionId: string) => void;
  onRestart: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
};

export default function SessionLibrary({
  filteredSessions,
  scenariosAvailable,
  q,
  setQ,
  statusFilter,
  setStatusFilter,
  searchInputRef,
  scenarioSelectRef,
  scenarioTitleById,
  router,
  busyId,
  openMenuId,
  setOpenMenuId,
  menuButtonRefs,
  menuPanelRef,
  menuPanelPosition,
  onEnd,
  onRestart,
  onDelete,
}: SessionLibraryProps) {
  return (
    <Card className="surface shadow-soft border border-[var(--studio-border)] overflow-visible">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 xl:flex xl:min-h-10 xl:items-center">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 opacity-80" />
              Session library
              <HintTooltip text="Search, open, and manage exercise runs from one place." />
            </CardTitle>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[300px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search sessions…"
                className="pl-9"
              />
            </div>

            <div className="w-full sm:w-[180px]">
              <Select value={statusFilter} onChange={(value) => setStatusFilter(toStatusFilter(value))}>
                <option value="all">Status: All</option>
                <option value="live">Status: Live</option>
                <option value="ended">Status: Ended</option>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {q.trim() || statusFilter !== "all" ? (
          <div className="flex flex-wrap gap-2">
            {q.trim() ? <Chip label={`Search: ${q.trim()}`} onClear={() => setQ("")} /> : null}
            {statusFilter !== "all" ? <Chip label={`Status: ${statusFilter}`} onClear={() => setStatusFilter("all")} /> : null}
          </div>
        ) : null}

        {filteredSessions.length === 0 ? (
          q.trim() || statusFilter !== "all" ? (
            <div className="rounded-[16px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-4">
              <div className="text-sm font-medium text-foreground">No sessions match the current filters.</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Clear the search or status filter to get back to the full session library.
              </div>
              <div className="mt-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQ("");
                    setStatusFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-[16px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-4">
              <div className="text-sm font-medium text-foreground">No sessions yet.</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Launch your first exercise run from a scenario above, then come back here to manage it.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => scenarioSelectRef.current?.focus()} disabled={!scenariosAvailable}>
                  Create first session
                </Button>
                <Button variant="outline" onClick={() => router.push("/facilitator/scenarios")}>
                  Open scenarios
                </Button>
              </div>
            </div>
          )
        ) : (
          filteredSessions.map((session) => {
            const isBusy = busyId === session.id;
            const scenarioTitle =
              session.scenario?.title ??
              (session.scenario_id ? scenarioTitleById.get(session.scenario_id) : null) ??
              "—";
            const joinCode = String(session.join_code ?? "—");
            const status = session.status ?? null;

            return (
              <div
                key={session.id}
                className="rounded-[16px] border border-[var(--studio-border)] bg-[var(--studio-surface)] px-4 py-4 transition-transform duration-150 hover:-translate-y-[1px] md:px-5"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-lg font-semibold tracking-tight truncate">{session.title ?? "Untitled session"}</div>
                      <ModePill mode={session.session_mode} />
                      <StatusPill status={status} />
                    </div>

                    <div className="mt-2 text-sm leading-6 text-muted-foreground">
                      <span className="font-medium text-foreground">Scenario:</span> {scenarioTitle}
                    </div>

                    {session.session_mode === "live" ? (
                      <div className="mt-1.5 text-sm leading-6 text-muted-foreground">
                        <span className="font-medium text-foreground">Join code:</span>{" "}
                        <span className="font-mono tracking-[0.08em]">{joinCode}</span>
                        {typeof session.participant_limit === "number" ? (
                          <span className="ml-2">· participant cap {session.participant_limit}</span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-1.5 text-sm leading-6 text-muted-foreground">
                        <span className="font-medium text-foreground">Access:</span> Rehearsal mode · creator only
                      </div>
                    )}

                    <div className="mt-3 text-xs text-muted-foreground">
                      Created: {fmt(session.created_at)} <span className="mx-2">•</span>
                      Started: {fmt(session.started_at)} <span className="mx-2">•</span>
                      Ended: {fmt(session.ended_at)}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    <Button
                      variant="secondary"
                      onClick={() => router.push(`/sessions/${session.id}`)}
                      disabled={isBusy}
                      className="gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Open
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => router.push(`/facilitator/sessions/${session.id}/roster`)}
                      disabled={isBusy}
                      className="gap-2"
                    >
                      <Users className="h-4 w-4" />
                      Roster
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => router.push(`/facilitator/sessions/${session.id}/review`)}
                      disabled={isBusy}
                      className="gap-2"
                    >
                      <ClipboardList className="h-4 w-4" />
                      Review
                    </Button>

                    {session.session_mode === "live" ? <CopyButton value={joinCode} label="Join code" /> : null}

                    <div className="relative">
                      <Button
                        ref={(node) => {
                          menuButtonRefs.current[session.id] = node;
                        }}
                        variant="outline"
                        onClick={() => setOpenMenuId((value) => (value === session.id ? null : session.id))}
                        className="gap-2"
                        disabled={isBusy}
                        aria-haspopup="dialog"
                        aria-expanded={openMenuId === session.id}
                        aria-controls={openMenuId === session.id ? `session-actions-${session.id}` : undefined}
                      >
                        More <ChevronDown className="h-4 w-4 opacity-70" />
                      </Button>

                      {openMenuId === session.id && typeof document !== "undefined"
                        ? createPortal(
                            <div
                              id={`session-actions-${session.id}`}
                              ref={menuPanelRef}
                              role="dialog"
                              aria-label={`Actions for session ${session.title}`}
                              className="fixed z-[110] w-[220px] rounded-[16px] border border-[var(--studio-border-strong)] bg-[hsl(var(--popover)/0.98)] p-1.5 shadow-[0_16px_40px_hsl(220_20%_20%/0.14)] backdrop-blur-sm"
                              style={
                                menuPanelPosition
                                  ? { top: `${menuPanelPosition.top}px`, left: `${menuPanelPosition.left}px` }
                                  : { top: "-9999px", left: "-9999px" }
                              }
                            >
                              <div className="space-y-1">
                                <Button
                                  variant="ghost"
                                  className="w-full justify-start gap-2 rounded-[12px] border border-transparent px-3"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    onEnd(session.id);
                                  }}
                                  disabled={isBusy || String(status ?? "").toLowerCase() === "ended"}
                                  title="End session"
                                >
                                  <Square className="h-4 w-4" />
                                  End
                                </Button>

                                <Button
                                  variant="ghost"
                                  className="w-full justify-start gap-2 rounded-[12px] border border-transparent px-3"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    onRestart(session.id);
                                  }}
                                  disabled={isBusy}
                                  title="Restart session"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  Restart
                                </Button>

                                <Button
                                  variant="destructive"
                                  className="w-full justify-start gap-2 rounded-[12px] px-3"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    onDelete(session.id);
                                  }}
                                  disabled={isBusy}
                                  title="Delete session"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </Button>
                              </div>
                            </div>,
                            document.body
                          )
                        : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
