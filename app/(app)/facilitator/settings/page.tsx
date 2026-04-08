"use client";

import { useEffect, useState } from "react";
import {
  addManagedParticipant,
  deactivateManagedParticipant,
  listParticipantsForOrg,
  type ManagedParticipant,
} from "@/lib/organizations";
import { useRoleContext } from "@/app/components/useRoleContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { copyTextToClipboard } from "@/lib/clientClipboard";

function toMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function FacilitatorSettingsPage() {
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

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  if (!canFacilitate) {
    return (
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>Only facilitator/admin can access this view.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Facilitator · Settings</h1>
        <p className="text-sm text-muted-foreground">
          Active organization, participant roster, and session administration actions.
        </p>
      </div>

      {msg ? (
        <div className="notice notice-success">
          {msg}
        </div>
      ) : null}

      {err ? (
        <div className="notice notice-error">
          {err}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Organization context</CardTitle>
          <CardDescription>Select organization for scenario/session work.</CardDescription>
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
            Active: <b>{activeOrg?.name ?? "none"}</b>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participants</CardTitle>
          <CardDescription>
            Create or deactivate participants in current organization ({activeOrg?.name ?? "no org"}).
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!activeOrgId ? (
            <div className="text-sm text-muted-foreground">Select organization first.</div>
          ) : (
            <>
              <div className="grid gap-2 md:grid-cols-2">
                <Input
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Participant display name"
                />
                <Input
                  value={participantEmail}
                  onChange={(e) => setParticipantEmail(e.target.value)}
                  placeholder="Email (optional)"
                />
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

                <Button
                  variant="secondary"
                  disabled={busyKey !== null}
                  onClick={() => {
                    void (async () => {
                      try {
                        await refreshParticipants(activeOrgId);
                        setMsg("Participants refreshed.");
                        setErr(null);
                      } catch (e: unknown) {
                        setErr(toMessage(e, "Failed to refresh participants."));
                      }
                    })();
                  }}
                >
                  Refresh
                </Button>
              </div>

              {participants.length === 0 ? (
                <div className="text-sm text-muted-foreground">No participants created yet.</div>
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
                          onClick={() => {
                            if (!confirm("Deactivate this participant account?")) return;
                            void (async () => {
                              try {
                                await deactivateManagedParticipant(p.id);
                                await refreshParticipants(activeOrgId);
                                setMsg("Participant deactivated.");
                                setErr(null);
                              } catch (e: unknown) {
                                setErr(toMessage(e, "Failed to deactivate participant."));
                              }
                            })();
                          }}
                          disabled={busyKey !== null}
                        >
                          Deactivate
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
    </div>
  );
}
