"use client";

import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, MessagesSquare, Radio, SlidersHorizontal } from "lucide-react";

import type { SessionInject } from "@/lib/sessions";

import Inbox from "@/app/components/Inbox";
import MessageDetail, { type TaskRoleOption } from "@/app/components/MessageDetail";
import PulseFeed from "@/app/components/PulseFeed";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

import { Badge, Chip, Select } from "./sessionRuntimeUi";

type SessionFeedAndDetailProps = {
  isMobile: boolean;
  participantView: boolean;
  sessionId: string;
  streamTab: "inbox" | "pulse";
  setStreamTab: React.Dispatch<React.SetStateAction<"inbox" | "pulse">>;
  selectedItem: SessionInject | null;
  setSelectedItem: React.Dispatch<React.SetStateAction<SessionInject | null>>;
  selectedSource: "inbox" | "pulse";
  setSelectedSource: React.Dispatch<React.SetStateAction<"inbox" | "pulse">>;
  setFocusedThreadId: React.Dispatch<React.SetStateAction<string | null>>;
  unseenInbox: number;
  unseenPulse: number;
  markSeen: (kind: "inbox" | "pulse") => void;
  refreshUnseen: () => void | Promise<void>;
  filtersOpen: boolean;
  setFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>;
  filtersWrapRef: React.RefObject<HTMLDivElement | null>;
  filtersButtonRef: React.RefObject<HTMLButtonElement | null>;
  filtersPanelRef: React.RefObject<HTMLDivElement | null>;
  filtersPanelPosition: { top: number; left: number } | null;
  filtersPanelId: string;
  inboxSearch: string;
  setInboxSearch: React.Dispatch<React.SetStateAction<string>>;
  inboxSeverity: string | null;
  setInboxSeverity: React.Dispatch<React.SetStateAction<string | null>>;
  pulseSearch: string;
  setPulseSearch: React.Dispatch<React.SetStateAction<string>>;
  pulseSeverity: string | null;
  setPulseSeverity: React.Dispatch<React.SetStateAction<string | null>>;
  clearInboxFilters: () => void;
  clearPulseFilters: () => void;
  inboxFiltersActive: boolean;
  pulseFiltersActive: boolean;
  runtimeNotice: string | null;
  comment: string;
  setComment: React.Dispatch<React.SetStateAction<string>>;
  taskOwnerRole: string;
  setTaskOwnerRole: React.Dispatch<React.SetStateAction<string>>;
  taskDuePreset: string;
  setTaskDuePreset: React.Dispatch<React.SetStateAction<string>>;
  taskRoleOptions: TaskRoleOption[];
  doAction: (actionType: "ignore" | "escalate" | "act") => void;
  doPulseDecision: (decision: "confirm" | "deny") => void;
};

export default function SessionFeedAndDetail({
  isMobile,
  sessionId,
  streamTab,
  setStreamTab,
  selectedItem,
  setSelectedItem,
  selectedSource,
  setSelectedSource,
  setFocusedThreadId,
  unseenInbox,
  unseenPulse,
  markSeen,
  refreshUnseen,
  filtersOpen,
  setFiltersOpen,
  filtersWrapRef,
  filtersButtonRef,
  filtersPanelRef,
  filtersPanelPosition,
  filtersPanelId,
  inboxSearch,
  setInboxSearch,
  inboxSeverity,
  setInboxSeverity,
  pulseSearch,
  setPulseSearch,
  pulseSeverity,
  setPulseSeverity,
  clearInboxFilters,
  clearPulseFilters,
  inboxFiltersActive,
  pulseFiltersActive,
  runtimeNotice,
  comment,
  setComment,
  taskOwnerRole,
  setTaskOwnerRole,
  taskDuePreset,
  setTaskDuePreset,
  taskRoleOptions,
  doAction,
  doPulseDecision,
}: SessionFeedAndDetailProps) {
  const splitRef = useRef<HTMLDivElement | null>(null);
  const [feedWidthPct, setFeedWidthPct] = useState(35);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = Number(window.localStorage.getItem("decisionary.sessionFeedSplit"));
        if (Number.isFinite(saved)) setFeedWidthPct(Math.min(52, Math.max(28, saved)));
      } catch {
        // Ignore storage access issues; the split still works for the current session.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const desktopGridStyle = useMemo(
    () =>
      isMobile
        ? undefined
        : {
            gridTemplateColumns: `minmax(320px, ${feedWidthPct}%) 12px minmax(420px, 1fr)`,
          },
    [feedWidthPct, isMobile]
  );

  const handleDividerPointerDown = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const container = splitRef.current;
    if (!container) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const move = (moveEvent: globalThis.PointerEvent) => {
      const bounds = container.getBoundingClientRect();
      if (bounds.width <= 0) return;
      const next = ((moveEvent.clientX - bounds.left) / bounds.width) * 100;
      const clamped = Math.min(52, Math.max(28, next));
      setFeedWidthPct(clamped);
      try {
        window.localStorage.setItem("decisionary.sessionFeedSplit", String(Math.round(clamped)));
      } catch {
        // Dragging should stay functional even when storage is unavailable.
      }
    };

    const up = () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", up, { once: true });
  }, []);

  return (
    <div
      ref={splitRef}
      className={isMobile ? "relative z-0 grid grid-cols-1 gap-4" : "relative z-0 grid gap-0"}
      style={desktopGridStyle}
    >
      <div className={isMobile ? "" : "min-w-0 pr-2"}>
        <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-visible border border-[var(--studio-border)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--studio-border)] px-4 py-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
                <MessagesSquare className="h-4 w-4 opacity-80" />
                Updates
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className={[
                  "h-9 px-3 rounded-[var(--radius)] border text-sm font-medium transition inline-flex items-center gap-2",
                  streamTab === "inbox"
                    ? "bg-primary/10 border-primary/25"
                    : "bg-[var(--studio-surface2)] border-[var(--studio-border)] hover:bg-secondary/60",
                ].join(" ")}
                onClick={() => {
                  setStreamTab("inbox");
                  setSelectedSource("inbox");
                  markSeen("inbox");
                  void refreshUnseen();
                }}
                aria-pressed={streamTab === "inbox"}
              >
                <MessagesSquare className="h-4 w-4 opacity-75" />
                Inbox <Badge n={unseenInbox} />
              </button>

              <button
                type="button"
                className={[
                  "h-9 px-3 rounded-[var(--radius)] border text-sm font-medium transition inline-flex items-center gap-2",
                  streamTab === "pulse"
                    ? "bg-primary/10 border-primary/25"
                    : "bg-[var(--studio-surface2)] border-[var(--studio-border)] hover:bg-secondary/60",
                ].join(" ")}
                onClick={() => {
                  setStreamTab("pulse");
                  setSelectedSource("pulse");
                  markSeen("pulse");
                  void refreshUnseen();
                }}
                aria-pressed={streamTab === "pulse"}
              >
                <Radio className="h-4 w-4 opacity-75" />
                Pulse <Badge n={unseenPulse} />
              </button>

              <div className="relative overflow-visible" ref={filtersWrapRef}>
                <Button
                  ref={filtersButtonRef}
                  variant="outline"
                  size="icon"
                  onClick={() => setFiltersOpen((v) => !v)}
                  title="Filters"
                  aria-label={`Open ${streamTab === "inbox" ? "inbox" : "pulse"} filters`}
                  aria-expanded={filtersOpen}
                  aria-controls={filtersPanelId}
                  className={
                    streamTab === "inbox"
                      ? inboxFiltersActive
                        ? "border-primary/25"
                        : ""
                      : pulseFiltersActive
                      ? "border-primary/25"
                      : ""
                  }
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>

                {filtersOpen && typeof document !== "undefined"
                  ? createPortal(
                      <div
                        id={filtersPanelId}
                        ref={filtersPanelRef}
                        role="dialog"
                        aria-label={streamTab === "inbox" ? "Inbox filters" : "Pulse filters"}
                        className="fixed z-[110] w-[360px] max-w-[92vw] popover-solid rounded-[14px] shadow-soft overflow-hidden"
                        style={
                          filtersPanelPosition
                            ? {
                                top: `${filtersPanelPosition.top}px`,
                                left: `${filtersPanelPosition.left}px`,
                              }
                            : {
                                top: "-9999px",
                                left: "-9999px",
                              }
                        }
                      >
                        <div className="px-4 py-3 border-b border-[var(--studio-border)] flex items-center justify-between">
                          <div className="text-sm font-semibold">{streamTab === "inbox" ? "Filter inbox" : "Filter pulse"}</div>
                          <Button variant="outline" onClick={() => setFiltersOpen(false)}>
                            Close
                          </Button>
                        </div>

                        <div className="p-4 space-y-3">
                          {streamTab === "inbox" ? (
                            <>
                              <Input value={inboxSearch} onChange={(e) => setInboxSearch(e.target.value)} placeholder="Search updates..." />

                              <div className="grid grid-cols-1 gap-2">
                                <Select value={inboxSeverity ?? ""} onChange={(v) => setInboxSeverity(v ? v : null)}>
                                  <option value="">Urgency: All</option>
                                  <option value="low">LOW</option>
                                  <option value="medium">MEDIUM</option>
                                  <option value="high">HIGH</option>
                                  <option value="critical">CRITICAL</option>
                                </Select>
                              </div>

                              <div className="flex gap-2">
                                <Button variant="secondary" className="flex-1" onClick={clearInboxFilters}>
                                  Clear
                                </Button>
                                <Button
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => {
                                    markSeen("inbox");
                                    void refreshUnseen();
                                  }}
                                  title="Mark current inbox items as read"
                                  aria-label="Mark current inbox items as read"
                                >
                                  Mark read
                                </Button>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {inboxSearch.trim() ? <Chip label={`Search: ${inboxSearch.trim()}`} onClear={() => setInboxSearch("")} /> : null}
                                {inboxSeverity ? <Chip label={`Urgency: ${inboxSeverity}`} onClear={() => setInboxSeverity(null)} /> : null}
                              </div>
                            </>
                          ) : (
                            <>
                              <Input value={pulseSearch} onChange={(e) => setPulseSearch(e.target.value)} placeholder="Search pulse updates..." />

                              <Select value={pulseSeverity ?? ""} onChange={(v) => setPulseSeverity(v ? v : null)}>
                                <option value="">Urgency: All</option>
                                <option value="low">LOW</option>
                                <option value="medium">MEDIUM</option>
                                <option value="high">HIGH</option>
                                <option value="critical">CRITICAL</option>
                              </Select>

                              <div className="flex gap-2">
                                <Button variant="secondary" className="flex-1" onClick={clearPulseFilters}>
                                  Clear
                                </Button>
                                <Button
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => {
                                    markSeen("pulse");
                                    void refreshUnseen();
                                  }}
                                  title="Mark current pulse items as read"
                                  aria-label="Mark current pulse items as read"
                                >
                                  Mark read
                                </Button>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {pulseSearch.trim() ? <Chip label={`Search: ${pulseSearch.trim()}`} onClear={() => setPulseSearch("")} /> : null}
                                {pulseSeverity ? <Chip label={`Urgency: ${pulseSeverity}`} onClear={() => setPulseSeverity(null)} /> : null}
                              </div>
                            </>
                          )}
                        </div>
                      </div>,
                      document.body
                    )
                  : null}
              </div>
            </div>
          </div>

          <div className="p-3">
            {streamTab === "inbox" ? (
              <Inbox
                sessionId={sessionId}
                selectedId={selectedItem?.id ?? null}
                onSelect={(item) => {
                  setSelectedItem(item);
                  setFocusedThreadId(item.id);
                  setSelectedSource("inbox");
                }}
                channel={null}
                severity={inboxSeverity}
                search={inboxSearch}
              />
            ) : (
              <PulseFeed
                sessionId={sessionId}
                selectedId={selectedItem?.id ?? null}
                onSelect={(item) => {
                  setSelectedItem(item);
                  setFocusedThreadId(item.id);
                  setSelectedSource("pulse");
                }}
                severity={pulseSeverity}
                search={pulseSearch}
              />
            )}
          </div>
        </div>
      </div>

      {!isMobile ? (
        <button
          type="button"
          className="group flex min-h-full cursor-col-resize items-stretch justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          onPointerDown={handleDividerPointerDown}
          aria-label="Resize updates and selected update panels"
          title="Resize panels"
        >
          <span className="my-3 w-px rounded-full bg-[var(--studio-border)] transition group-hover:bg-primary/40 group-focus-visible:bg-primary/50" />
        </button>
      ) : null}

      <div className={isMobile ? "" : "min-w-0 pl-2"}>
        <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden border border-[var(--studio-border)]">
          <div className="border-b border-[var(--studio-border)] px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
              <FileText className="h-4 w-4 opacity-80" />
              Selected update
            </div>
          </div>

          <div className="p-4">
            {runtimeNotice ? (
              <div className="mb-4 rounded-[14px] border border-emerald-500/15 bg-emerald-500/[0.06] px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                {runtimeNotice}
              </div>
            ) : null}
            <MessageDetail
              item={selectedItem}
              activeTab={selectedSource}
              comment={comment}
              setComment={setComment}
              taskOwnerRole={taskOwnerRole}
              setTaskOwnerRole={setTaskOwnerRole}
              taskDuePreset={taskDuePreset}
              setTaskDuePreset={setTaskDuePreset}
              taskRoleOptions={taskRoleOptions}
              onIgnore={() => doAction("ignore")}
              onEscalate={() => doAction("escalate")}
              onAct={() => doAction("act")}
              onConfirm={() => doPulseDecision("confirm")}
              onDeny={() => doPulseDecision("deny")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
