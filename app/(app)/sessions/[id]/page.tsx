"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import FacilitatorToolsPanel from "@/app/components/FacilitatorToolsPanel";
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
      className="h-9 w-full rounded-[var(--radius)] border border-border bg-background px-3 text-sm font-semibold text-foreground focus-visible:shadow-[var(--studio-ring)] focus-visible:outline-none"
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
      onClick={onClear}
      title={title}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted/40"
    >
      {label}
      <X className="h-3.5 w-3.5 opacity-70" />
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

  // Exercise clock (T=0 at sessions.started_at)
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [exerciseClock, setExerciseClock] = useState<string>("T=—");

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

  // Load started_at for exercise clock (best-effort; missing column must NOT crash)
  async function refreshStartedAt() {
    if (!validSessionId) return;
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select("started_at")
        .eq("id", sessionId)
        .maybeSingle();
      if (!error) {
        const v = (data as any)?.started_at ?? null;
        setStartedAt(typeof v === "string" && v ? v : null);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refreshStartedAt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, validSessionId]);

  useEffect(() => {
    const tick = () => {
      if (!startedAt) {
        setExerciseClock("T=—");
        return;
      }
      const t0 = new Date(startedAt).getTime();
      const now = Date.now();
      if (Number.isNaN(t0)) {
        setExerciseClock("T=—");
        return;
      }
      const diffMs = Math.max(0, now - t0);
      const totalSec = Math.floor(diffMs / 1000);
      const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
      const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
      const ss = String(totalSec % 60).padStart(2, "0");
      setExerciseClock(`T+${hh}:${mm}:${ss}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [startedAt]);

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
      <div className="p-6">
        <h2 className="text-lg font-semibold">Invalid session id</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This URL parameter must be a UUID. Go back and paste a valid{" "}
          <code>sessions.id</code> from Supabase.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold">Error</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  const sessionTitle = scenario?.title ? scenario.title : "Session";
  const sessionMeta = scenario?.short_description
    ? scenario.short_description
    : " ";

  const anyFiltersOn =
    Boolean(search.trim()) || Boolean(severity) || (activeTab === "inbox" && Boolean(channel));

  const LeftPanel = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex overflow-hidden rounded-[var(--radius)] border border-border bg-card">
          <button
            className={[
              "px-3 py-2 text-xs font-bold",
              activeTab === "inbox" ? "bg-muted" : "hover:bg-muted/40",
            ].join(" ")}
            onClick={() => {
              setActiveTab("inbox");
              setSelectedItem(null);
              setFiltersOpen(false);
            }}
          >
            Inbox
          </button>
          <button
            className={[
              "px-3 py-2 text-xs font-bold",
              activeTab === "pulse" ? "bg-muted" : "hover:bg-muted/40",
            ].join(" ")}
            onClick={() => {
              setActiveTab("pulse");
              setSelectedItem(null);
              setChannel(null);
              setFiltersOpen(false);
            }}
          >
            Pulse
          </button>
        </div>

        {isMobile ? (
          <Button variant="ghost" size="sm" onClick={() => setFeedOpen(false)}>
            Close
          </Button>
        ) : null}
      </div>

      {/* Search + Filters button */}
      <div className="flex items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title/body/sender…"
          className="flex-1"
        />
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-label="Filters"
          title="Filters"
        >
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Chips row */}
      <div className="flex flex-wrap items-center gap-2">
        {!anyFiltersOn ? (
          <span className="text-xs font-semibold text-muted-foreground">
            No filters
          </span>
        ) : (
          <>
            {search.trim() ? (
              <Chip label={`Search: ${search.trim()}`} onClear={() => setSearch("")} title="Clear search" />
            ) : null}
            {severity ? (
              <Chip label={`Severity: ${severity}`} onClear={() => setSeverity(null)} title="Clear severity" />
            ) : null}
            {activeTab === "inbox" && channel ? (
              <Chip label={`Channel: ${channel}`} onClear={() => setChannel(null)} title="Clear channel" />
            ) : null}

            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear all
            </Button>
          </>
        )}
      </div>

      {/* Collapsible Filters panel */}
      {filtersOpen ? (
        <Card className="surface border border-border">
          <CardContent className="space-y-3 p-3">
            <Select value={severity ?? ""} onChange={(v) => setSeverity(v ? v : null)}>
              <option value="">Severity: All</option>
              <option value="low">Severity: LOW</option>
              <option value="medium">Severity: MEDIUM</option>
              <option value="high">Severity: HIGH</option>
              <option value="critical">Severity: CRITICAL</option>
            </Select>

            {activeTab === "inbox" ? (
              <Select value={channel ?? ""} onChange={(v) => setChannel(v ? v : null)}>
                <option value="">Channel: All (non-pulse)</option>
                <option value="ops">Channel: OPS</option>
                <option value="media">Channel: MEDIA</option>
                <option value="social">Channel: SOCIAL</option>
              </Select>
            ) : null}

            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setFiltersOpen(false)}>
                Done
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "inbox" ? (
        <Inbox
          sessionId={sessionId}
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
  );

  const selectedActions = useMemo(() => {
    if (!selectedItem) return [];
    return actions.filter((a) => a.session_inject_id === selectedItem.id);
  }, [actions, selectedItem]);

  const MiddlePanel = (
    <div className="space-y-3">
      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Message detail</CardTitle>
            <CardDescription>
              {selectedItem ? "Selected" : "No selection"}
            </CardDescription>
          </div>

          {selectedItem ? (
            <span className="text-xs font-semibold text-muted-foreground">
              Actions: {actionsLoading ? "…" : selectedActions.length}
            </span>
          ) : null}
        </CardHeader>

        <CardContent>
          <MessageDetail
            item={selectedItem}
            mode={activeTab}
            actions={selectedActions}
            actionsLoading={actionsLoading}
            actionsError={actionsError}
            comment={comment}
            onCommentChange={setComment}
            onIgnore={() => doAction("ignore")}
            onEscalate={() => doAction("escalate")}
            onAct={() => doAction("act")}
            onConfirm={() => doPulseDecision("confirm")}
            onDeny={() => doPulseDecision("deny")}
          />
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* HEADER */}
      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="text-lg">{sessionTitle}</CardTitle>
            <CardDescription className="mt-1">{sessionMeta}</CardDescription>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-xs font-semibold">
              ⏱ {liveClock}
            </div>

            <div className="rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-xs font-semibold">
              {exerciseClock}
            </div>

            {roleLoading ? (
              <div className="text-xs font-semibold text-muted-foreground">
                Loading role…
              </div>
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
                    className="absolute right-0 top-10 z-50 w-[min(760px,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius)] border border-border popover-solid shadow-soft"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
                      <div className="text-sm font-bold">Facilitator panel</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setToolsOpen(false)}
                      >
                        Close
                      </Button>
                    </div>

                   <div className="p-4">
                   <FacilitatorToolsPanel sessionId={sessionId} scenarioId={scenario?.id ?? null} />
                  </div>

                  </div>
                ) : null}
              </div>
            ) : null}

            {isMobile ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setFeedOpen(true)}
              >
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
              if (!validSessionId) return;
              const s = await updateCasualties({
                sessionId,
                injured: p.injured,
                fatalities: p.fatalities,
                uninjured: p.uninjured,
                unknown: p.unknown,
              });
              setSituation(s);
            }}
          />
        </CardContent>
      </Card>

      {/* MAIN LAYOUT */}
      <div className="grid gap-3 lg:grid-cols-[360px_1fr]">
        {!isMobile ? <div>{LeftPanel}</div> : null}
        <div>{MiddlePanel}</div>
      </div>

      {/* MOBILE FEED DRAWER */}
      {isMobile && feedOpen ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setFeedOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 top-14 p-4">
            <div className="h-full">{LeftPanel}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
