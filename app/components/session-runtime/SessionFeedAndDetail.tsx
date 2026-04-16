"use client";

import { createPortal } from "react-dom";
import { FileText, MessagesSquare, Radio, SlidersHorizontal } from "lucide-react";

import type { SessionInject } from "@/lib/sessions";

import Inbox from "@/app/components/Inbox";
import MessageDetail from "@/app/components/MessageDetail";
import PulseFeed from "@/app/components/PulseFeed";
import HintTooltip from "@/app/components/HintTooltip";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

import { Badge, Chip, Select } from "./sessionRuntimeUi";

type SessionFeedAndDetailProps = {
  isMobile: boolean;
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
  inboxChannel: string | null;
  setInboxChannel: React.Dispatch<React.SetStateAction<string | null>>;
  pulseSearch: string;
  setPulseSearch: React.Dispatch<React.SetStateAction<string>>;
  pulseSeverity: string | null;
  setPulseSeverity: React.Dispatch<React.SetStateAction<string | null>>;
  clearInboxFilters: () => void;
  clearPulseFilters: () => void;
  inboxFiltersActive: boolean;
  pulseFiltersActive: boolean;
  isFacilitator: boolean;
  selectedActionsCount: number;
  actionsLoading: boolean;
  comment: string;
  setComment: React.Dispatch<React.SetStateAction<string>>;
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
  inboxChannel,
  setInboxChannel,
  pulseSearch,
  setPulseSearch,
  pulseSeverity,
  setPulseSeverity,
  clearInboxFilters,
  clearPulseFilters,
  inboxFiltersActive,
  pulseFiltersActive,
  isFacilitator,
  selectedActionsCount,
  actionsLoading,
  comment,
  setComment,
  doAction,
  doPulseDecision,
}: SessionFeedAndDetailProps) {
  return (
    <div className={isMobile ? "relative z-0 grid grid-cols-1 gap-4" : "relative z-0 grid grid-cols-12 gap-4"}>
      <div className={isMobile ? "" : "col-span-4"}>
        <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-visible border border-[var(--studio-border)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--studio-border)] px-4 py-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
                <MessagesSquare className="h-4 w-4 opacity-80" />
                Incoming updates
                <HintTooltip text="Watch the latest messages here and switch between Inbox and Pulse depending on what you need to review." />
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

                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <Select value={inboxSeverity ?? ""} onChange={(v) => setInboxSeverity(v ? v : null)}>
                                  <option value="">Urgency: All</option>
                                  <option value="low">LOW</option>
                                  <option value="medium">MEDIUM</option>
                                  <option value="high">HIGH</option>
                                  <option value="critical">CRITICAL</option>
                                </Select>

                                <Select value={inboxChannel ?? ""} onChange={(v) => setInboxChannel(v ? v : null)}>
                                  <option value="">Channel: All</option>
                                  <option value="ops">OPS</option>
                                  <option value="media">MEDIA</option>
                                  <option value="social">SOCIAL</option>
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
                                {inboxChannel ? <Chip label={`Channel: ${inboxChannel}`} onClear={() => setInboxChannel(null)} /> : null}
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
            <div className="mb-3 flex flex-wrap gap-2 px-1">
              <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2.5 py-1 text-[11px] text-[color:var(--studio-muted2)]">
                <kbd className="font-semibold text-foreground">i</kbd> Inbox
              </span>
              <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2.5 py-1 text-[11px] text-[color:var(--studio-muted2)]">
                <kbd className="font-semibold text-foreground">p</kbd> Pulse
              </span>
              <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2.5 py-1 text-[11px] text-[color:var(--studio-muted2)]">
                <kbd className="font-semibold text-foreground">f</kbd> Filters
              </span>
              <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2.5 py-1 text-[11px] text-[color:var(--studio-muted2)]">
                <kbd className="font-semibold text-foreground">d</kbd> Details
              </span>
              {isFacilitator ? (
                <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2.5 py-1 text-[11px] text-[color:var(--studio-muted2)]">
                  <kbd className="font-semibold text-foreground">t</kbd> Tools
                </span>
              ) : null}
            </div>
            {streamTab === "inbox" ? (
              <Inbox
                sessionId={sessionId}
                selectedId={selectedItem?.id ?? null}
                onSelect={(item) => {
                  setSelectedItem(item);
                  setFocusedThreadId(item.id);
                  setSelectedSource("inbox");
                }}
                channel={inboxChannel}
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

      <div className={isMobile ? "" : "col-span-8"}>
        <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden border border-[var(--studio-border)]">
          <div className="flex items-center justify-between border-b border-[var(--studio-border)] px-4 py-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
                <FileText className="h-4 w-4 opacity-80" />
                Selected update
                <HintTooltip text="Read the selected update here and record the response you want the team to take." />
              </div>
            </div>
            <div className="text-xs text-[color:var(--studio-muted2)]">
              {selectedItem ? `Responses saved: ${actionsLoading ? "…" : selectedActionsCount}` : "Nothing selected"}
            </div>
          </div>

          <div className="p-5">
            <MessageDetail
              item={selectedItem}
              activeTab={selectedSource}
              comment={comment}
              setComment={setComment}
              onIgnore={() => doAction("ignore")}
              onEscalate={() => doAction("escalate")}
              onAct={() => doAction("act")}
              onConfirm={() => doPulseDecision("confirm")}
              onDeny={() => doPulseDecision("deny")}
            />
            {!selectedItem ? (
              <div className="mt-4 rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-3 text-sm text-[color:var(--studio-muted)]">
                Start with the update feed on the left, then pick one message to review and respond from here.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

