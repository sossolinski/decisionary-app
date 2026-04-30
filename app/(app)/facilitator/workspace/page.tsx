"use client";

import { useEffect, useId, useState } from "react";
import {
  addManagedParticipant,
  deactivateManagedParticipant,
  listParticipantsForOrg,
  type ManagedParticipant,
} from "@/lib/organizations";
import { useRoleContext } from "@/app/components/useRoleContext";
import useAutoRefresh from "@/app/components/useAutoRefresh";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import HintTooltip from "@/app/components/HintTooltip";
import { copyTextToClipboard } from "@/lib/clientClipboard";
import { getErrorMessage } from "@/lib/errors";

function toMessage(err: unknown, fallback: string) {
  return getErrorMessage(err, fallback);
}

type PendingConfirm = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "default" | "destructive";
  onConfirm: () => Promise<void>;
};

export default function FacilitatorWorkspacePage() {
  const {
    loading,
    canFacilitate,
    organizations,
    activeOrg,
    activeOrgId,
    setActiveOrgId,
  } = useRoleContext();

  const [participantName, setParticipantName] = useState("");
  const [participantEmail, setParticipantEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ManagedParticipant[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const participantNameId = useId();
  const participantEmailId = useId();

  async function refreshParticipants(orgId: string | null) {
    if (!orgId) {
      setParticipants([]);
      return;
    }
    const rows = await listParticipantsForOrg(orgId);
    setParticipants(rows);
  }

  useEffect(() => {
    void refreshParticipants(activeOrgId).catch((e: unknown) => {
      setErr(toMessage(e, "Failed to load participants."));
    });
  }, [activeOrgId]);

  useAutoRefresh(
    async () => {
      await refreshParticipants(activeOrgId);
    },
    { enabled: !loading && canFacilitate && !!activeOrgId, intervalMs: 30000 }
  );

  function requestDeactivateParticipant(participant: ManagedParticipant) {
    setPendingConfirm({
      title: "Deactivate participant?",
      description: `This deactivates "${participant.display_name}" and prevents them from using this managed participant account.`,
      confirmLabel: "Deactivate participant",
      tone: "destructive",
      onConfirm: () => deactivateParticipantNow(participant.id),
    });
  }

  async function deactivateParticipantNow(participantId: string) {
    try {
      setBusyKey(`participant:deactivate:${participantId}`);
      await deactivateManagedParticipant(participantId);
      await refreshParticipants(activeOrgId);
      setMsg("Participant deactivated.");
      setErr(null);
    } catch (e: unknown) {
      setErr(toMessage(e, "Failed to deactivate participant."));
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  if (!canFacilitate) {
    return (
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Facilitator · Workspace</h1>
      </div>

      {msg ? (
        <div role="status" aria-live="polite" className="notice notice-success">
          {msg}
        </div>
      ) : null}

      {err ? (
        <div role="alert" aria-live="assertive" className="notice notice-error">
          {err}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Organization context</span>
            <HintTooltip text="Choose which organization your scenario, session, and participant work should apply to." />
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <select
            value={activeOrgId ?? ""}
            onChange={(e) => setActiveOrgId(e.target.value || null)}
            className="h-10 w-full max-w-xl rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 text-sm"
          >
            <option value="">Choose organization</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>

          <div className="text-sm text-muted-foreground">
            Active workspace: <b>{activeOrg?.name ?? "none"}</b>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Participant roster</span>
            <HintTooltip
              text={`Create, copy join codes for, or deactivate participants in ${activeOrg?.name ?? "the selected organization"}.`}
            />
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {!activeOrgId ? (
            <div className="ui-empty-state">Select an organization first.</div>
          ) : (
            <>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <label htmlFor={participantNameId} className="ui-form-label">Participant display name</label>
                  <Input
                    id={participantNameId}
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    placeholder="Participant display name"
                  />
                </div>
                <div>
                  <label htmlFor={participantEmailId} className="ui-form-label">Email</label>
                  <Input
                    id={participantEmailId}
                    value={participantEmail}
                    onChange={(e) => setParticipantEmail(e.target.value)}
                    placeholder="Email (optional)"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busyKey !== null}
                  onClick={() => {
                    setErr(null);
                    setMsg(null);
                    void (async () => {
                      try {
                        setBusyKey("participant:add");
                        const p = await addManagedParticipant({
                          orgId: activeOrgId,
                          displayName: participantName,
                          email: participantEmail,
                        });
                        setParticipantName("");
                        setParticipantEmail("");
                        await refreshParticipants(activeOrgId);
                        setMsg(`Participant created. Join code: ${p.join_code}`);
                      } catch (e: unknown) {
                        setErr(toMessage(e, "Failed to create participant."));
                      } finally {
                        setBusyKey(null);
                      }
                    })();
                  }}
                >
                  {busyKey === "participant:add" ? "Adding…" : "Add participant"}
                </Button>

              </div>

              {participants.length === 0 ? (
                <div className="ui-empty-state">No participants created yet.</div>
              ) : (
                <div className="space-y-2">
                  {participants.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--studio-border)] px-3 py-2"
                    >
                      <div>
                        <div className="font-medium">{p.display_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.email ?? "no email"} · join code: <b>{p.join_code}</b>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busyKey !== null}
                          onClick={async () => {
                            const ok = await copyTextToClipboard(p.join_code);
                            if (ok) {
                              setMsg("Join code copied.");
                              setErr(null);
                              return;
                            }
                            setErr("Clipboard unavailable. Copy code manually.");
                          }}
                        >
                          Copy code
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => requestDeactivateParticipant(p)}
                          disabled={busyKey !== null}
                        >
                          {busyKey === `participant:deactivate:${p.id}` ? "…" : "Deactivate"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

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
