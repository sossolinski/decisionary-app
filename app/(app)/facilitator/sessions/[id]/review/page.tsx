"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCheck,
  ClipboardList,
  Copy,
  Download,
  Radio,
  ShieldAlert,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { getSessionActions, type SessionAction } from "@/lib/sessions";
import { getErrorMessage } from "@/lib/errors";
import { copyTextToClipboard } from "@/lib/clientClipboard";
import { normalizeSessionStatus } from "@/lib/sessionStatus";
import { useRoleContext } from "@/app/components/useRoleContext";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import HintTooltip from "@/app/components/HintTooltip";

type SessionReviewMeta = {
  id: string;
  title: string | null;
  join_code: string | null;
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
};

type SessionInjectReviewRow = {
  id: string;
  delivered_at: string;
  injects:
    | {
        title: string | null;
        channel: string | null;
        severity: string | null;
      }
    | {
        title: string | null;
        channel: string | null;
        severity: string | null;
      }[]
    | null;
};

type ReviewAction = SessionAction & {
  inject_title: string | null;
  inject_channel: string | null;
  inject_severity: string | null;
  inject_delivered_at: string | null;
};

type SourceFilter = "all" | "inbox" | "pulse";
type ActionFilter = "all" | "ignore" | "escalate" | "act";

function normalizeInjectMeta(row: SessionInjectReviewRow | null | undefined) {
  const inject = Array.isArray(row?.injects) ? (row?.injects[0] ?? null) : row?.injects ?? null;
  return {
    title: inject?.title ?? null,
    channel: inject?.channel ?? null,
    severity: inject?.severity ?? null,
    deliveredAt: row?.delivered_at ?? null,
  };
}

function toCsvValue(value: string | null | undefined) {
  const normalized = String(value ?? "");
  return `"${normalized.replaceAll('"', '""')}"`;
}

function fmt(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function SessionInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ui-metric-card rounded-[14px] px-4 py-3">
      <div className="ui-metric-label">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

export default function FacilitatorSessionReviewPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params?.id ?? "";
  const { loading: roleLoading, canFacilitate } = useRoleContext();

  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [meta, setMeta] = useState<SessionReviewMeta | null>(null);
  const [actions, setActions] = useState<ReviewAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");

  useEffect(() => {
    if (roleLoading || !canFacilitate || !sessionId) return;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [{ data: sessionRow, error: sessionError }, actionsData] = await Promise.all([
          supabase
            .from("sessions")
            .select("id, title, join_code, status, started_at, ended_at")
            .eq("id", sessionId)
            .maybeSingle(),
          getSessionActions(sessionId, 200),
        ]);

        if (sessionError) throw sessionError;
        if (!sessionRow) throw new Error("Session not found.");

        const injectIds = Array.from(
          new Set((actionsData ?? []).map((action) => action.session_inject_id).filter(Boolean))
        ) as string[];

        const injectLookup = new Map<string, ReturnType<typeof normalizeInjectMeta>>();

        if (injectIds.length > 0) {
          const { data: injectRows, error: injectError } = await supabase
            .from("session_injects")
            .select("id, delivered_at, injects:inject_id(title, channel, severity)")
            .in("id", injectIds);

          if (injectError) throw injectError;

          for (const row of (injectRows ?? []) as SessionInjectReviewRow[]) {
            injectLookup.set(row.id, normalizeInjectMeta(row));
          }
        }

        setMeta(sessionRow as SessionReviewMeta);
        setActions(
          (actionsData ?? []).map((action) => {
            const injectMeta = action.session_inject_id
              ? injectLookup.get(action.session_inject_id) ?? null
              : null;

            return {
              ...action,
              inject_title: injectMeta?.title ?? null,
              inject_channel: injectMeta?.channel ?? null,
              inject_severity: injectMeta?.severity ?? null,
              inject_delivered_at: injectMeta?.deliveredAt ?? null,
            };
          })
        );
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Failed to load session review."));
      } finally {
        setLoading(false);
      }
    })();
  }, [roleLoading, canFacilitate, sessionId]);

  const filteredActions = useMemo(() => {
    const qq = query.trim().toLowerCase();

    return actions.filter((action) => {
      if (sourceFilter !== "all" && action.source !== sourceFilter) return false;
      if (actionFilter !== "all" && action.action_type !== actionFilter) return false;
      if (!qq) return true;

      const haystack = [
        action.action_type,
        action.source,
        action.inject_title ?? "",
        action.inject_channel ?? "",
        action.comment ?? "",
        action.created_at,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(qq);
    });
  }, [actions, query, sourceFilter, actionFilter]);

  const summary = useMemo(() => {
    return {
      total: actions.length,
      acted: actions.filter((action) => action.action_type === "act").length,
      escalated: actions.filter((action) => action.action_type === "escalate").length,
      injectsTouched: new Set(actions.map((action) => action.session_inject_id).filter(Boolean)).size,
    };
  }, [actions]);

  const groupedActions = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        title: string;
        deliveredAt: string | null;
        channel: string | null;
        severity: string | null;
        items: ReviewAction[];
      }
    >();

    for (const action of filteredActions) {
      const key = action.session_inject_id ?? `session:${action.source}`;
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(action);
        continue;
      }

      groups.set(key, {
        key,
        title: action.inject_title ?? `Session-level ${action.source}`,
        deliveredAt: action.inject_delivered_at ?? null,
        channel: action.inject_channel ?? null,
        severity: action.inject_severity ?? null,
        items: [action],
      });
    }

    return Array.from(groups.values()).sort((a, b) => {
      const ad = a.deliveredAt ?? a.items[0]?.created_at ?? "";
      const bd = b.deliveredAt ?? b.items[0]?.created_at ?? "";
      return String(bd).localeCompare(String(ad));
    });
  }, [filteredActions]);

  async function exportReview() {
    if (!meta) return;

    const lines = [
      `Session review: ${meta.title ?? "Session"}`,
      `Session ID: ${meta.id}`,
      `Status: ${normalizeSessionStatus(meta.status)}`,
      `Join code: ${meta.join_code ?? "—"}`,
      `Started: ${fmt(meta.started_at)}`,
      `Ended: ${fmt(meta.ended_at)}`,
      "",
      `Actions (${filteredActions.length})`,
      ...filteredActions.map((action) =>
        [
          `- ${fmt(action.created_at)}`,
          `[${action.source.toUpperCase()}]`,
          action.action_type.toUpperCase(),
          action.inject_title ? `(${action.inject_title})` : "",
          action.comment?.trim() ? `- ${action.comment.trim()}` : "",
        ]
          .filter(Boolean)
          .join(" ")
      ),
    ].join("\n");

    setCopying(true);
    const ok = await copyTextToClipboard(lines);
    setCopying(false);
    setNotice(ok ? "Review copied to clipboard." : "Clipboard unavailable. Copy failed.");
  }

  function downloadCsv() {
    if (!meta) return;

    const header = [
      "session_id",
      "session_title",
      "status",
      "action_created_at",
      "source",
      "action_type",
      "inject_title",
      "inject_channel",
      "inject_severity",
      "inject_delivered_at",
      "comment",
    ];

    const rows = filteredActions.map((action) =>
      [
        meta.id,
        meta.title ?? "Session",
        normalizeSessionStatus(meta.status),
        action.created_at,
        action.source,
        action.action_type,
        action.inject_title,
        action.inject_channel,
        action.inject_severity,
        action.inject_delivered_at,
        action.comment,
      ]
        .map((value) => toCsvValue(value))
        .join(",")
    );

    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(meta.title ?? "session-review").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-review.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="ui-eyebrow">
            <ClipboardList className="h-3.5 w-3.5" />
            After Action Review
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {meta?.title ?? "Session review"}
            </h1>
            <p className="mt-1 text-sm text-[color:var(--studio-muted)]">
              Review the recorded operational decisions and export a quick summary for follow-up.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link href={`/sessions/${sessionId}`}>
              <ArrowLeft className="h-4 w-4" />
              Back to live room
            </Link>
          </Button>
          <Button onClick={exportReview} disabled={copying || loading} variant="outline" className="gap-2">
            <Copy className="h-4 w-4" />
            {copying ? "Copying..." : "Copy summary"}
          </Button>
          <Button
            onClick={() => {
              setDownloading(true);
              downloadCsv();
              window.setTimeout(() => setDownloading(false), 250);
            }}
            disabled={downloading || loading}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {downloading ? "Preparing..." : "Download CSV"}
          </Button>
        </div>
      </div>

      {notice ? <div className="notice notice-success">{notice}</div> : null}
      {error ? <div className="notice notice-error">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <SessionInfoRow label="Status" value={normalizeSessionStatus(meta?.status)} />
        <SessionInfoRow label="Join code" value={meta?.join_code ?? "—"} />
        <SessionInfoRow label="Started" value={fmt(meta?.started_at)} />
        <SessionInfoRow label="Ended" value={fmt(meta?.ended_at)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 opacity-80" />
              Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{summary.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCheck className="h-4 w-4 opacity-80" />
              Acted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{summary.acted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 opacity-80" />
              Escalated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{summary.escalated}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Radio className="h-4 w-4 opacity-80" />
              Injects touched
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{summary.injectsTouched}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <span>Review timeline</span>
            <HintTooltip text="Filter the action history by source, action type, or text to prepare a tighter after-action summary." />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notes, action types, or timestamps…"
            />

            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
              className="h-10 rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 text-sm"
            >
              <option value="all">Source: All</option>
              <option value="inbox">Source: Inbox</option>
              <option value="pulse">Source: Pulse</option>
            </select>

            <select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value as ActionFilter)}
              className="h-10 rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 text-sm"
            >
              <option value="all">Action: All</option>
              <option value="act">Action: Act</option>
              <option value="escalate">Action: Escalate</option>
              <option value="ignore">Action: Ignore</option>
            </select>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading review…</div>
          ) : groupedActions.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-5 text-sm text-[color:var(--studio-muted2)]">
              No actions match the current filters.
            </div>
          ) : (
            <div className="space-y-3">
              {groupedActions.map((group) => (
                <div key={group.key} className="ui-list-card rounded-[16px] px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{group.title}</div>
                      <div className="ui-helper-text mt-1 flex flex-wrap items-center gap-2">
                        {group.channel ? <span>{group.channel}</span> : null}
                        {group.severity ? <span>{group.severity}</span> : null}
                        <span>{group.items.length} action{group.items.length === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                    <div className="text-xs text-[color:var(--studio-muted2)]">
                      {group.deliveredAt ? `Delivered ${fmt(group.deliveredAt)}` : "Session-level"}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {group.items.map((action) => (
                      <div key={action.id} className="rounded-[14px] border border-[var(--studio-border)]/80 bg-[color:var(--studio-surface)] px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                            <span className="ui-section-label rounded-full border border-[var(--studio-border)] px-2.5 py-1">
                              {action.source}
                            </span>
                            <span className="capitalize">{action.action_type}</span>
                          </div>
                          <div className="text-xs text-[color:var(--studio-muted2)]">
                            {fmt(action.created_at)}
                          </div>
                        </div>

                        <div className="mt-2 text-sm leading-6 text-[color:var(--studio-muted)]">
                          {action.comment?.trim()
                            ? action.comment.trim()
                            : "No note recorded for this action."}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
