"use client";

import { useState } from "react";
import {
  addManagedParticipant,
  deactivateManagedParticipant,
  listParticipantsForOrg,
} from "@/lib/organizationsMvp";
import { useRoleContext } from "@/app/components/useRoleContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

function toMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function FacilitatorSettingsPage() {
  const {
    loading,
    canFacilitate,
    userId,
    organizations,
    activeOrg,
    activeOrgId,
    setActiveOrgId,
    reloadOrganizations,
  } = useRoleContext();

  const [participantName, setParticipantName] = useState("");
  const [participantEmail, setParticipantEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const participants = activeOrgId ? listParticipantsForOrg(activeOrgId) : [];

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!canFacilitate) {
    return (
      <div className="p-6">
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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Facilitator · Settings</h1>
        <p className="text-sm text-muted-foreground">
          Aktywna organizacja, roster participantów i operacje administracyjne dla sesji.
        </p>
      </div>

      {msg ? (
        <div className="rounded-[var(--radius)] border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
          {msg}
        </div>
      ) : null}

      {err ? (
        <div className="rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
                  onClick={() => {
                    setErr(null);
                    setMsg(null);
                    try {
                      const p = addManagedParticipant({
                        orgId: activeOrgId,
                        displayName: participantName,
                        email: participantEmail,
                        createdBy: userId,
                      });
                      setParticipantName("");
                      setParticipantEmail("");
                      reloadOrganizations();
                      setMsg(`Participant created. Join code: ${p.join_code}`);
                    } catch (e: unknown) {
                      setErr(toMessage(e, "Failed to create participant."));
                    }
                  }}
                >
                  Add participant
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => {
                    reloadOrganizations();
                    setMsg("Participants refreshed.");
                    setErr(null);
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
                          onClick={() => {
                            void navigator.clipboard.writeText(p.join_code);
                            setMsg("Join code copied.");
                            setErr(null);
                          }}
                        >
                          Copy code
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            deactivateManagedParticipant(p.id);
                            reloadOrganizations();
                            setMsg("Participant deactivated.");
                            setErr(null);
                          }}
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
