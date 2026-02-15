// app/(app)/facilitator/scenarios/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

function fmt(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

export default function FacilitatorScenariosPage() {
  const router = useRouter();

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [facilitators, setFacilitators] = useState<FacilitatorProfile[]>([]);
  const [newTitle, setNewTitle] = useState("");

  const [loading, setLoading] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [shareTargetByScenario, setShareTargetByScenario] = useState<
    Record<string, string>
  >({});

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
    })().catch((e: any) => setError(e?.message ?? "Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function load() {
    setError(null);
    try {
      const [scs, facs] = await Promise.all([listScenarios(), listFacilitators()]);
      setScenarios(scs ?? []);
      setFacilitators((facs ?? []) as FacilitatorProfile[]);
    } catch (e: any) {
      setError(e?.message ?? "Load failed");
    }
  }

  /* ================= ACTIONS ================= */
  async function onCreate() {
    if (!newTitle.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const s = await createScenario(newTitle.trim());
      setScenarios((prev) => [s, ...prev]);
      setNewTitle("");
    } catch (e: any) {
      setError(e?.message ?? "Create failed");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this scenario?")) return;
    setError(null);
    try {
      await deleteScenario(id);
      setScenarios((prev) => prev.filter((s) => s.id !== id));
    } catch (e: any) {
      setError(e?.message ?? "Delete failed");
    }
  }

  async function onDuplicate(id: string) {
    setError(null);
    setDuplicatingId(id);
    try {
      const copy = await duplicateScenario(id);
      setScenarios((prev) => [copy, ...prev]);
    } catch (e: any) {
      setError(e?.message ?? "Duplicate failed");
    } finally {
      setDuplicatingId(null);
    }
  }

  async function onAssign(scenarioId: string, newOwnerId: string) {
    if (!newOwnerId) return;
    setError(null);
    setAssigningId(scenarioId);
    try {
      await transferScenarioOwnership(scenarioId, newOwnerId);
      setScenarios((prev) => prev.filter((s) => s.id !== scenarioId));
    } catch (e: any) {
      setError(e?.message ?? "Assign failed");
    } finally {
      setAssigningId(null);
    }
  }

  async function onShare(scenarioId: string) {
    const targetId = shareTargetByScenario[scenarioId];
    if (!targetId) {
      setError("Select facilitator to share with.");
      return;
    }
    setError(null);
    setSharingId(scenarioId);
    try {
      await shareScenario(scenarioId, targetId, "read");
      alert("Shared (read-only).");
    } catch (e: any) {
      setError(e?.message ?? "Share failed");
    } finally {
      setSharingId(null);
    }
  }

  async function onRevoke(scenarioId: string) {
    const targetId = shareTargetByScenario[scenarioId];
    if (!targetId) {
      setError("Select facilitator to revoke.");
      return;
    }
    setError(null);
    setSharingId(scenarioId);
    try {
      await revokeScenarioShare(scenarioId, targetId);
      alert("Share revoked.");
    } catch (e: any) {
      setError(e?.message ?? "Revoke failed");
    } finally {
      setSharingId(null);
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

  const selectCls = [
    "h-10 rounded-[var(--radius)] px-3 text-sm",
    "border border-[var(--studio-border)]",
    "bg-[var(--studio-surface2)] text-foreground",
    "focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]",
  ].join(" ");

  /* ================= UI ================= */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Scenarios</h1>
          <p className="mt-1 text-sm text-[color:var(--studio-muted2)]">
            Manage scenario library, ownership, and sharing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Error */}
      {error ? (
        <div className="rounded-[14px] border border-[var(--studio-border)] bg-destructive/10 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      {/* Create */}
      <Card>
        <CardHeader>
          <CardTitle>Create scenario</CardTitle>
          <CardDescription>Start a new scenario draft.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1 min-w-[240px]">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="New scenario title"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onCreate} disabled={loading}>
                {loading ? "…" : "Create"}
              </Button>
              <Button variant="outline" onClick={load}>
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {scenarios.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-sm text-[color:var(--studio-muted2)]">
              No scenarios yet.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {scenarios.map((s) => {
            const selectedTarget = shareTargetByScenario[s.id] ?? "";
            const isAssigning = assigningId === s.id;
            const isSharing = sharingId === s.id;
            const isDup = duplicatingId === s.id;

            return (
              <Card key={s.id}>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">
                      {s.title ?? "Untitled scenario"}
                    </CardTitle>

                    <div className="mt-2 text-xs text-[color:var(--studio-muted2)]">
                      Created: {fmt(s.created_at)} by{" "}
                      <span className="text-foreground">{who(s.created_by)}</span>
                      {" · "}
                      Updated: {fmt(s.updated_at)} by{" "}
                      <span className="text-foreground">{who(s.updated_by)}</span>
                    </div>

                    <div className="mt-2 text-sm text-[color:var(--studio-muted2)]">
                      {s.description ? s.description : "No description"}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/facilitator/scenarios/${s.id}`)}
                    >
                      Open
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => onDuplicate(s.id)}
                      disabled={isDup}
                    >
                      {isDup ? "…" : "Duplicate"}
                    </Button>

                    <Button variant="destructive" onClick={() => onDelete(s.id)}>
                      Delete
                    </Button>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {/* Assign */}
                    <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] p-4">
                      <div className="text-xs font-medium text-[color:var(--studio-muted2)] mb-2">
                        Assign (transfer owner)
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <select
                          value={selectedTarget}
                          onChange={(e) =>
                            setShareTargetByScenario((prev) => ({
                              ...prev,
                              [s.id]: e.target.value,
                            }))
                          }
                          className={`${selectCls} w-full sm:w-[320px]`}
                        >
                          <option value="">Select facilitator…</option>
                          {facilitators.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.email ?? f.id}
                            </option>
                          ))}
                        </select>

                        <Button
                          variant="secondary"
                          onClick={() => onAssign(s.id, selectedTarget)}
                          disabled={isAssigning || !selectedTarget}
                        >
                          {isAssigning ? "…" : "Transfer"}
                        </Button>
                      </div>
                      <div className="mt-2 text-xs text-[color:var(--studio-muted2)]">
                        Transfer removes it from your list.
                      </div>
                    </div>

                    {/* Share */}
                    <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] p-4">
                      <div className="text-xs font-medium text-[color:var(--studio-muted2)] mb-2">
                        Share (keeps owner)
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <select
                          value={selectedTarget}
                          onChange={(e) =>
                            setShareTargetByScenario((prev) => ({
                              ...prev,
                              [s.id]: e.target.value,
                            }))
                          }
                          className={`${selectCls} w-full sm:w-[320px]`}
                        >
                          <option value="">Select facilitator…</option>
                          {facilitators.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.email ?? f.id}
                            </option>
                          ))}
                        </select>

                        <Button
                          variant="outline"
                          onClick={() => onShare(s.id)}
                          disabled={isSharing}
                        >
                          {isSharing ? "…" : "Share"}
                        </Button>

                        <Button
                          variant="secondary"
                          onClick={() => onRevoke(s.id)}
                          disabled={isSharing}
                        >
                          {isSharing ? "…" : "Revoke"}
                        </Button>
                      </div>
                      <div className="mt-2 text-xs text-[color:var(--studio-muted2)]">
                        Shares as read-only.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
