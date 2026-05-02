// app/(app)/facilitator/scenarios/page.tsx
"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import {
  listScenarios,
  createScenario,
  deleteScenario,
  duplicateScenario,
  listFacilitators,
  listProfileIdentities,
  transferScenarioOwnership,
  shareScenario,
  revokeScenarioShare,
  type Scenario,
  type FacilitatorProfile,
} from "@/lib/facilitator";

import { getErrorMessage } from "@/lib/errors";
import { useRoleContext } from "@/app/components/useRoleContext";
import useAutoRefresh from "@/app/components/useAutoRefresh";
import ConfirmDialog from "@/app/components/ConfirmDialog";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import HintTooltip from "@/app/components/HintTooltip";

import {
  BookOpen,
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
  Sparkles,
  Library,
  PlayCircle,
  Radio,
  ArrowRight,
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

function facilitatorOptionLabel(facilitator: FacilitatorProfile) {
  if ((facilitator as { full_name?: string | null }).full_name?.trim()) {
    return (facilitator as { full_name?: string | null }).full_name!.trim();
  }
  if (facilitator.email?.trim()) return facilitator.email;
  return `Facilitator ${facilitator.id.slice(0, 8)}`;
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

type PendingConfirm = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "default" | "destructive";
  onConfirm: () => Promise<void>;
};

export default function FacilitatorScenariosPage() {
  const router = useRouter();
  const { loading: roleLoading, canFacilitate } = useRoleContext();

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [facilitators, setFacilitators] = useState<FacilitatorProfile[]>([]);
  const [newTitle, setNewTitle] = useState("");

  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  // search
  const [q, setQ] = useState("");

  // per-scenario target selection (transfer/share/revoke)
  const [targetByScenario, setTargetByScenario] = useState<Record<string, string>>({});
  const [profileLabelById, setProfileLabelById] = useState<Record<string, string>>({});

  // per-scenario manage popover
  const [manageOpenId, setManageOpenId] = useState<string | null>(null);
  const manageButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const managePanelRef = useRef<HTMLDivElement | null>(null);
  const [managePanelPosition, setManagePanelPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!manageOpenId) return;
    const openId = manageOpenId;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setManageOpenId(null);
    }

    function onDown(e: MouseEvent) {
      const panel = managePanelRef.current;
      const button = manageButtonRefs.current[openId];
      if (!(e.target instanceof Node)) return;
      if (panel?.contains(e.target) || button?.contains(e.target)) return;
      setManageOpenId(null);
    }

    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [manageOpenId]);

  useLayoutEffect(() => {
    if (!manageOpenId) return;
    const openId = manageOpenId;

    const gap = 10;
    const viewportPadding = 16;

    function placePanel() {
      const button = manageButtonRefs.current[openId];
      const panel = managePanelRef.current;
      if (!button || !panel) return;

      const anchor = button.getBoundingClientRect();
      const panelWidth = panel.offsetWidth;
      const panelHeight = panel.offsetHeight;

      let nextLeft = anchor.right - panelWidth;
      let nextTop = anchor.bottom + gap;

      if (nextTop + panelHeight > window.innerHeight - viewportPadding) {
        nextTop = Math.max(viewportPadding, anchor.top - panelHeight - gap);
      }

      if (nextLeft < viewportPadding) nextLeft = viewportPadding;
      if (nextLeft + panelWidth > window.innerWidth - viewportPadding) {
        nextLeft = window.innerWidth - panelWidth - viewportPadding;
      }

      setManagePanelPosition({ top: nextTop, left: nextLeft });
    }

    placePanel();
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", placePanel, true);
    return () => {
      window.removeEventListener("resize", placePanel);
      window.removeEventListener("scroll", placePanel, true);
    };
  }, [manageOpenId]);

  /* ================= AUTH GUARD ================= */
  useEffect(() => {
    if (roleLoading || !canFacilitate) return;
    void load().catch((e: unknown) => setError(getErrorMessage(e, "Failed to load")));
  }, [roleLoading, canFacilitate]);

  useAutoRefresh(
    async () => {
      await load();
    },
    { enabled: !roleLoading && canFacilitate, intervalMs: 30000 }
  );

  async function load() {
    setError(null);
    setNotice(null);
    const [scenariosRes, facilitatorsRes] = await Promise.allSettled([
      listScenarios(),
      listFacilitators(),
    ]);

    if (scenariosRes.status === "fulfilled") {
      const nextScenarios = scenariosRes.value ?? [];
      setScenarios(nextScenarios);
      try {
        const identities = await listProfileIdentities(
          nextScenarios.flatMap((scenario) => [
            scenario.owner_id,
            scenario.created_by,
            scenario.updated_by,
          ])
        );
        setProfileLabelById(
          Object.fromEntries(
            identities.map((identity) => {
              const label =
                identity.full_name?.trim() ||
                identity.email?.trim() ||
                `Account ${identity.user_id.slice(0, 8)}`;
              return [identity.user_id, label];
            })
          )
        );
      } catch {
        setProfileLabelById({});
      }
    } else {
      setScenarios([]);
      setProfileLabelById({});
      setError(getErrorMessage(scenariosRes.reason, "Failed to load scenarios."));
    }

    if (facilitatorsRes.status === "fulfilled") {
      setFacilitators((facilitatorsRes.value ?? []) as FacilitatorProfile[]);
    } else {
      setFacilitators([]);
      if (scenariosRes.status === "fulfilled") {
        setNotice("Scenarios loaded, but facilitator sharing options are temporarily unavailable.");
      }
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
    const scenario = scenarios.find((item) => item.id === id);
    setPendingConfirm({
      title: "Delete scenario?",
      description: `This permanently deletes "${scenario?.title ?? "Untitled scenario"}" and its scenario timeline. Existing sessions are not removed.`,
      confirmLabel: "Delete scenario",
      tone: "destructive",
      onConfirm: () => deleteNow(id),
    });
  }

  async function deleteNow(id: string) {
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
    return profileLabelById[userId] ?? idToEmail.get(userId) ?? `Account ${userId.slice(0, 8)}`;
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return scenarios;

    return scenarios.filter((s) => {
      const t = (s.title ?? "").toLowerCase();
      const d = (s.description ?? "").toLowerCase();
      const w = (s.weather ?? "").toLowerCase();
      const id = (s.id ?? "").toLowerCase();
      return `${t}\n${d}\n${w}\n${id}`.includes(query);
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
    <div className="space-y-5">
      <section className="ui-section-panel">
        <div className="relative px-5 py-5 md:px-6 md:py-6">
          <div className="relative grid gap-5 lg:grid-cols-[1.45fr_auto] lg:items-start">
            <div className="space-y-4">
              <div className="ui-eyebrow">
                <Sparkles className="h-3.5 w-3.5" />
                Scenario library
                <HintTooltip
                  text="Build, search, and refine your scenario library here, then hand off clean exercises into live sessions."
                  side="bottom"
                />
              </div>

              <div className="space-y-2">
                <h1 className="text-[28px] font-semibold tracking-tight">Design exercises that feel structured before they feel stressful.</h1>
              </div>

            </div>

            <div className="grid gap-3 sm:grid-cols-1">
              <div className="ui-metric-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="ui-metric-label">Scenarios</div>
                    <div className="mt-2 text-3xl font-semibold">{scenarios.length}</div>
                  </div>
                  <Library className="h-4 w-4 text-foreground/60" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[12px] bg-background/60 px-4 py-4 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.035)]">
          <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="ui-section-label">
                  Search
                </div>
                <HintTooltip
                  text="Find scenarios by title, description, or ID."
                  side="right"
                />
              </div>
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search scenarios by title, description, or id…" className="pl-9" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="ui-section-label">
                  Create
                </div>
                <HintTooltip
                  text="Start a new draft here and flesh it out in the editor."
                  side="left"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="w-full">
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="New scenario title"
                  />
                </div>
                <Button onClick={onCreate} disabled={loading || !newTitle.trim()} className="gap-2 sm:min-w-[120px]">
                  <Check className="h-4 w-4" />
                  {loading ? "…" : "Create"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Error */}
      {error ? (
        <div className="notice notice-error">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="notice notice-success">
          {notice}
        </div>
      ) : null}

      <div className="ui-row-panel">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-foreground">New to scenario design?</div>
            <div className="text-sm leading-6 text-[color:var(--studio-muted)]">
              Follow the manual step by step, then come back here to create your first scenario draft and rehearsal flow.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/facilitator/guide#prepare">
                Open scenario guide
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/facilitator/guide#first-rehearsal">First rehearsal path</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <div className="ui-empty-state">
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
              <div key={s.id} className="ui-row-panel overflow-visible">
                <div className="px-5 py-5 md:px-6 md:py-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-primary/10">
                        <BookOpen className="h-4.5 w-4.5 text-primary" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-lg font-semibold tracking-tight truncate">
                            {s.title ?? "Untitled scenario"}
                          </div>
                          {isUuid(s.id) ? (
                            <span className="text-[11px] rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2 py-0.5 text-[color:var(--studio-muted2)]">
                              {s.id.slice(0, 8)}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-3 grid gap-1.5">
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

                        <div className="mt-4 text-sm leading-7 text-[color:var(--studio-muted)]">
                          {s.description ? s.description : "No description yet. Open the editor to add context, structure, and exercise detail."}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end md:pt-0.5">
                    <Button
                      variant="secondary"
                      onClick={() => router.push(`/facilitator/scenarios/${s.id}`)}
                      className="gap-2"
                    >
                      <ExternalLink className="h-4 w-4 opacity-80" />
                      Open
                    </Button>

                    <div className="relative">
                      <Button
                        ref={(node) => {
                          manageButtonRefs.current[s.id] = node;
                        }}
                        variant="outline"
                        size="icon"
                        onClick={() => setManageOpenId((prev) => (prev === s.id ? null : s.id))}
                        title="Manage"
                        aria-label={`Manage scenario ${s.title}`}
                        aria-expanded={open}
                        aria-controls={open ? `manage-scenario-${s.id}` : undefined}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>

                      {open && typeof document !== "undefined"
                        ? createPortal(
                        <div
                          id={`manage-scenario-${s.id}`}
                          ref={managePanelRef}
                          role="dialog"
                          aria-label={`Manage scenario ${s.title}`}
                          className="fixed z-[110] w-[380px] max-w-[92vw] popover-solid rounded-[14px] shadow-soft overflow-hidden"
                          style={
                            managePanelPosition
                              ? {
                                  top: `${managePanelPosition.top}px`,
                                  left: `${managePanelPosition.left}px`,
                                }
                              : {
                                  top: "-9999px",
                                  left: "-9999px",
                                }
                          }
                        >
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
                                onClick={() => router.push(`/facilitator/sessions?scenario=${s.id}&mode=rehearsal`)}
                                title="Start a solo rehearsal from this scenario"
                              >
                                <Radio className="h-4 w-4" />
                                Rehearse
                              </Button>

                              <Button
                                variant="outline"
                                className="justify-start gap-2"
                                onClick={() => router.push(`/facilitator/sessions?scenario=${s.id}&mode=live&tier=5`)}
                                title="Start a live exercise from this scenario"
                              >
                                <PlayCircle className="h-4 w-4" />
                                Live exercise
                              </Button>

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
                              <div className="flex items-center gap-2 text-xs font-semibold text-[color:var(--studio-muted2)]">
                                Facilitator target
                                <HintTooltip
                                  text="Use the selected facilitator for transfer, share, or revoke."
                                  side="left"
                                />
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
                                    {facilitatorOptionLabel(f)}
                                  </option>
                                ))}
                              </Select>
                            </div>

                            {/* Transfer + Share */}
                            <div className="grid grid-cols-1 gap-2">
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

                              <div className="grid grid-cols-2 gap-2">
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
                            </div>
                          </div>
                        </div>,
                        document.body
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        title={pendingConfirm?.title ?? ""}
        description={pendingConfirm?.description ?? ""}
        confirmLabel={pendingConfirm?.confirmLabel}
        tone={pendingConfirm?.tone}
        onOpenChange={(open) => {
          if (!open) setPendingConfirm(null);
        }}
        onConfirm={async () => {
          await pendingConfirm?.onConfirm();
        }}
      />
    </div>
  );
}
