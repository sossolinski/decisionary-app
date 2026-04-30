"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, ImagePlus, MoveDown, MoveUp, Trash2 } from "lucide-react";

import type { InjectMedia, PendingInjectMedia } from "@/lib/injectMedia";
import { INJECT_MEDIA_ACCEPT } from "@/lib/injectMedia";

import { Button } from "@/app/components/ui/button";

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to add image files.";
}

type InjectMediaFieldProps = {
  label?: string;
  existingMedia?: InjectMedia[];
  pendingFiles: PendingInjectMedia[];
  onAddFiles: (files: File[]) => void;
  onRemovePending: (index: number) => void;
  onMovePending?: (fromIndex: number, toIndex: number) => void;
  onUpdatePendingAlt?: (index: number, altText: string) => void;
  onRemoveExisting?: (media: InjectMedia) => void;
  onMoveExisting?: (fromId: string, toId: string) => void;
  onUpdateExistingAlt?: (media: InjectMedia, altText: string) => void;
  disabled?: boolean;
};

export default function InjectMediaField({
  label = "Images",
  existingMedia = [],
  pendingFiles,
  onAddFiles,
  onRemovePending,
  onMovePending,
  onUpdatePendingAlt,
  onRemoveExisting,
  onMoveExisting,
  onUpdateExistingAlt,
  disabled = false,
}: InjectMediaFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragged, setDragged] = useState<{ kind: "existing" | "pending"; key: string } | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const pendingUrls = useMemo(
    () => pendingFiles.map((item) => URL.createObjectURL(item.file)),
    [pendingFiles]
  );

  useEffect(() => {
    return () => {
      pendingUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pendingUrls]);

  function addFiles(files: File[]) {
    if (files.length === 0) return;

    try {
      onAddFiles(files);
      setFieldError(null);
    } catch (error) {
      setFieldError(errorMessage(error));
    }
  }

  return (
    <div className="space-y-3 rounded-[14px] border border-[var(--studio-border)] bg-[color:var(--studio-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[color:var(--studio-ink)]">{label}</div>
          <div className="mt-1 text-xs text-[color:var(--studio-muted2)]">
            Add one or more images. They will appear in Inbox, Pulse, and the message detail view.
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" />
          Add images
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={INJECT_MEDIA_ACCEPT}
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            addFiles(files);
            event.currentTarget.value = "";
          }}
        />
      </div>

      {fieldError ? (
        <div className="notice notice-error px-3 py-2 text-xs" role="alert" aria-live="assertive">
          {fieldError}
        </div>
      ) : null}

      {existingMedia.length === 0 && pendingFiles.length === 0 ? (
        <div
          className={`rounded-[12px] border border-dashed px-3 py-4 text-sm transition ${
            dropActive
              ? "border-primary/40 bg-primary/5 text-primary"
              : "border-[var(--studio-border)] text-[color:var(--studio-muted2)]"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            if (disabled) return;
            setDropActive(true);
          }}
          onDragLeave={() => setDropActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDropActive(false);
            if (disabled) return;
            const files = Array.from(event.dataTransfer.files ?? []);
            addFiles(files);
          }}
        >
          Drop images here or use <span className="font-semibold">Add images</span>.
        </div>
      ) : (
        <div
          className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${dropActive ? "rounded-[16px] bg-primary/5 p-2" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            if (disabled) return;
            setDropActive(true);
          }}
          onDragLeave={() => setDropActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDropActive(false);
            if (disabled) return;
            if (dragged) return;
            const files = Array.from(event.dataTransfer.files ?? []);
            addFiles(files);
          }}
        >
          {existingMedia.map((media) => (
            <div
              key={media.id}
              draggable={!disabled}
              onDragStart={() => setDragged({ kind: "existing", key: media.id })}
              onDragEnd={() => setDragged(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (!dragged || dragged.kind !== "existing" || dragged.key === media.id || !onMoveExisting) return;
                onMoveExisting(dragged.key, media.id);
                setDragged(null);
              }}
              className="overflow-hidden rounded-[14px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)]"
            >
              <div className="aspect-[4/3] bg-[color:var(--studio-surface)]">
                {media.signed_url ? (
                  <img
                    src={media.signed_url}
                    alt={media.alt_text ?? "Inject image"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-[color:var(--studio-muted2)]">
                    Preview unavailable
                  </div>
                )}
              </div>
              <div className="space-y-2 border-t border-[var(--studio-border)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
                    <GripVertical className="h-3.5 w-3.5" />
                    Attached
                  </div>
                  <div className="flex items-center gap-1">
                    {onMoveExisting ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            const index = existingMedia.findIndex((item) => item.id === media.id);
                            if (index > 0) onMoveExisting(media.id, existingMedia[index - 1].id);
                          }}
                          disabled={disabled || existingMedia[0]?.id === media.id}
                          title="Move image up"
                          aria-label="Move image up"
                        >
                          <MoveUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            const index = existingMedia.findIndex((item) => item.id === media.id);
                            if (index >= 0 && index < existingMedia.length - 1) {
                              onMoveExisting(media.id, existingMedia[index + 1].id);
                            }
                          }}
                          disabled={disabled || existingMedia[existingMedia.length - 1]?.id === media.id}
                          title="Move image down"
                          aria-label="Move image down"
                        >
                          <MoveDown className="h-4 w-4" />
                        </Button>
                      </>
                    ) : null}
                    {onRemoveExisting ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-destructive"
                        onClick={() => onRemoveExisting(media)}
                        disabled={disabled}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>

                <label className="block">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
                    Alt text
                  </div>
                  <input
                    type="text"
                    defaultValue={media.alt_text ?? ""}
                    onBlur={(event) => onUpdateExistingAlt?.(media, event.target.value)}
                    disabled={disabled || !onUpdateExistingAlt}
                    placeholder="What does this image show?"
                    className="h-9 w-full rounded-[12px] border border-[var(--studio-border)] bg-[color:var(--studio-surface)] px-3 text-sm"
                  />
                </label>
              </div>
            </div>
          ))}

          {pendingFiles.map((item, index) => (
            <div
              key={item.id}
              draggable={!disabled}
              onDragStart={() => setDragged({ kind: "pending", key: item.id })}
              onDragEnd={() => setDragged(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (!dragged || dragged.kind !== "pending" || dragged.key === item.id || !onMovePending) return;
                const fromIndex = pendingFiles.findIndex((file) => file.id === dragged.key);
                const toIndex = pendingFiles.findIndex((file) => file.id === item.id);
                if (fromIndex >= 0 && toIndex >= 0) onMovePending(fromIndex, toIndex);
                setDragged(null);
              }}
              className="overflow-hidden rounded-[14px] border border-dashed border-primary/25 bg-primary/5"
            >
              <div className="aspect-[4/3] bg-[color:var(--studio-surface)]">
                <img
                  src={pendingUrls[index]}
                  alt={item.alt_text || item.file.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="space-y-1 border-t border-primary/10 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="truncate text-xs font-semibold text-[color:var(--studio-ink)]">{item.file.name}</div>
                    <div className="text-[11px] text-[color:var(--studio-muted2)]">{formatBytes(item.file.size)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {onMovePending ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onMovePending(index, index - 1)}
                          disabled={disabled || index === 0}
                          title="Move image up"
                          aria-label="Move image up"
                        >
                          <MoveUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onMovePending(index, index + 1)}
                          disabled={disabled || index === pendingFiles.length - 1}
                          title="Move image down"
                          aria-label="Move image down"
                        >
                          <MoveDown className="h-4 w-4" />
                        </Button>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-2 px-0 text-destructive"
                      onClick={() => onRemovePending(index)}
                      disabled={disabled}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </div>

                <label className="block">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
                    Alt text
                  </div>
                  <input
                    type="text"
                    value={item.alt_text}
                    onChange={(event) => onUpdatePendingAlt?.(index, event.target.value)}
                    disabled={disabled || !onUpdatePendingAlt}
                    placeholder="What does this image show?"
                    className="h-9 w-full rounded-[12px] border border-primary/20 bg-white/80 px-3 text-sm"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
