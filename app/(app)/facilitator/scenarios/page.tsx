// app/(app)/facilitator/scenarios/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getMyRole } from "@/lib/users";
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

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

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

  const [shareTargetByScenario, setShareTargetByScenario] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const role = await getMyRole();
      if (!role) return router.replace("/login");
      if (role !== "facilitator") return router.replace("/participant");
      await load();
    })().catch((e: any) => setError(e?.message ?? "Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function load() {
    setError(null);
    try {
      const [scs, facs] = await Promise.all([listScenarios(), listFacilitators()]);
      setScenarios(scs ?? []);
      setFacilitators(facs ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Load failed");
    }
  }

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

  const idToEmail = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of facilitators) {
      if (f.email) m.set(f.id, f.email);
    }
    return m;
  }, [facilitators]);

  function fmt(dt?: string | null) {
    if (!dt) return "—";
    try {
      return new Date(dt).toLocaleString();
    } catch {
      return dt;
    }
  }

  function who(userId?: string | null) {
    if (!userId) return "—";
    return idToEmail.get(userId) ?? userId;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Scenarios</h1>
          <p className="text-sm text-muted-foreground">
            Create, duplicate, transfer and share scenarios.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-[var(--radius)] border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.06)] px-4 py-3 text-sm font-semibold text-[hsl(var(--destructive))]">
          {error}
        </div>
      ) : null}

      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Create</CardTitle>
          <CardDescription className="text-sm">Create a new scenario owned by you.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New scenario title"
            className="min-w-[260px] flex-1"
          />
          <Button variant="primary" onClick={onCreate} disabled={loading}>
            {loading ? "..." : "Create"}
          </Button>
        </CardContent>
      </Card>

      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Library</CardTitle>
          <CardDescription className="text-sm">{scenarios.length} scenario(s)</CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {scenarios.length === 0 ? (
            <div className="text-sm text-muted-foreground">No scenarios yet.</div>
          ) : (
            <div className="grid gap-3">
              {scenarios.map((s) => {
                const selectedTarget = shareTargetByScenario[s.id] ?? "";
                const isDuplicating = duplicatingId === s.id;
                const isAssigning = assigningId === s.id;
                const isSharing = sharingId === s.id;

                return (
                  <div key={s.id} className="rounded-[var(--radius)] border border-border bg-card px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-extrabold">{s.title}</div>

                        <div className="mt-1 text-xs text-muted-foreground">
                          Created: <b>{fmt(s.created_at)}</b> by <b>{who(s.created_by)}</b>
                          {" · "}
                          Updated: <b>{fmt(s.updated_at)}</b> by <b>{who(s.updated_by)}</b>
                        </div>

                        {s.description ? (
                          <div className="mt-2 text-sm text-muted-foreground line-clamp-2">{s.description}</div>
                        ) : (
                          <div className="mt-2 text-sm text-muted-foreground">No description</div>
                        )}

                        <div className="mt-2 text-xs text-muted-foreground">
                          ID: <code className="font-mono">{s.id}</code>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button variant="primary" onClick={() => router.push(`/facilitator/scenarios/${s.id}`)}>
                          Open
                        </Button>

                        <Button variant="secondary" onClick={() => onDuplicate(s.id)} disabled={isDuplicating}>
                          {isDuplicating ? "..." : "Duplicate"}
                        </Button>

                        <Button variant="danger" onClick={() => onDelete(s.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-[var(--radius)] border border-border bg-background px-3 py-3">
                        <div className="text-sm font-semibold">Assign (transfer owner)</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select
                            onChange={(e) => onAssign(s.id, e.target.value)}
                            disabled={isAssigning}
                            className="h-10 min-w-[260px] rounded-[var(--radius)] border border-border bg-background px-3 text-sm"
                            defaultValue=""
                          >
                            <option value="" disabled>
                              Select facilitator…
                            </option>
                            {facilitators.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.email ?? f.id}
                              </option>
                            ))}
                          </select>

                          <div className="text-xs text-muted-foreground">
                            {isAssigning ? "Transferring…" : "You will lose ownership after transfer."}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[var(--radius)] border border-border bg-background px-3 py-3">
                        <div className="text-sm font-semibold">Share (keeps owner)</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select
                            value={selectedTarget}
                            onChange={(e) =>
                              setShareTargetByScenario((prev) => ({ ...prev, [s.id]: e.target.value }))
                            }
                            className="h-10 min-w-[260px] rounded-[var(--radius)] border border-border bg-background px-3 text-sm"
                          >
                            <option value="">Select facilitator…</option>
                            {facilitators.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.email ?? f.id}
                              </option>
                            ))}
                          </select>

                          <Button variant="primary" onClick={() => onShare(s.id)} disabled={isSharing}>
                            {isSharing ? "..." : "Share"}
                          </Button>

                          <Button variant="secondary" onClick={() => onRevoke(s.id)} disabled={isSharing}>
                            Revoke
                          </Button>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Share creates a read-only entry in <code className="font-mono">scenario_shares</code>.
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
