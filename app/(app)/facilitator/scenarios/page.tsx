// app/(app)/facilitator/scenarios/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  listScenarios,
  createScenario,
  deleteScenario,
  duplicateScenario,
  listFacilitators,
  transferScenarioOwnership,
  shareScenario,
  revokeScenarioShare,
  type Scenario,
  type FacilitatorProfile,
} from "@/lib/facilitator";

import { getMyRole } from "@/lib/users";
import { getErrorMessage } from "@/lib/errors";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

import {
  BookOpen,
  Plus,
  Search,
  MoreHorizontal,
  Copy,
  Trash2,
  UserRound,
  Share2,
  Ban,
  ExternalLink,
  RefreshCw,
  Check,
  X,
} from "lucide-react";

function fmt(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function useOutsideClose(
  open: boolean,
  wrapRef: React.RefObject<HTMLElement | null>,
  onClose: () => void
) {
  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onDown(e: MouseEvent) {
      const el = wrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) onClose();
    }

    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, wrapRef, onClose]);
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
      className={[
        "h-10 w-full rounded-[var(--radius)] px-3 text-sm",
        "border border-[var(--studio-border)]",
        "bg-[var(--studio-surface2)] text-foreground",
        "shadow-[0_1px_2px_hsl(220_20%_20%/0.06)]",
        "hover:border-[var(--studio-border-strong)]",
        "focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]",
        "transition-[box-shadow,border-color,background-color] duration-150",
      ].join(" ")}
    >
      {children}
    </select>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-xs text-[color:var(--studio-muted2)]">
      <div className="mt-[1px] opacity-80">{icon}</div>
      <div className="min-w-0">
        <span className="font-medium">{label}:</span> <span className="text-foreground/80">{value}</span>
      </div>
    </div>
  );
}

export default function FacilitatorScenariosPage() {
  const router = useRouter();

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [facilitators, setFacilitators] = useState<FacilitatorProfile[]>([]);
  const [newTitle, setNewTitle] = useState("");

  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // search
  const [q, setQ] = useState("");

  // per-scenario target selection (transfer/share/revoke)
  const [targetByScenario, setTargetByScenario] = useState<Record<string, string>>({});

  // per-scenario manage popover
  const [manageOpenId, setManageOpenId] = useState<string | null>(null);
  const manageWrapRef = useRef<HTMLDivElement | null>(null);

  useOutsideClose(Boolean(manageOpenId), manageWrapRef, () => setManageOpenId(null));

  /* ================= AUTH GUARD ================= */
  useEffect(() => {
    (async () => {
      const role = await getMyRole();
      if (!role) {
        router.replace("/login");
        return;
      }
      if (role !== "facilitator") {
        router.replace("/participant");
        return;
      }
      await load();
    })().catch((e: unknown) => setError(getErrorMessage(e, "Failed to load")));
  }, [router]);

  async function load() {
    setError(null);
    setNotice(null);
    try {
      const [scs, facs] = await Promise.all([listScenarios(), listFacilitators()]);
      setScenarios(scs ?? []);
      setFacilitators((facs ?? []) as FacilitatorProfile[]);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Load failed"));
    }
  }

  /* ================= ACTIONS ================= */
  async function onCreate() {
    if (!newTitle.trim()) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const s = await createScenario(newTitle.trim());
      setScenarios((prev) => [s, ...prev]);
      setNewTitle("");
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Create failed"));
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this scenario?")) return;
    setError(null);
    setNotice(null);
    setBusyId(id);
    try {
      await deleteScenario(id);
      setScenarios((prev) => prev.filter((s) => s.id !== id));
      if (manageOpenId === id) setManageOpenId(null);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Delete failed"));
    } finally {
      setBusyId(null);
    }
  }

  async function onDuplicate(id: string) {
    setError(null);
    setNotice(null);
    setBusyId(id);
    try {
      const copy = await duplicateScenario(id);
      setScenarios((prev) => [copy, ...prev]);
      if (manageOpenId === id) setManageOpenId(null);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Duplicate failed"));
    } finally {
      setBusyId(null);
    }
  }

  async function onTransfer(scenarioId: string) {
    const newOwnerId = targetByScenario[scenarioId];
    if (!newOwnerId) {
      setError("Select facilitator first.");
      return;
    }
    setError(null);
    setNotice(null);
    setBusyId(scenarioId);
    try {
      await transferScenarioOwnership(scenarioId, newOwnerId);
      // remove from my list (as before)
      setScenarios((prev) => prev.filter((s) => s.id !== scenarioId));
      setManageOpenId(null);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Transfer failed"));
    } finally {
      setBusyId(null);
    }
  }

  async function onShare(scenarioId: string) {
    const targetId = targetByScenario[scenarioId];
    if (!targetId) {
      setError("Select facilitator to share with.");
      return;
    }
    setError(null);
    setNotice(null);
    setBusyId(scenarioId);
    try {
      await shareScenario(scenarioId, targetId, "read");
      setNotice("Shared (read-only).");
      setManageOpenId(null);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Share failed"));
    } finally {
      setBusyId(null);
    }
  }

  async function onRevoke(scenarioId: string) {
    const targetId = targetByScenario[scenarioId];
    if (!targetId) {
      setError("Select facilitator to revoke.");
      return;
    }
    setError(null);
    setNotice(null);
    setBusyId(scenarioId);
    try {
      await revokeScenarioShare(scenarioId, targetId);
      setNotice("Share revoked.");
      setManageOpenId(null);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Revoke failed"));
    } finally {
      setBusyId(null);
    }
  }

  /* ================= HELPERS ================= */
  const idToEmail = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of facilitators) {
      if (f.email) m.set(f.id, f.email);
    }
    return m;
  }, [facilitators]);

  function who(userId?: string | null) {
    if (!userId) return "—";
    return idToEmail.get(userId) ?? userId;
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return scenarios;

    return scenarios.filter((s) => {
      const t = (s.title ?? "").toLowerCase();
      const d = (s.description ?? "").toLowerCase();
      const id = (s.id ?? "").toLowerCase();
      return `${t}\n${d}\n${id}`.includes(query);
    });
  }, [scenarios, q]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return tb - ta;
    });
    return arr;
  }, [filtered]);

  /* ================= UI ================= */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-visible">
        <div className="px-5 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BookOpen className="h-4 w-4 opacity-80" />
              Scenarios
            </div>
            <div className="mt-1 text-xs text-[color:var(--studio-muted2)]">
              Manage scenario library, ownership, and sharing.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={load} className="gap-2" title="Reload scenarios">
              <RefreshCw className="h-4 w-4 opacity-80" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="border-t border-[var(--studio-border)] px-5 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Search */}
          <div className="relative w-full md:max-w-[520px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search scenarios…" className="pl-9" />
          </div>

          <div className="text-xs text-[color:var(--studio-muted2)]">
            {sorted.length} / {scenarios.length} shown
          </div>
        </div>
      </div>

      {/* Error */}
      {error ? (
        <div className="rounded-[14px] border border-[var(--studio-border)] bg-destructive/10 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-[14px] border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          {notice}
        </div>
      ) : null}

      {/* Create */}
      <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden">
        <div className="px-5 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Plus className="h-4 w-4 opacity-80" />
              Create scenario
            </div>
            <div className="mt-1 text-xs text-[color:var(--studio-muted2)]">
              Start a new scenario draft.
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full md:w-auto">
            <div className="w-full md:w-[420px]">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="New scenario title"
              />
            </div>
            <Button onClick={onCreate} disabled={loading || !newTitle.trim()} className="gap-2">
              <Check className="h-4 w-4" />
              {loading ? "…" : "Create"}
            </Button>
          </div>
        </div>
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden">
          <div className="p-5 text-sm text-[color:var(--studio-muted2)]">
            {q.trim() ? "No scenarios match your search." : "No scenarios yet."}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {sorted.map((s) => {
            const target = targetByScenario[s.id] ?? "";
            const busy = busyId === s.id;
            const open = manageOpenId === s.id;

            const createdBy = who(s.created_by);
            const updatedBy = who(s.updated_by);

            return (
              <div key={s.id} className="surface shadow-soft rounded-[var(--studio-radius)] overflow-visible">
                <div className="px-5 py-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-[12px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] p-2">
                        <BookOpen className="h-5 w-5 opacity-80" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-base font-semibold truncate">
                            {s.title ?? "Untitled scenario"}
                          </div>
                          {isUuid(s.id) ? (
                            <span className="text-[11px] rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2 py-0.5 text-[color:var(--studio-muted2)]">
                              {s.id.slice(0, 8)}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 grid gap-1">
                          <MetaRow
                            icon={<UserRound className="h-3.5 w-3.5" />}
                            label="Created"
                            value={
                              <>
                                {fmt(s.created_at)} by <span className="text-foreground">{createdBy}</span>
                              </>
                            }
                          />
                          <MetaRow
                            icon={<RefreshCw className="h-3.5 w-3.5" />}
                            label="Updated"
                            value={
                              <>
                                {fmt(s.updated_at)} by <span className="text-foreground">{updatedBy}</span>
                              </>
                            }
                          />
                        </div>

                        <div className="mt-3 text-sm text-[color:var(--studio-muted2)]">
                          {s.description ? s.description : "No description"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/facilitator/scenarios/${s.id}`)}
                      className="gap-2"
                    >
                      <ExternalLink className="h-4 w-4 opacity-80" />
                      Open
                    </Button>

                    <div className="relative" ref={open ? manageWrapRef : undefined}>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setManageOpenId((prev) => (prev === s.id ? null : s.id))}
                        title="Manage"
                        aria-label="Manage"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>

                      {open ? (
                        <div className="absolute right-0 mt-2 w-[520px] max-w-[92vw] popover-solid rounded-[14px] shadow-soft overflow-hidden z-50">
                          <div className="px-4 py-3 border-b border-[var(--studio-border)] flex items-center justify-between">
                            <div className="text-sm font-semibold">Manage scenario</div>
                            <Button variant="outline" size="sm" onClick={() => setManageOpenId(null)} className="gap-2">
                              <X className="h-4 w-4" />
                              Close
                            </Button>
                          </div>

                          <div className="p-4 space-y-4">
                            {/* Quick actions */}
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <Button
                                variant="outline"
                                className="justify-start gap-2"
                                onClick={() => onDuplicate(s.id)}
                                disabled={busy}
                                title="Create your own copy"
                              >
                                <Copy className="h-4 w-4" />
                                {busy ? "…" : "Duplicate"}
                              </Button>

                              <Button
                                variant="destructive"
                                className="justify-start gap-2"
                                onClick={() => onDelete(s.id)}
                                disabled={busy}
                                title="Delete scenario"
                              >
                                <Trash2 className="h-4 w-4" />
                                {busy ? "…" : "Delete"}
                              </Button>
                            </div>

                            {/* Target selector */}
                            <div className="space-y-2">
                              <div className="text-xs font-semibold text-[color:var(--studio-muted2)]">
                                Facilitator target
                              </div>
                              <Select
                                value={target}
                                onChange={(v) =>
                                  setTargetByScenario((prev) => ({
                                    ...prev,
                                    [s.id]: v,
                                  }))
                                }
                              >
                                <option value="">Select facilitator…</option>
                                {facilitators.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.email ?? f.id}
                                  </option>
                                ))}
                              </Select>
                              <div className="text-xs text-[color:var(--studio-muted2)]">
                                Used for transfer / share / revoke.
                              </div>
                            </div>

                            {/* Transfer + Share */}
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                              <Button
                                variant="secondary"
                                className="justify-start gap-2"
                                onClick={() => onTransfer(s.id)}
                                disabled={busy || !target}
                                title="Transfer ownership (removes scenario from your list)"
                              >
                                <UserRound className="h-4 w-4" />
                                Transfer
                              </Button>

                              <Button
                                variant="outline"
                                className="justify-start gap-2"
                                onClick={() => onShare(s.id)}
                                disabled={busy || !target}
                                title="Share read-only"
                              >
                                <Share2 className="h-4 w-4" />
                                Share
                              </Button>

                              <Button
                                variant="outline"
                                className="justify-start gap-2"
                                onClick={() => onRevoke(s.id)}
                                disabled={busy || !target}
                                title="Revoke share"
                              >
                                <Ban className="h-4 w-4" />
                                Revoke
                              </Button>
                            </div>

                            <div className="text-[11px] text-[color:var(--studio-muted2)]">
                              Transfer changes owner (you will no longer see it). Share keeps owner and grants read-only access.
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
