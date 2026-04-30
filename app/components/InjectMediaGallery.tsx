"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import { X } from "lucide-react";

import type { InjectMedia } from "@/lib/injectMedia";

type InjectMediaGalleryProps = {
  media: InjectMedia[];
  title?: string;
};

export default function InjectMediaGallery({ media, title = "Attached images" }: InjectMediaGalleryProps) {
  const available = useMemo(
    () => media.filter((item) => Boolean(item.signed_url)),
    [media]
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (available.length === 0) return null;

  return (
    <>
      <div className="mt-4 rounded-[20px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] p-5 shadow-[0_10px_24px_hsl(220_20%_20%/0.03)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
          {title}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {available.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className="overflow-hidden rounded-[16px] border border-[var(--studio-border)] bg-[color:var(--studio-surface)] text-left transition hover:border-[var(--studio-border-strong)]"
              onClick={() => setActiveIndex(index)}
            >
              <div className="aspect-[4/3] bg-[color:var(--studio-surface2)]">
                <img
                  src={item.signed_url ?? undefined}
                  alt={item.alt_text ?? "Inject image"}
                  className="h-full w-full object-cover"
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {activeIndex !== null ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full border border-white/15 bg-white/10 p-2 text-white transition hover:bg-white/20"
            onClick={() => setActiveIndex(null)}
            aria-label="Close image preview"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="max-h-[90vh] max-w-[90vw] overflow-hidden rounded-[20px] border border-white/10 bg-black">
            <img
              src={available[activeIndex].signed_url ?? undefined}
              alt={available[activeIndex].alt_text ?? "Inject image"}
              className="max-h-[90vh] max-w-[90vw] object-contain"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
