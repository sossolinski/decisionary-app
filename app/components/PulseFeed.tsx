"use client";

import { useEffect, useMemo, useState } from "react";
import { getSessionInbox, subscribeInbox, type SessionInject } from "@/lib/sessions";

type Props = {
  sessionId: string;
  selectedId: string | null;
  onSelect: (item: SessionInject) => void;
};

/**
 * Pulse = "unverified stream" — na MVP trzymamy to jako injecty z kanałem "pulse" (lub "social").
 * Dzięki temu działa 1:1 z istniejącym SessionInject + MessageDetail + Actions.
 */
export default function PulseFeed({ sessionId, selectedId, onSelect }: Props) {
  const [items, setItems] = useState<SessionInject[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setErr(null);
      setLoading(true);
      const data = await getSessionInbox(sessionId);
      setItems(data);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load pulse");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!sessionId) return;
    load();
    const unsub = subscribeInbox(sessionId, load);
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // MVP: Pulse jako kanał w injects
  const pulseItems = useMemo(() => {
    const ch = (v?: string | null) => (v ?? "").toLowerCase();
    return items.filter((x) => {
      const c = ch(x.injects?.channel);
      return c === "pulse" || c === "social";
    });
  }, [items]);

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium">Pulse</div>
        <div className="text-xs opacity-70">
          {loading ? "Loading…" : `${pulseItems.length} posts`}
        </div>
      </div>

      {err && (
        <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="space-y-2">
        {pulseItems.map((row) => {
          const inj = row.injects;
          const active = selectedId === row.id;

          return (
            <button
              key={row.id}
              onClick={() => onSelect(row)}
              className={[
                "w-full rounded-xl border px-3 py-3 text-left transition",
                active ? "border-black/30 bg-black/5" : "border-black/10 hover:bg-black/5",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {inj?.title ?? "Pulse post"}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs opacity-70">
                    {inj?.body ?? ""}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 text-[11px] opacity-70">
                  <div className="rounded-full border border-black/10 px-2 py-0.5">
                    {inj?.channel ?? "pulse"}
                  </div>
                  {inj?.severity ? (
                    <div className="rounded-full border border-black/10 px-2 py-0.5">
                      {inj.severity}
                    </div>
                  ) : null}
                </div>
              </div>

              {(inj?.sender_name || inj?.sender_org) && (
                <div className="mt-2 text-[11px] opacity-70">
                  {inj?.sender_name ? inj.sender_name : ""}
                  {inj?.sender_org ? ` · ${inj.sender_org}` : ""}
                </div>
              )}
            </button>
          );
        })}

        {!loading && pulseItems.length === 0 && (
          <div className="rounded-xl border border-black/10 p-4 text-sm opacity-70">
            No pulse posts yet.
          </div>
        )}
      </div>
    </div>
  );
}
