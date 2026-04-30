// app/components/MessageDetail.tsx
"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/app/components/ui/button";
import InjectMediaGallery from "@/app/components/InjectMediaGallery";
import HintTooltip from "@/app/components/HintTooltip";
import { Card, CardContent } from "@/app/components/ui/card";
import { Select } from "@/app/components/session-runtime/sessionRuntimeUi";
import type { InjectMedia } from "@/lib/injectMedia";
import { ChevronDown, FileText, ImageIcon, Radio, Send, ShieldCheck, ShieldX } from "lucide-react";

type Mode = "inbox" | "pulse";

type Inject = {
  id?: string;
  title: string | null;
  body: string | null;
  channel: string | null;
  severity: string | null;
  sender_name: string | null;
  sender_org: string | null;
  inject_kind?: "operational" | "media" | "social" | "intel" | "internal" | "system" | null;
  source_type?: "scheduled" | "manual" | "conditional" | "consequence" | null;
  entity_scope?: string | null;
  requires_decision?: boolean;
  decision_template_key?: string | null;
  media?: InjectMedia[] | null;
  created_at?: string;
};

type SessionInject = {
  id: string;
  session_id?: string;
  delivered_at?: string;
  inject_id?: string;
  injects?: Inject | null;
};

export type TaskRoleOption = {
  value: string;
  label: string;
};

function badgeClass(kind: "severity" | "channel", value: string) {
  const base =
    "inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold";
  const v = value.toLowerCase();

  if (kind === "severity") {
    if (v === "critical") return `${base} bg-destructive/10 text-destructive`;
    if (v === "high")
      return `${base} bg-orange-500/10 text-orange-700 dark:text-orange-300`;
    if (v === "medium")
      return `${base} bg-yellow-500/10 text-yellow-700 dark:text-yellow-300`;
    if (v === "low")
      return `${base} bg-emerald-500/10 text-emerald-700 dark:text-emerald-300`;
    return `${base} bg-secondary/60 text-foreground`;
  }

  // channel
  if (v === "ops") return `${base} bg-primary/10 text-primary`;
  if (v === "media")
    return `${base} bg-purple-500/10 text-purple-700 dark:text-purple-300`;
  if (v === "social")
    return `${base} bg-sky-500/10 text-sky-700 dark:text-sky-300`;
  return `${base} bg-secondary/60 text-foreground`;
}

function fmtWhen(iso?: string) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function initials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "PU";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "PU";
}

function pseudoHandle(senderName?: string | null, senderOrg?: string | null) {
  const base = senderOrg?.trim() || senderName?.trim() || "pulse";
  return `@${base.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20) || "pulse"}`;
}

function MetaPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-3 py-1 text-[11px] font-semibold text-[color:var(--studio-muted2)]">
      <span className="mr-1 uppercase tracking-[0.12em]">{label}</span>
      <span className="text-[color:var(--studio-ink)]">{value}</span>
    </div>
  );
}

function ActionCard({
  title,
  description,
  recommended = false,
  children,
}: {
  title: string;
  description: string;
  recommended?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        "rounded-[14px] border bg-[color:var(--studio-surface2)] p-3 transition-colors",
        recommended
          ? "border-primary/25 bg-primary/5"
          : "border-[var(--studio-border)]",
      ].join(" ")}
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-[color:var(--studio-ink)]">
          <span className="truncate">{title}</span>
          <HintTooltip text={description} side="top" />
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function MessageDetail({
  item,
  activeTab,
  comment,
  setComment,
  onIgnore,
  onEscalate,
  onAct,
  onConfirm,
  onDeny,
  taskOwnerRole,
  setTaskOwnerRole,
  taskDuePreset,
  setTaskDuePreset,
  taskRoleOptions,
}: {
  item: SessionInject | null;
  activeTab: Mode;

  comment: string;
  setComment: (v: string) => void;

  onIgnore: () => void;
  onEscalate: () => void;
  onAct: () => void;

  onConfirm: () => void;
  onDeny: () => void;

  taskOwnerRole: string;
  setTaskOwnerRole: (v: string) => void;
  taskDuePreset: string;
  setTaskDuePreset: (v: string) => void;
  taskRoleOptions: TaskRoleOption[];
}) {
  const inject = item?.injects ?? null;
  const [escalationItemId, setEscalationItemId] = useState<string | null>(null);
  const [guidanceItemId, setGuidanceItemId] = useState<string | null>(null);

  const title = inject?.title ?? "Message";
  const body = inject?.body ?? "";
  const severity = inject?.severity ?? null;

  const senderLine = useMemo(() => {
    const name = inject?.sender_name?.trim();
    const org = inject?.sender_org?.trim();
    if (name && org) return `${name} • ${org}`;
    return name || org || null;
  }, [inject?.sender_name, inject?.sender_org]);
  const pulseSenderName = inject?.sender_name?.trim() || inject?.sender_org?.trim() || "Pulse source";
  const pulseSenderOrg = inject?.sender_org?.trim() || null;
  const pulseHandle = pseudoHandle(inject?.sender_name, inject?.sender_org);
  const availableMedia = useMemo(
    () => (inject?.media ?? []).filter((media) => Boolean(media.signed_url)),
    [inject?.media]
  );
  const pulseMediaCount = availableMedia.length;

  const requiresDecision = Boolean(inject?.requires_decision);
  const contextualMeta = [
    inject?.entity_scope ? { label: "Focus", value: inject.entity_scope } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  const responseHint =
    activeTab === "pulse"
      ? "Use confirm only when the team is ready to stand behind the information publicly. Otherwise dismiss it and keep the note in the working trail."
      : requiresDecision
        ? "This update should probably end with an explicit team decision and a named owner."
        : "Pick the smallest clear next step so the team can keep moving without overcommitting too early.";
  const severityLevel = String(severity ?? "").toLowerCase();
  const isSystemFollowUp =
    activeTab === "inbox" &&
    (inject?.inject_kind === "system" ||
      inject?.source_type === "conditional" ||
      inject?.source_type === "consequence");
  const showResponseHint = activeTab === "pulse" || (requiresDecision && !isSystemFollowUp);
  const showEscalateAction = !(isSystemFollowUp && !requiresDecision);
  const recommendedInboxAction = isSystemFollowUp
    ? "ignore"
    : requiresDecision || severityLevel === "high" || severityLevel === "critical"
      ? "escalate"
      : "act";
  const escalationOpen = activeTab === "inbox" && escalationItemId === item?.id;
  const guidanceOpen = guidanceItemId === item?.id;

  if (!item) {
    return (
      <div className="space-y-4">
        <Card className="border border-dashed border-[var(--studio-border)] bg-[color:var(--studio-surface2)]">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface)]">
              {activeTab === "pulse" ? (
                <Radio className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </div>
            <div>
              <div className="font-semibold text-[color:var(--studio-ink)]">
                Choose an update to review
              </div>
              <div className="mt-1 text-sm leading-6">
                Pick one item on the left to review it here.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeTab === "pulse") {
    return (
      <div className="rounded-[16px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface)] text-sm font-bold text-[color:var(--studio-ink)]">
              {initials(pulseSenderName)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <div className="truncate text-sm font-semibold text-[color:var(--studio-ink)]">
                  {pulseSenderName}
                </div>
                <div className="text-xs text-muted-foreground">{pulseHandle}</div>
                {pulseSenderOrg && pulseSenderOrg !== pulseSenderName ? (
                  <div className="text-xs text-muted-foreground">· {pulseSenderOrg}</div>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {severity ? (
                  <span className={badgeClass("severity", severity)}>
                    {severity.toUpperCase()}
                  </span>
                ) : null}
                {pulseMediaCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--studio-muted2)]">
                    <ImageIcon className="h-3.5 w-3.5" />
                    {pulseMediaCount} image{pulseMediaCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="shrink-0 pt-0.5 text-[11px] font-medium text-muted-foreground">
            {item.delivered_at ? fmtWhen(item.delivered_at) ?? item.delivered_at : ""}
          </div>
        </div>

        <div className="mt-4 text-xl font-semibold leading-tight text-[color:var(--studio-ink)]">
          {title}
        </div>
        <div className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-[color:var(--studio-ink)]">
          {body || "No message body."}
        </div>

        {availableMedia.length > 0 ? (
          <div className="mt-4">
            <InjectMediaGallery media={availableMedia} />
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--studio-border)] pt-3">
          <Button variant="outline" onClick={onConfirm} className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Confirm publicly
          </Button>
          <Button variant="outline" onClick={onDeny} className="gap-2">
            <ShieldX className="h-4 w-4" />
            Dismiss claim
          </Button>
          <HintTooltip text={responseHint} side="top" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="px-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xl font-semibold leading-snug text-[color:var(--studio-ink)]">
              {title}
            </div>
            <div className="mt-2 text-xs font-medium text-muted-foreground">
              {senderLine ? senderLine : "Unknown source"}
              {item.delivered_at ? (
                <>
                  <span className="mx-2">•</span>
                  <span>{fmtWhen(item.delivered_at) ?? item.delivered_at}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {severity ? (
              <span className={badgeClass("severity", severity)}>
                {severity.toUpperCase()}
              </span>
            ) : null}
            {requiresDecision ? (
              <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--studio-ink)]">
                Decision needed
              </span>
            ) : null}
          </div>
        </div>

        {showResponseHint ? (
          <div className="mt-4 rounded-[14px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)]">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              onClick={() => setGuidanceItemId((current) => (current === item.id ? null : item.id))}
              aria-expanded={guidanceOpen}
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
                Guidance
              </span>
              <ChevronDown
                className={[
                  "h-4 w-4 shrink-0 text-[color:var(--studio-muted2)] transition-transform",
                  guidanceOpen ? "rotate-180" : "",
                ].join(" ")}
              />
            </button>
            {guidanceOpen ? (
              <div className="border-t border-[var(--studio-border)] px-4 py-3 text-sm leading-6 text-[color:var(--studio-muted)]">
                {responseHint}
              </div>
            ) : null}
          </div>
        ) : null}

        {contextualMeta.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {contextualMeta.map((item) => (
              <MetaPill key={`${item.label}:${item.value}`} label={item.label} value={item.value} />
            ))}
          </div>
        ) : null}

        {availableMedia.length > 0 ? (
          <InjectMediaGallery media={availableMedia} />
        ) : null}

        <div className="mt-4 rounded-[14px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-4 py-4">
          <div className="whitespace-pre-wrap text-[15px] leading-7 text-[color:var(--studio-ink)]">
            {body || "No message body."}
          </div>
        </div>
      </div>

      <div className="rounded-[14px] border border-[var(--studio-border)] bg-[color:var(--studio-surface)] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
          <span>Choose response</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ActionCard
            title="Monitor only"
            description="Keep this on the radar without starting a new task right now."
            recommended={recommendedInboxAction === "ignore"}
          >
            <Button
              variant="outline"
              onClick={() => {
                setEscalationItemId(null);
                onIgnore();
              }}
              className="w-full"
            >
              Monitor only
            </Button>
          </ActionCard>
          {showEscalateAction ? (
            <ActionCard
              title="Escalate now"
              description="Create a clear escalation follow-up so someone owns the next operational move."
              recommended={recommendedInboxAction === "escalate"}
            >
              <Button
                variant="secondary"
                onClick={() => {
                  setEscalationItemId(item.id);
                }}
                className="w-full"
              >
                Escalate now
              </Button>
            </ActionCard>
          ) : null}
          <ActionCard
            title="Take action now"
            description="Record the action immediately and let any task or rule-based follow-up appear only if it is genuinely needed."
            recommended={recommendedInboxAction === "act"}
          >
            <Button
              variant="default"
              onClick={() => {
                setEscalationItemId(null);
                onAct();
              }}
              className="w-full gap-2"
            >
              <Send className="h-4 w-4" />
              Take action now
            </Button>
          </ActionCard>
        </div>
        {showEscalateAction && escalationOpen ? (
          <div className="mt-3 rounded-[14px] border border-primary/20 bg-primary/[0.04] px-4 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
                  <span>Escalate this update</span>
                  <HintTooltip text="Choose who owns the follow-up, set a deadline, and add the context they need." side="top" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--studio-muted2)]">
                  To
                </span>
                <Select value={taskOwnerRole} onChange={setTaskOwnerRole}>
                  {taskRoleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--studio-muted2)]">
                  Deadline
                </span>
                <Select value={taskDuePreset} onChange={setTaskDuePreset}>
                  <option value="none">No deadline</option>
                  <option value="10">10 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                </Select>
              </label>
            </div>
            <label className="mt-3 block">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--studio-muted2)]">
                Your note
              </span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className="w-full rounded-[12px] border border-[var(--studio-border)] bg-[color:var(--studio-surface)] px-3 py-3 text-sm leading-6 text-[color:var(--studio-ink)] outline-none transition placeholder:text-[color:var(--studio-muted2)] focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                placeholder="What should the owner know, verify, or do next?"
              />
            </label>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setEscalationItemId(null)}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEscalationItemId(null);
                  onEscalate();
                }}
              >
                Create escalation
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
