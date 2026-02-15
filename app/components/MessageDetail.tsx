// app/components/MessageDetail.tsx
"use client";

import React, { useMemo } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card, CardContent } from "@/app/components/ui/card";

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
        <Card className="bg-secondary/30">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Select a message from the left to see details and record decisions.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-base font-semibold leading-snug">{title}</div>
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

            {body ? (
              <div className="whitespace-pre-wrap rounded-[var(--radius)] border border-border bg-card p-3 text-sm leading-relaxed">
                {body}
              </div>
            ) : (
              <div className="rounded-[var(--radius)] border border-border bg-card p-3 text-sm text-muted-foreground">
                No message body.
              </div>
            )}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Comment</div>
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                activeTab === "pulse"
                  ? "Optional: rationale, wording guidance, source confirmation…"
                  : "Optional: what you did / who you informed / next step…"
              }
            />
          </div>

          {/* Primary actions */}
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === "pulse" ? (
              <>
                <Button variant="default" onClick={onConfirm}>
                  Confirm
                </Button>
                <Button variant="destructive" onClick={onDeny}>
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
                <Button variant="default" onClick={onAct}>
                  Act
                </Button>
              </>
            )}
          </div>

          <div className="text-[11px] text-muted-foreground">
            Tip: use “Act” to record a decision and optionally send an update inject to the
            session.
          </div>
        </>
      )}
    </div>
  );
}
