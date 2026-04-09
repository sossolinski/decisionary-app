// app/components/MessageDetail.tsx
"use client";

import React, { useMemo } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import HintTooltip from "@/app/components/HintTooltip";
import { Card, CardContent } from "@/app/components/ui/card";
import { FileText, Radio, Send, ShieldCheck, ShieldX } from "lucide-react";

type Mode = "inbox" | "pulse";

type Inject = {
  id?: string;
  title: string | null;
  body: string | null;
  channel: string | null;
  severity: string | null;
  sender_name: string | null;
  sender_org: string | null;
  created_at?: string;
};

type SessionInject = {
  id: string;
  session_id?: string;
  delivered_at?: string;
  inject_id?: string;
  injects?: Inject | null;
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
}) {
  const inject = item?.injects ?? null;

  const title = inject?.title ?? "Message";
  const body = inject?.body ?? "";
  const channel = inject?.channel ?? null;
  const severity = inject?.severity ?? null;

  const senderLine = useMemo(() => {
    const name = inject?.sender_name?.trim();
    const org = inject?.sender_org?.trim();
    if (name && org) return `${name} • ${org}`;
    return name || org || null;
  }, [inject?.sender_name, inject?.sender_org]);

  return (
    <div className="space-y-4">
      {!item ? (
        <Card className="border border-dashed border-[var(--studio-border)] bg-[color:var(--studio-surface2)]">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--studio-border)] bg-white/70">
              {activeTab === "pulse" ? (
                <Radio className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </div>
            <div>
              <div className="font-semibold text-[color:var(--studio-ink)]">
                Nothing selected yet
              </div>
              <div className="mt-1">
                Select a message from the left to inspect details and record a response.
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-semibold leading-snug text-[color:var(--studio-ink)]">
                  {title}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {senderLine ? senderLine : "—"}
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
                {activeTab === "inbox" && channel ? (
                  <span className={badgeClass("channel", channel)}>
                    {channel.toUpperCase()}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <MetaPill
                label="Mode"
                value={activeTab === "pulse" ? "Pulse" : "Inbox"}
              />
              <MetaPill
                label="Delivered"
                value={fmtWhen(item.delivered_at) ?? "—"}
              />
            </div>

            {body ? (
              <div className="whitespace-pre-wrap rounded-[16px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] p-4 text-sm leading-7 text-[color:var(--studio-ink)]">
                {body}
              </div>
            ) : (
              <div className="rounded-[16px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] p-4 text-sm text-muted-foreground">
                No message body.
              </div>
            )}
          </div>

          {/* Comment */}
          <div className="rounded-[16px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
              <span>Response note</span>
              <HintTooltip text="Use this note to capture rationale, next steps, or wording guidance before you record the response." />
            </div>
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-3"
              placeholder={
                activeTab === "pulse"
                  ? "Optional: rationale, wording guidance, source confirmation…"
                  : "Optional: what you did / who you informed / next step…"
              }
            />
          </div>

          {/* Primary actions */}
          <div className="rounded-[16px] border border-[var(--studio-border)] bg-white/55 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
              <span>Response actions</span>
              <HintTooltip text="Choose the action that best fits the message. 'Act' records the decision and can send an update into the session." />
            </div>
            <div className="flex flex-wrap items-center gap-2">
            {activeTab === "pulse" ? (
              <>
                <Button variant="default" onClick={onConfirm} className="gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Confirm
                </Button>
                <Button variant="destructive" onClick={onDeny} className="gap-2">
                  <ShieldX className="h-4 w-4" />
                  Deny
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onIgnore}>
                  Ignore
                </Button>
                <Button variant="secondary" onClick={onEscalate}>
                  Escalate
                </Button>
                <Button variant="default" onClick={onAct} className="gap-2">
                  <Send className="h-4 w-4" />
                  Act
                </Button>
              </>
            )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
