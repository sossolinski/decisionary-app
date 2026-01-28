"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { deliverDueInjects, sendInjectToSession } from "@/lib/sessions";
import { listScenarioInjects, type ScenarioInject } from "@/lib/scenarios";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { ChevronDown, ChevronUp, Send, Zap } from "lucide-react";

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

function Badge({ children }: { children: any }) {
  return (
    <span className="inline-flex items-center rounded-[var(--radius)] border border-border bg-card px-2 py-1 text-xs font-semibold">
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
}: {
  sessionId: string;
  scenarioId: string | null;
}) {
  const [meta, setMeta] = useState<SessionMeta | null>(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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

  const effectiveScenarioId = scenarioId ?? meta?.scenario_id ?? null;

  async function refreshMeta() {
    const { data, error } = await supabase
      .from("sessions")
      .select("status, join_code, started_at, ended_at, scenario_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (!error) setMeta((data ?? null) as any);
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
      (delivered ?? []).map((r: any) => r.inject_id).filter(Boolean)
    );
    setDeliveredIds(set);

    // default to first pending
    const firstPending = (si ?? []).find((x) => x?.inject_id && !set.has(x.inject_id));
    setSelectedSiId(firstPending?.id ?? "");
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refreshMeta();
        if (!alive) return;
        await refreshInjectLibrary();
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
            status: "running",
            started_at: nowIso,
            ended_at: null,
          })
          .eq("id", sessionId);

        if (updErr) throw updErr;
      }

      setMsg("Exercise started (T=0).");
      await refreshMeta();
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to start exercise.");
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
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to end exercise.");
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
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to restart session.");
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
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to deliver due injects.");
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
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to deliver inject.");
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
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to deliver next inject.");
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // Quick message
  // =========================

  async function sendQuickMessage() {
    if (!qmTitle.trim() || !qmBody.trim()) {
      setMsg("Quick message requires both title and body.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      await sendInjectToSession(sessionId, qmTitle.trim(), qmBody.trim(), {
        channel: (qmChannel ?? "ops").trim() || "ops",
        severity: qmSeverity.trim() ? qmSeverity.trim() : null,
        sender_name: qmSenderName.trim() ? qmSenderName.trim() : null,
        sender_org: qmSenderOrg.trim() ? qmSenderOrg.trim() : null,
      });
      setMsg("Quick message sent.");
      setQmTitle("");
      setQmBody("");
      setQmSeverity("");
      await refreshInjectLibrary();
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to send quick message.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card className="surface-solid shadow-soft border border-[var(--studio-border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Facilitator tools</CardTitle>
          <CardDescription className="text-sm">
            Session control and runtime tools.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Status: {meta?.status ?? "—"}</Badge>
            <Badge>Join code: {meta?.join_code ?? "—"}</Badge>
            <Badge>Started: {fmtIso(meta?.started_at)}</Badge>
            <Badge>Ended: {fmtIso(meta?.ended_at)}</Badge>

            {effectiveScenarioId ? (
              <Link
                href={`/facilitator/scenarios/${effectiveScenarioId}`}
                className="text-xs font-semibold underline underline-offset-2"
              >
                Open scenario editor
              </Link>
            ) : null}

            <Link
              href={`/facilitator/sessions/${sessionId}/roster`}
              className="text-xs font-semibold underline underline-offset-2"
            >
              Open roster
            </Link>
          </div>

          {/* Exercise */}
          <div className="grid gap-2 sm:grid-cols-3">
            <Button variant="primary" onClick={startExercise} disabled={loading}>
              {loading ? "..." : "Start (T=0)"}
            </Button>
            <Button variant="danger" onClick={endExercise} disabled={loading}>
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

          {/* Inject release (collapsed) */}
          <div className="rounded-[var(--radius)] border border-border bg-card">
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
              <div className="border-t border-border p-3">
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
                    variant="primary"
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
                    variant="primary"
                    onClick={deliverSelected}
                    disabled={loading || !selectedSI?.inject_id}
                  >
                    Deliver now
                  </Button>
                </div>

                {selectedSI ? (
                  <div className="mt-3 rounded-[var(--radius)] border border-border bg-background p-3">
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
          <div className="rounded-[var(--radius)] border border-border bg-card">
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
              <div className="border-t border-border p-3">
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
                    variant="primary"
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
            <div className="rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm font-semibold">
              {msg}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
