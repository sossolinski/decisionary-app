"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { deliverDueInjects, sendInjectToSession } from "@/lib/sessions";
import { listScenarioInjects, type ScenarioInject } from "@/lib/scenarios";
import { getErrorMessage } from "@/lib/errors";
import { normalizeSessionStatus } from "@/lib/sessionStatus";
import { validateMessagePayload } from "@/lib/validators";
import {
  listSessionConsequences,
  listSessionTasks,
  processOverdueSessionTasks,
  type SessionConsequence,
  type SessionTask,
} from "@/lib/sessionEngine";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { ChevronDown, ChevronUp, Send, Sparkles, TimerReset, Zap } from "lucide-react";

type SessionMeta = {
  status: string | null;
  join_code: string | null;
  started_at: string | null;
  ended_at: string | null;
  scenario_id: string | null;
};

function fmtIso(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-2.5 py-1 text-xs font-semibold text-[color:var(--studio-ink)]">
      {children}
    </span>
  );
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

export default function FacilitatorToolsPanel({
  sessionId,
  scenarioId,
  compact = false,
  onSessionMetaChange,
}: {
  sessionId: string;
  scenarioId: string | null;
  compact?: boolean;
  onSessionMetaChange?: (meta: SessionMeta | null) => void;
}) {
  const [meta, setMeta] = useState<SessionMeta | null>(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [engineRefreshing, setEngineRefreshing] = useState(false);

  // collapsibles
  const [injectReleaseOpen, setInjectReleaseOpen] = useState(false);
  const [quickMsgOpen, setQuickMsgOpen] = useState(false);

  // Scenario inject library
  const [scenarioInjects, setScenarioInjects] = useState<ScenarioInject[]>([]);
  const [deliveredIds, setDeliveredIds] = useState<Set<string>>(new Set());
  const [selectedSiId, setSelectedSiId] = useState<string>("");

  // Quick message (ad-hoc) — consistent fields
  const [qmTitle, setQmTitle] = useState("");
  const [qmBody, setQmBody] = useState("");
  const [qmChannel, setQmChannel] = useState("ops");
  const [qmSeverity, setQmSeverity] = useState<string>("");
  const [qmSenderName, setQmSenderName] = useState("Facilitator");
  const [qmSenderOrg, setQmSenderOrg] = useState("Decisionary");
  const [qmRequiresDecision, setQmRequiresDecision] = useState(false);
  const [qmDecisionTemplateKey, setQmDecisionTemplateKey] = useState("");

  const [taskRows, setTaskRows] = useState<SessionTask[]>([]);
  const [consequenceRows, setConsequenceRows] = useState<SessionConsequence[]>([]);

  const effectiveScenarioId = scenarioId ?? meta?.scenario_id ?? null;

  async function refreshMeta() {
    const { data, error } = await supabase
      .from("sessions")
      .select("status, join_code, started_at, ended_at, scenario_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (!error) {
      const nextMeta = (data ?? null) as SessionMeta | null;
      setMeta(nextMeta);
      onSessionMetaChange?.(nextMeta);
    }
  }

  async function refreshInjectLibrary() {
    if (!effectiveScenarioId) {
      setScenarioInjects([]);
      setDeliveredIds(new Set());
      setSelectedSiId("");
      return;
    }

    const si = await listScenarioInjects(effectiveScenarioId);
    setScenarioInjects(si ?? []);

    const injectIds = Array.from(
      new Set((si ?? []).map((x) => x.inject_id).filter(Boolean))
    );
    if (injectIds.length === 0) {
      setDeliveredIds(new Set());
      setSelectedSiId("");
      return;
    }

    // delivered inject_id in this session
    const { data: delivered, error } = await supabase
      .from("session_injects")
      .select("inject_id")
      .eq("session_id", sessionId);

    if (error) {
      setDeliveredIds(new Set());
      return;
    }

    const set = new Set<string>(
      (delivered ?? [])
        .map((r) => r.inject_id)
        .filter((v): v is string => typeof v === "string" && Boolean(v))
    );
    setDeliveredIds(set);

    // default to first pending
    const firstPending = (si ?? []).find((x) => x?.inject_id && !set.has(x.inject_id));
    setSelectedSiId(firstPending?.id ?? "");
  }

  async function refreshEngineState() {
    const [tasks, consequences] = await Promise.all([
      listSessionTasks(sessionId, 100),
      listSessionConsequences(sessionId, 100),
    ]);
    setTaskRows(tasks);
    setConsequenceRows(consequences);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refreshMeta();
        if (!alive) return;
        await refreshInjectLibrary();
        if (!alive) return;
        await refreshEngineState();
      } catch {
        // soft fail
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, effectiveScenarioId]);

  const pending = useMemo(() => {
    return (scenarioInjects ?? []).filter(
      (x) => x.inject_id && !deliveredIds.has(x.inject_id)
    );
  }, [scenarioInjects, deliveredIds]);

  const selectedSI = useMemo(() => {
    return (scenarioInjects ?? []).find((x) => x.id === selectedSiId) ?? null;
  }, [scenarioInjects, selectedSiId]);

  const openTasks = useMemo(
    () => taskRows.filter((task) => task.status !== "done" && task.status !== "cancelled"),
    [taskRows]
  );

  const overdueTasks = useMemo(() => {
    const now = Date.now();
    return openTasks.filter((task) => {
      if (!task.due_at) return false;
      const dueAt = new Date(task.due_at).getTime();
      return Number.isFinite(dueAt) && dueAt <= now;
    });
  }, [openTasks]);

  const latestConsequence = consequenceRows[0] ?? null;

  // =========================
  // Session control
  // =========================

  async function startExercise() {
    setLoading(true);
    setMsg(null);

    try {
      // preferred: RPC if exists
      const { error } = await supabase.rpc("start_session", {
        p_session_id: sessionId,
      });

      if (error) {
        // fallback: direct update
        const nowIso = new Date().toISOString();
        const { error: updErr } = await supabase
          .from("sessions")
          .update({
            status: "live",
            started_at: nowIso,
            ended_at: null,
          })
          .eq("id", sessionId);

        if (updErr) throw updErr;
      }

      setMsg("Exercise started (T=0).");
      await refreshMeta();
    } catch (e: unknown) {
      setMsg(getErrorMessage(e, "Failed to start exercise."));
    } finally {
      setLoading(false);
    }
  }

  async function endExercise() {
    setLoading(true);
    setMsg(null);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from("sessions")
        .update({ status: "ended", ended_at: nowIso })
        .eq("id", sessionId);
      if (error) throw error;
      setMsg("Exercise ended.");
      await refreshMeta();
    } catch (e: unknown) {
      setMsg(getErrorMessage(e, "Failed to end exercise."));
    } finally {
      setLoading(false);
    }
  }

  async function restartExercise() {
    setLoading(true);
    setMsg(null);
    try {
      // preferred: RPC if exists
      const { error } = await supabase.rpc("restart_session", {
        p_session_id: sessionId,
      });

      if (error) {
        // fallback: reset timestamps only
        const { error: updErr } = await supabase
          .from("sessions")
          .update({ status: "draft", started_at: null, ended_at: null })
          .eq("id", sessionId);

        if (updErr) throw updErr;
      }

      setMsg("Session restarted.");
      await refreshMeta();
      await refreshInjectLibrary();
      await refreshEngineState();
    } catch (e: unknown) {
      setMsg(getErrorMessage(e, "Failed to restart session."));
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // Inject release
  // =========================

  async function deliverDue() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await deliverDueInjects(sessionId);
      setMsg(`Delivered ${res.delivered} due inject(s).`);
      await refreshInjectLibrary();
      await refreshEngineState();
    } catch (e: unknown) {
      setMsg(getErrorMessage(e, "Failed to deliver due injects."));
    } finally {
      setLoading(false);
    }
  }

  async function deliverInjectNow(injectId: string) {
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("session_injects").insert({
      session_id: sessionId,
      inject_id: injectId,
      delivered_at: nowIso,
    });
    if (error) throw error;
  }

  async function deliverSelected() {
    if (!selectedSI?.inject_id) return;
    setLoading(true);
    setMsg(null);
    try {
      await deliverInjectNow(selectedSI.inject_id);
      setMsg(`Delivered: ${selectedSI.injects?.title ?? "inject"}`);
      await refreshInjectLibrary();
      await refreshEngineState();
    } catch (e: unknown) {
      setMsg(getErrorMessage(e, "Failed to deliver inject."));
    } finally {
      setLoading(false);
    }
  }

  async function deliverNextPending() {
    const next = pending?.[0];
    if (!next?.inject_id) return;
    setLoading(true);
    setMsg(null);
    try {
      await deliverInjectNow(next.inject_id);
      setMsg(`Delivered next: ${next.injects?.title ?? "inject"}`);
      await refreshInjectLibrary();
      await refreshEngineState();
    } catch (e: unknown) {
      setMsg(getErrorMessage(e, "Failed to deliver next inject."));
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // Quick message
  // =========================

  async function sendQuickMessage() {
    const validPayload = validateMessagePayload(qmTitle, qmBody);
    if (!validPayload.ok) {
      setMsg(validPayload.error);
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      await sendInjectToSession(sessionId, validPayload.value.title, validPayload.value.body, {
        channel: (qmChannel ?? "ops").trim() || "ops",
        severity: qmSeverity.trim() ? qmSeverity.trim() : null,
        sender_name: qmSenderName.trim() ? qmSenderName.trim() : null,
        sender_org: qmSenderOrg.trim() ? qmSenderOrg.trim() : null,
        requires_decision: qmRequiresDecision,
        decision_template_key: qmDecisionTemplateKey.trim() ? qmDecisionTemplateKey.trim() : null,
      });
      setMsg("Quick message sent.");
      setQmTitle("");
      setQmBody("");
      setQmSeverity("");
      setQmRequiresDecision(false);
      setQmDecisionTemplateKey("");
      await refreshInjectLibrary();
      await refreshEngineState();
    } catch (e: unknown) {
      setMsg(getErrorMessage(e, "Failed to send quick message."));
    } finally {
      setLoading(false);
    }
  }

  async function processOverdueNow() {
    setEngineRefreshing(true);
    setMsg(null);
    try {
      const result = await processOverdueSessionTasks(sessionId);
      await refreshEngineState();
      const parts: string[] = [];
      if (result.created_consequences > 0) parts.push(`${result.created_consequences} consequences`);
      if (result.created_tasks > 0) parts.push(`${result.created_tasks} tasks`);
      if (result.created_injects > 0) parts.push(`${result.created_injects} injects`);
      setMsg(
        parts.length > 0
          ? `Processed overdue runtime: ${parts.join(", ")}.`
          : "No overdue runtime actions were needed."
      );
    } catch (e: unknown) {
      setMsg(getErrorMessage(e, "Failed to process overdue runtime."));
    } finally {
      setEngineRefreshing(false);
    }
  }

  const content = (
    <div className="space-y-4">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Status: {normalizeSessionStatus(meta?.status ?? null)}</Badge>
            <Badge>Join code: {meta?.join_code ?? "—"}</Badge>
            <Badge>Started: {fmtIso(meta?.started_at)}</Badge>
            <Badge>Ended: {fmtIso(meta?.ended_at)}</Badge>

            {effectiveScenarioId ? (
              <Link
                href={`/facilitator/scenarios/${effectiveScenarioId}`}
                className="text-xs font-semibold text-[color:var(--studio-ink)] underline underline-offset-2"
              >
                Open scenario editor
              </Link>
            ) : null}

            <Link
              href={`/facilitator/sessions/${sessionId}/roster`}
              className="text-xs font-semibold text-[color:var(--studio-ink)] underline underline-offset-2"
            >
              Open roster
            </Link>
          </div>

          {/* Exercise */}
          <div className="rounded-[16px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] p-3">
            <div className="mb-3">
              <div className="text-sm font-semibold">Exercise lifecycle</div>
              <div className="text-xs text-muted-foreground">
                Control the current run without leaving the session screen.
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
            <Button variant="default" onClick={startExercise} disabled={loading}>
              {loading ? "..." : "Start (T=0)"}
            </Button>
            <Button variant="destructive" onClick={endExercise} disabled={loading}>
              {loading ? "..." : "End"}
            </Button>
            <Button
              variant="secondary"
              onClick={restartExercise}
              disabled={loading}
            >
              {loading ? "..." : "Restart"}
            </Button>
          </div>
          </div>

          <div className="rounded-[16px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4" />
                  Engine snapshot
                </div>
                <div className="text-xs text-muted-foreground">
                  Keep an eye on open runtime work and manually process overdue rules if needed.
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={processOverdueNow}
                disabled={engineRefreshing}
              >
                <TimerReset className="mr-2 h-4 w-4" />
                {engineRefreshing ? "Working..." : "Process overdue"}
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-4">
              <div className="rounded-[14px] border border-[var(--studio-border)] bg-white/70 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Pending injects
                </div>
                <div className="mt-1 text-lg font-semibold">{pending.length}</div>
              </div>
              <div className="rounded-[14px] border border-[var(--studio-border)] bg-white/70 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Open tasks
                </div>
                <div className="mt-1 text-lg font-semibold">{openTasks.length}</div>
              </div>
              <div className="rounded-[14px] border border-[var(--studio-border)] bg-white/70 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Overdue
                </div>
                <div className="mt-1 text-lg font-semibold">{overdueTasks.length}</div>
              </div>
              <div className="rounded-[14px] border border-[var(--studio-border)] bg-white/70 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Consequences
                </div>
                <div className="mt-1 text-lg font-semibold">{consequenceRows.length}</div>
              </div>
            </div>

            {latestConsequence ? (
              <div className="mt-3 rounded-[14px] border border-[var(--studio-border)] bg-white/70 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Latest consequence
                </div>
                <div className="mt-1 text-sm font-semibold">{latestConsequence.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {latestConsequence.consequence_type} • {fmtIso(latestConsequence.applied_at)}
                </div>
                {latestConsequence.description ? (
                  <div className="mt-2 text-sm text-foreground">{latestConsequence.description}</div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Inject release (collapsed) */}
          <div className="overflow-hidden rounded-[16px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)]">
            <button
              onClick={() => setInjectReleaseOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <div>
                  <div className="text-sm font-semibold">Inject release</div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    Pending: {pending.length} / Total: {scenarioInjects.length}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  {injectReleaseOpen ? "Hide" : "Show"}
                </span>
                {injectReleaseOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </button>

            {injectReleaseOpen ? (
              <div className="border-t border-[var(--studio-border)] bg-white/55 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={deliverDue}
                    disabled={loading}
                  >
                    Deliver due
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={deliverNextPending}
                    disabled={loading || pending.length === 0}
                  >
                    Deliver next
                  </Button>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Select value={selectedSiId} onChange={setSelectedSiId}>
                    <option value="">— Select pending inject —</option>
                    {pending.map((si) => (
                      <option key={si.id} value={si.id}>
                        {String(si.order_index ?? 0).padStart(2, "0")} ·{" "}
                        {si.injects?.title ?? "Untitled"}{" "}
                        {si.scheduled_at ? `(scheduled)` : ""}
                      </option>
                    ))}
                  </Select>

                  <Button
                    variant="default"
                    onClick={deliverSelected}
                    disabled={loading || !selectedSI?.inject_id}
                  >
                    Deliver now
                  </Button>
                </div>

                {selectedSI ? (
                  <div className="mt-3 rounded-[14px] border border-[var(--studio-border)] bg-white/70 p-3">
                    <div className="text-xs font-semibold text-muted-foreground">
                      Preview
                    </div>
                    <div className="mt-1 text-sm font-semibold">
                      {selectedSI.injects?.title ?? "Untitled"}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {selectedSI.injects?.body ?? "—"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
                      <span>channel: {selectedSI.injects?.channel ?? "—"}</span>
                      <span>
                        severity: {selectedSI.injects?.severity ?? "—"}
                      </span>
                      <span>
                        sender: {selectedSI.injects?.sender_name ?? "—"} /{" "}
                        {selectedSI.injects?.sender_org ?? "—"}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Quick message (collapsed) */}
          <div className="overflow-hidden rounded-[16px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)]">
            <button
              onClick={() => setQuickMsgOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                <div>
                  <div className="text-sm font-semibold">Quick message</div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    Send an ad-hoc message to the session.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  {quickMsgOpen ? "Hide" : "Show"}
                </span>
                {quickMsgOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </button>

            {quickMsgOpen ? (
              <div className="border-t border-[var(--studio-border)] bg-white/55 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold">Title</div>
                    <Input
                      value={qmTitle}
                      onChange={(e) => setQmTitle(e.target.value)}
                      placeholder="e.g., Internal update"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-semibold">Channel</div>
                    <Select value={qmChannel} onChange={setQmChannel}>
                      <option value="ops">ops</option>
                      <option value="media">media</option>
                      <option value="social">social</option>
                      <option value="pulse">pulse</option>
                    </Select>
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <div className="text-sm font-semibold">Body</div>
                    <textarea
                      value={qmBody}
                      onChange={(e) => setQmBody(e.target.value)}
                      className="min-h-[96px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm focus-visible:shadow-[var(--studio-ring)] focus-visible:outline-none"
                      placeholder="Write the message..."
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-semibold">
                      Severity (optional)
                    </div>
                    <Input
                      value={qmSeverity}
                      onChange={(e) => setQmSeverity(e.target.value)}
                      placeholder="low / medium / high"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Decision flow</div>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={qmRequiresDecision}
                        onChange={(e) => setQmRequiresDecision(e.target.checked)}
                      />
                      Mark this message as decision-required
                    </label>
                    <Input
                      value={qmDecisionTemplateKey}
                      onChange={(e) => setQmDecisionTemplateKey(e.target.value)}
                      placeholder="Decision template key"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-semibold">Sender</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        value={qmSenderName}
                        onChange={(e) => setQmSenderName(e.target.value)}
                        placeholder="Name"
                      />
                      <Input
                        value={qmSenderOrg}
                        onChange={(e) => setQmSenderOrg(e.target.value)}
                        placeholder="Org"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <Button
                    variant="default"
                    onClick={sendQuickMessage}
                    disabled={loading}
                  >
                    {loading ? "..." : "Send message"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {msg ? (
            <div className="notice px-3 py-2 text-sm font-semibold">
              {msg}
            </div>
          ) : null}
    </div>
  );

  if (compact) {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <div className="space-y-3">
      <Card className="surface-solid border border-[var(--studio-border)] shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Facilitator tools</CardTitle>
          <CardDescription className="text-sm">
            Session control, inject release, and live intervention tools.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">{content}</CardContent>
      </Card>
    </div>
  );
}
