"use client";

import { useEffect, useId, useState } from "react";

import { Button } from "@/app/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onOpenChange,
  onConfirm,
}: ConfirmDialogProps) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onOpenChange(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onOpenChange, open]);

  if (!open) return null;

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      setBusy(false);
      onOpenChange(false);
    } catch {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={() => {
        if (!busy) onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md rounded-[18px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] p-5 shadow-soft"
        onClick={(event) => event.stopPropagation()}
      >
        <div id={titleId} className="text-lg font-semibold text-[color:var(--studio-ink)]">
          {title}
        </div>
        <div id={descriptionId} className="mt-2 text-sm leading-6 text-[color:var(--studio-muted)]">
          {description}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === "destructive" ? "destructive" : "default"}
            onClick={() => void handleConfirm()}
            disabled={busy}
          >
            {busy ? "Working..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
