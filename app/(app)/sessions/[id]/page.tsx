"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import type { Scenario } from "@/lib/scenarios";
import {
  getSessionSituation,
  updateCasualties,
  type SessionSituation,
  type SessionInject,
  getSessionActions,
  addSessionAction,
  type SessionAction,
} from "@/lib/sessions";

import SituationCard from "@/app/components/SituationCard";
import MessageDetail from "@/app/components/MessageDetail";
import FacilitatorControls from "@/app/components/FacilitatorControls";
import AddInjectForm from "@/app/components/AddInjectForm";
import Inbox from "@/app/components/Inbox";
import PulseFeed from "@/app/components/PulseFeed";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

import { Filter, X } from "lucide-react";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

type FeedTab = "inbox" | "pulse";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    onChange();
    m.addEventListener?.("change", onChange);
    return () => m.removeEventListener?.("change", onChange);
  }, [query]);
  return matches;
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-[var(--radius)] border border-border bg-background px-3 text-sm font-semibold text-foreground
                 focus-visible:shadow-[var(--studio-ring)] focus-visible:outline-none"
    >
      {children}
    </select>
  );
}

function Chip({
  label,
  onClear,
  title,
}: {
  label: string;
  onClear: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      title={title ?? "Clear"}
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-xs font-semibold
                 text-foreground hover:bg-secondary transition"
    >
      <span className="truncate">{label}</span>
      <X size={14} className="shrink-0 text-muted-foreground" />
    </button>
  );
}

export default function SessionParticipantPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params?.id ?? "";
  const validSessionId = useMemo(() => isUuid(sessionId), [sessionId]);

  const isMobile = useMediaQuery("(max-width: 1100px)");

  const [situation, setSituation] = useState<SessionSituation | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<FeedTab>("inbox");
  const [selectedItem, setSelectedItem] = useState<SessionInject | null>(null);

  // Filters (LEFT)
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<string | null>(null);
  const [channel, setChannel] = useState<string | null>(null); // only Inbox
  const [feedOpen, setFeedOpen] = useState(false); // mobile drawer
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Actions + log state
  const [actions, setActions] = useState<SessionAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [actionsError, setActionsError] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  // Facilitator tools popover
  const [toolsOpen, setToolsOpen] = useState(false);

  // Role gating
  const [isFacilitator, setIsFacilitator] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  // Session owner (fallback facilitator)
  const [sessionOwnerId, setSessionOwnerId] = useState<string | null>(null);

  // Live clock
  const [liveClock, setLiveClock] = useState("");

  useEffect(() => {
    const tick = () =>
      setLiveClock(
        new Date().toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Close tools popover on Escape / outside click
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setToolsOpen(false);
    }
    function onClick() {
      if (toolsOpen) setToolsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [toolsOpen]);

  // Close filters on Escape (quality-of-life)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFiltersOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load role (with owner fallback)
  useEffect(() => {
    if (!validSessionId) return;
    let alive = true;

    (async () => {
      try {
        setRoleLoading(true);

        const { data: u } = await supabase.auth.getUser();
        const authUserId = u.user?.id;

        if (!authUserId) {
          if (alive) setIsFacilitator(false);
          return;
        }

        // Fallback: session owner is facilitator
        if (sessionOwnerId && sessionOwnerId === authUserId) {
          if (alive) setIsFacilitator(true);
          return;
        }

        const { data, error } = await supabase
          .from("session_role_assignments")
          .select("*")
          .eq("session_id", sessionId);

        if (error) throw error;

        const rows = (data ?? []) as any[];
        const match = rows.find((r) => {
          const roleKey = r?.role_key ?? r?.role ?? r?.role_id ?? null;
          const uid =
            r?.user_id ??
            r?.member_id ??
            r?.profile_id ??
            r?.participant_id ??
            r?.owner_id ??
            null;
          return roleKey === "facilitator" && uid === authUserId;
        });

        if (alive) setIsFacilitator(Boolean(match));
      } catch {
        if (alive) setIsFacilitator(false);
      } finally {
        if (alive) setRoleLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [sessionId, validSessionId, sessionOwnerId]);

  // Load situation (COP)
  useEffect(() => {
    if (!validSessionId) return;
    let alive = true;
    setError(null);

    getSessionSituation(sessionId)
      .then((s) => {
        if (!alive) return;
        setSituation(s);
      })
      .catch((e) => alive && setError(e?.message ?? "Failed to load situation"));

    return () => {
      alive = false;
    };
  }, [sessionId, validSessionId]);

  // Load scenario fallback (sessions.scenario_id -> scenarios.*) + owner (safe)
  useEffect(() => {
    if (!validSessionId) return;
    let alive = true;

    (async () => {
      try {
        const { data: sess1, error: sessErr1 } = await supabase
          .from("sessions")
          .select("scenario_id")
          .eq("id", sessionId)
          .single();
        if (sessErr1) throw sessErr1;

        const scenarioId =
          (sess1 as any)?.scenario_id ??
          (sess1 as any)?.scenario ??
          (sess1 as any)?.scenarioId ??
          null;

        // owner lookup (best-effort; missing column must NOT crash)
        const ownerCandidates = [
          "owner_id",
          "created_by",
          "created_by_id",
          "owner",
          "user_id",
        ] as const;
        let ownerId: string | null = null;

        for (const col of ownerCandidates) {
          const { data, error } = await supabase
            .from("sessions")
            .select(col)
            .eq("id", sessionId)
            .single();

          if (!error) {
            const v = (data as any)?.[col];
            if (typeof v === "string" && v) ownerId = v;
            break; // column exists (even if null)
          }
        }

        if (alive) setSessionOwnerId(ownerId);

        if (!scenarioId) {
          if (alive) setScenario(null);
          return;
        }

        const { data: sc, error: scErr } = await supabase
          .from("scenarios")
          .select("*")
          .eq("id", scenarioId)
          .single();

        if (scErr) throw scErr;
        if (alive) setScenario(sc as Scenario);
      } catch (e: any) {
        if (alive) {
          setScenario(null);
          setError((prev) =>
            prev ??
            (e?.message ? `Scenario load: ${e.message}` : "Scenario load failed")
          );
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [sessionId, validSessionId]);

  // Load action log
  useEffect(() => {
    if (!validSessionId) return;
    let alive = true;
    setActionsLoading(true);
    setActionsError(null);

    getSessionActions(sessionId, 50)
      .then((rows) => alive && setActions(rows))
      .catch((e) => alive && setActionsError(e?.message ?? "Failed to load actions"))
      .finally(() => alive && setActionsLoading(false));

    return () => {
      alive = false;
    };
  }, [sessionId, validSessionId]);

  function clearFilters() {
    setSearch("");
    setSeverity(null);
    setChannel(null);
  }

  async function doAction(actionType: "ignore" | "escalate" | "act") {
    if (!selectedItem) return;

    try {
      const saved = await addSessionAction({
        sessionId,
        sessionInjectId: selectedItem.id,
        source: activeTab,
        actionType,
        comment: comment.trim() ? comment.trim() : null,
      });

      setActions((prev) => [saved, ...prev]);

      if (actionType === "act") {
        const title = `Update: action taken on "${
          selectedItem.injects?.title ?? "message"
        }"`;
        const body =
          `Decision recorded.\n\n` +
          `Action: ACT\n` +
          `Source: ${activeTab.toUpperCase()}\n` +
          `Reference message ID: ${selectedItem.id}\n` +
          (comment.trim() ? `\nComment:\n${comment.trim()}\n` : "") +
          `\nNext update will follow.`;

        const { sendInjectToSession } = await import("@/lib/sessions");
        await sendInjectToSession(sessionId, title, body);
      }

      setComment("");
    } catch (e: any) {
      alert(e?.message ?? "Failed to save action");
    }
  }

  async function doPulseDecision(decision: "confirm" | "deny") {
    if (!selectedItem) return;

    try {
      const saved = await addSessionAction({
        sessionId,
        sessionInjectId: selectedItem.id,
        source: "pulse",
        actionType: decision === "confirm" ? "act" : "ignore",
        comment: comment.trim()
          ? `${decision.toUpperCase()}: ${comment.trim()}`
          : `${decision.toUpperCase()}`,
      });

      setActions((prev) => [saved, ...prev]);

      const pulseTitle = selectedItem.injects?.title ?? "pulse post";
      const pulseBody = selectedItem.injects?.body ?? "";

      const title =
        decision === "confirm"
          ? `Official confirmation regarding "${pulseTitle}"`
          : `Official denial regarding "${pulseTitle}"`;

      const body =
        (decision === "confirm"
          ? `We confirm that the information circulating is accurate.`
          : `We deny the information currently circulating.`) +
        `\n\nReference pulse message ID: ${selectedItem.id}` +
        (comment.trim() ? `\n\nComment:\n${comment.trim()}` : "") +
        (pulseBody ? `\n\nQuoted content:\n${pulseBody}` : "");

      const { sendInjectToSession } = await import("@/lib/sessions");
      await sendInjectToSession(sessionId, title, body);

      setComment("");
    } catch (e: any) {
      alert(e?.message ?? "Failed to process Pulse decision");
    }
  }

  if (!sessionId) return <>Loading…</>;

  if (!validSessionId) {
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Invalid session id</h2>
        <p className="text-sm text-muted-foreground">
          This URL parameter must be a UUID. Go back and paste a valid{" "}
          <code>sessions.id</code> from Supabase.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Error</h2>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  const sessionTitle = scenario?.title ? scenario.title : "Session";
  const sessionMeta = scenario?.short_description ? scenario.short_description : " ";

  const anyFiltersOn =
    Boolean(search.trim()) || Boolean(severity) || (activeTab === "inbox" && Boolean(channel));

  const LeftPanel = (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === "inbox" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setActiveTab("inbox");
              setSelectedItem(null);
              setFiltersOpen(false);
            }}
          >
            Inbox
          </Button>
          <Button
            variant={activeTab === "pulse" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setActiveTab("pulse");
              setSelectedItem(null);
              setChannel(null);
              setFiltersOpen(false);
            }}
          >
            Pulse
          </Button>
        </div>

        {isMobile ? (
          <Button variant="secondary" size="sm" onClick={() => setFeedOpen(false)}>
            Close
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Search + Filters button */}
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title/body/sender…"
            className="flex-1"
          />

          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-label="Filters"
            title="Filters"
          >
            <Filter size={18} />
          </Button>
        </div>

        {/* Chips row */}
        <div className="flex flex-wrap items-center gap-2">
          {!anyFiltersOn ? (
            <span className="text-xs font-semibold text-muted-foreground">No filters</span>
          ) : (
            <>
              {search.trim() ? (
                <Chip
                  label={`Search: ${search.trim()}`}
                  onClear={() => setSearch("")}
                  title="Clear search"
                />
              ) : null}

              {severity ? (
                <Chip
                  label={`Severity: ${severity}`}
                  onClear={() => setSeverity(null)}
                  title="Clear severity"
                />
              ) : null}

              {activeTab === "inbox" && channel ? (
                <Chip
                  label={`Channel: ${channel}`}
                  onClear={() => setChannel(null)}
                  title="Clear channel"
                />
              ) : null}

              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center rounded-full border border-border bg-background px-2 py-1 text-xs font-semibold
                           text-muted-foreground hover:bg-secondary transition"
                title="Clear all"
              >
                Clear all
              </button>
            </>
          )}
        </div>

        {/* Collapsible Filters panel */}
        {filtersOpen ? (
          <div className="space-y-3 rounded-[var(--radius)] border border-border bg-muted/30 p-3">
            <Select value={severity ?? ""} onChange={(v) => setSeverity(v ? v : null)}>
              <option value="">Severity: All</option>
              <option value="LOW">Severity: LOW</option>
              <option value="MEDIUM">Severity: MEDIUM</option>
              <option value="HIGH">Severity: HIGH</option>
              <option value="CRITICAL">Severity: CRITICAL</option>
            </Select>

            {activeTab === "inbox" ? (
              <Select value={channel ?? ""} onChange={(v) => setChannel(v ? v : null)}>
                <option value="">Channel: All (non-pulse)</option>
                <option value="OPS">Channel: OPS</option>
                <option value="MEDIA">Channel: MEDIA</option>
                <option value="SOCIAL">Channel: SOCIAL</option>
              </Select>
            ) : null}

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={clearFilters}>
                Clear
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setFiltersOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : null}

        <div className="pt-1">
          {activeTab === "inbox" ? (
            <Inbox
              sessionId={sessionId}
              mode="inbox"
              selectedId={selectedItem?.id ?? null}
              onSelect={(item) => {
                setSelectedItem(item);
                if (isMobile) setFeedOpen(false);
              }}
              channel={channel}
              severity={severity}
              search={search}
            />
          ) : (
            <PulseFeed
              sessionId={sessionId}
              selectedId={selectedItem?.id ?? null}
              onSelect={(item) => {
                setSelectedItem(item);
                if (isMobile) setFeedOpen(false);
              }}
              severity={severity}
              search={search}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );

  const MiddlePanel = (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Message detail</CardTitle>
            <CardDescription>{selectedItem ? "Selected" : "No selection"}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <MessageDetail item={selectedItem} mode={activeTab} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Actions</CardTitle>
            <CardDescription>{selectedItem ? "Ready" : "Pick a message to act"}</CardDescription>
          </div>

          {actionsLoading ? (
            <span className="text-xs font-semibold text-muted-foreground">Loading…</span>
          ) : actionsError ? (
            <span className="text-xs font-semibold text-muted-foreground">{actionsError}</span>
          ) : (
            <span className="text-xs font-semibold text-muted-foreground">
              {actions.length ? `${actions.length} logged` : "No log yet"}
            </span>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              activeTab === "pulse"
                ? "Optional comment (why confirm/deny)"
                : "Optional comment (what you did / why)"
            }
            className="min-h-[88px] w-full resize-y rounded-[var(--radius)] border border-border bg-background p-3 text-sm
                       focus-visible:shadow-[var(--studio-ring)] focus-visible:outline-none"
          />

          {activeTab === "pulse" ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="primary"
                onClick={() => doPulseDecision("confirm")}
                disabled={!selectedItem}
              >
                Confirm
              </Button>
              <Button variant="danger" onClick={() => doPulseDecision("deny")} disabled={!selectedItem}>
                Deny
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Button variant="ghost" onClick={() => doAction("ignore")} disabled={!selectedItem}>
                Ignore
              </Button>
              <Button variant="secondary" onClick={() => doAction("escalate")} disabled={!selectedItem}>
                Escalate
              </Button>
              <Button variant="primary" onClick={() => doAction("act")} disabled={!selectedItem}>
                Act
              </Button>
            </div>
          )}

          <p className="text-xs font-semibold text-muted-foreground">
            Select a message to enable context-aware actions.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="text-lg">{sessionTitle}</CardTitle>
            <CardDescription className="mt-1">{sessionMeta}</CardDescription>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-xs font-semibold">
              ⏱ {liveClock}
            </div>

            {roleLoading ? (
              <div className="text-xs font-semibold text-muted-foreground">Loading role…</div>
            ) : isFacilitator ? (
              <div className="relative">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setToolsOpen((v) => !v);
                  }}
                >
                  Facilitator tools
                </Button>

                {toolsOpen ? (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 mt-2 w-[560px] max-w-[90vw] overflow-hidden rounded-[var(--radius)] border border-border bg-popover shadow-soft"
                  >
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <div className="text-sm font-semibold">In-session controls</div>
                      <Button variant="ghost" size="sm" onClick={() => setToolsOpen(false)}>
                        Close
                      </Button>
                    </div>

                    <div className="grid gap-4 p-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-muted-foreground">Controls</div>
                        <FacilitatorControls sessionId={sessionId} />
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-muted-foreground">New inject</div>
                        <AddInjectForm sessionId={sessionId} />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isMobile ? (
              <Button variant="secondary" size="sm" onClick={() => setFeedOpen(true)}>
                Open feed
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent>
          <SituationCard
            situation={situation}
            scenario={scenario}
            onUpdateCasualties={async (p: {
              injured: number;
              fatalities: number;
              uninjured: number;
              unknown: number;
            }) => {
              const next = await updateCasualties({
                sessionId,
                injured: p.injured,
                fatalities: p.fatalities,
                uninjured: p.uninjured,
                unknown: p.unknown,
              });
              setSituation(next);
            }}
          />
        </CardContent>
      </Card>

      {/* WORKSPACE */}
      <div
        className={[
          "grid gap-4",
          isMobile ? "grid-cols-1" : "grid-cols-[360px_minmax(520px,1fr)]",
        ].join(" ")}
      >
        {!isMobile ? <div>{LeftPanel}</div> : null}
        <div>{MiddlePanel}</div>
      </div>

      {/* MOBILE FEED DRAWER */}
      {isMobile && feedOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setFeedOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 top-14 p-4">
            <div className="h-full">{LeftPanel}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
