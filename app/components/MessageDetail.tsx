"use client";

import type { SessionAction, SessionInject } from "@/lib/sessions";
import { Button } from "@/app/components/ui/button";

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function MessageDetail({
  item,
  mode,

  // actions (already filtered to the selected item)
  actions = [],
  actionsLoading = false,
  actionsError = null,

  // action input
  comment,
  onCommentChange,

  // handlers
  onIgnore,
  onEscalate,
  onAct,
  onConfirm,
  onDeny,
}: {
  item: SessionInject | null;
  mode: "inbox" | "pulse";

  actions?: SessionAction[];
  actionsLoading?: boolean;
  actionsError?: string | null;

  comment: string;
  onCommentChange: (v: string) => void;

  onIgnore?: () => void;
  onEscalate?: () => void;
  onAct?: () => void;
  onConfirm?: () => void;
  onDeny?: () => void;
}) {
  if (!item) {
    return (
      <div style={{ color: "rgba(0,0,0,0.65)", fontSize: 13 }}>
        Select an item from Inbox or Pulse to view details.
      </div>
    );
  }

  const title = item.injects?.title?.trim() || "Message";
  const body = item.injects?.body?.trim() || "";
  const channel = item.injects?.channel
    ? String(item.injects.channel).toUpperCase()
    : null;
  const severity = item.injects?.severity
    ? String(item.injects.severity).toUpperCase()
    : null;
  const sender =
    [item.injects?.sender_name, item.injects?.sender_org]
      .filter(Boolean)
      .join(" · ") || "Unknown source";
  const deliveredAt = fmtDateTime(item.delivered_at);

  const disabled = !item?.id;

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-base font-semibold leading-tight">{title}</div>
            <div className="mt-1 text-xs font-semibold text-muted-foreground">
              {sender} · {deliveredAt}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {mode === "pulse" ? (
              <span className="rounded-full border border-border bg-muted px-2 py-1 text-[11px] font-bold">
                UNVERIFIED
              </span>
            ) : null}
            {channel ? (
              <span className="rounded-full border border-border bg-card px-2 py-1 text-[11px] font-bold">
                {channel}
              </span>
            ) : null}
            {severity ? (
              <span className="rounded-full border border-border bg-card px-2 py-1 text-[11px] font-bold">
                {severity}
              </span>
            ) : null}
          </div>
        </div>

        <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {body || <span className="text-muted-foreground">(no content)</span>}
        </div>
      </div>

      {/* ACTIONS (contextual) */}
      <div className="rounded-[var(--radius)] border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">Actions for this message</div>
          {actionsLoading ? (
            <span className="text-xs font-semibold text-muted-foreground">
              Loading…
            </span>
          ) : actionsError ? (
            <span className="text-xs font-semibold text-muted-foreground">
              {actionsError}
            </span>
          ) : (
            <span className="text-xs font-semibold text-muted-foreground">
              {actions.length ? `${actions.length} logged` : "No log yet"}
            </span>
          )}
        </div>

        {actions.length ? (
          <div className="mt-3 space-y-2">
            {actions.slice(0, 6).map((a) => (
              <div
                key={a.id}
                className="rounded-[var(--radius)] border border-border bg-background px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold">
                    {String(a.action_type).toUpperCase()}
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {fmtDateTime(a.created_at)}
                  </div>
                </div>
                {a.comment ? (
                  <div className="mt-1 whitespace-pre-wrap text-xs text-foreground">
                    {a.comment}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-3 space-y-2">
          <textarea
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder={
              mode === "pulse"
                ? "Optional comment (why confirm/deny)"
                : "Optional comment (what you did / why)"
            }
            className="min-h-[88px] w-full resize-y rounded-[var(--radius)] border border-border bg-background p-3 text-sm focus-visible:shadow-[var(--studio-ring)] focus-visible:outline-none"
          />

          {mode === "pulse" ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" onClick={onConfirm} disabled={disabled}>
                Confirm
              </Button>
              <Button variant="danger" onClick={onDeny} disabled={disabled}>
                Deny
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Button variant="ghost" onClick={onIgnore} disabled={disabled}>
                Ignore
              </Button>
              <Button
                variant="secondary"
                onClick={onEscalate}
                disabled={disabled}
              >
                Escalate
              </Button>
              <Button variant="primary" onClick={onAct} disabled={disabled}>
                Act
              </Button>
            </div>
          )}

          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            Actions are always logged against the currently selected message.
          </p>
        </div>
      </div>
    </div>
  );
}
