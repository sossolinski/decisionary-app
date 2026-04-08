"use client";

import { useState } from "react";
import {
  addManagedParticipant,
  addMembership,
  createFacilitatorInvite,
  createOrganization,
  deactivateManagedParticipant,
  listInvitesForOrg,
  listMembershipsForOrg,
  listParticipantsForOrg,
  removeMembership,
  revokeFacilitatorInvite,
} from "@/lib/organizationsMvp";
import { useRoleContext } from "@/app/components/useRoleContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

type NoticeTone = "ok" | "err";

function toneClass(tone: NoticeTone) {
  if (tone === "ok") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  return "border-destructive/40 bg-destructive/10 text-destructive";
}

function toMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function AdminOrganizationsPage() {
  const {
    loading,
    isPermAdmin,
    userId,
    email,
    organizations,
    activeOrg,
    activeOrgId,
    setActiveOrgId,
    reloadOrganizations,
  } = useRoleContext();

  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);

  const [orgName, setOrgName] = useState("");
  const [facilitatorEmail, setFacilitatorEmail] = useState("");
  const [membershipEmail, setMembershipEmail] = useState("");
  const [membershipRole, setMembershipRole] = useState<"facilitator" | "participant">("facilitator");
  const [participantName, setParticipantName] = useState("");
  const [participantEmail, setParticipantEmail] = useState("");

  const memberships = activeOrgId ? listMembershipsForOrg(activeOrgId) : [];
  const invites = activeOrgId ? listInvitesForOrg(activeOrgId) : [];
  const participants = activeOrgId ? listParticipantsForOrg(activeOrgId) : [];

  function pushNotice(tone: NoticeTone, text: string) {
    setNotice({ tone, text });
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!isPermAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>Only permanent admin can manage organizations.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const registrationBase = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Admin · Organizations</h1>
          <p className="text-sm text-muted-foreground">
            Zarządzanie klientami, facilitatorami i participantami (MVP local store, bez SQL).
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={() => {
            reloadOrganizations();
            pushNotice("ok", "Organization context refreshed.");
          }}
        >
          Refresh
        </Button>
      </div>

      {notice ? (
        <div className={`rounded-[var(--radius)] border px-3 py-2 text-sm ${toneClass(notice.tone)}`}>
          {notice.text}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Organizations</CardTitle>
            <CardDescription>{organizations.length} active organizations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {organizations.map((org) => {
                const active = org.id === activeOrgId;
                return (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => setActiveOrgId(org.id)}
                    className={[
                      "w-full rounded-[var(--radius)] border px-3 py-2 text-left transition",
                      active
                        ? "border-primary/40 bg-primary/10"
                        : "border-[var(--studio-border)] bg-[var(--studio-surface2)] hover:bg-secondary/70",
                    ].join(" ")}
                  >
                    <div className="font-medium truncate">{org.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{org.slug}</div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2 border-t border-[var(--studio-border)] pt-3">
              <div className="text-sm font-semibold">New organization</div>
              <Input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Organization name"
              />
              <Button
                className="w-full"
                onClick={() => {
                  try {
                    const org = createOrganization({
                      name: orgName,
                      createdByUserId: userId,
                      createdByEmail: email,
                    });
                    setOrgName("");
                    reloadOrganizations();
                    setActiveOrgId(org.id);
                    pushNotice("ok", `Organization \"${org.name}\" created.`);
                  } catch (err: unknown) {
                    pushNotice("err", toMessage(err, "Failed to create organization."));
                  }
                }}
              >
                Create organization
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{activeOrg?.name ?? "Select organization"}</CardTitle>
            <CardDescription>
              {activeOrg ? `Slug: ${activeOrg.slug}` : "Choose org from the list to manage memberships."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {!activeOrgId ? (
              <div className="text-sm text-muted-foreground">No organization selected.</div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded-[var(--radius)] border border-[var(--studio-border)] p-3">
                    <div className="text-sm font-semibold">Invite facilitator (link)</div>
                    <Input
                      value={facilitatorEmail}
                      onChange={(e) => setFacilitatorEmail(e.target.value)}
                      placeholder="facilitator@client.com"
                    />
                    <Button
                      className="w-full"
                      onClick={() => {
                        try {
                          const invite = createFacilitatorInvite({
                            orgId: activeOrgId,
                            email: facilitatorEmail,
                            createdBy: userId,
                          });
                          setFacilitatorEmail("");
                          reloadOrganizations();

                          const link = `${registrationBase}/register/facilitator?token=${invite.token}`;
                          void navigator.clipboard.writeText(link);
                          pushNotice("ok", "Invite created. Registration link copied to clipboard.");
                        } catch (err: unknown) {
                          pushNotice("err", toMessage(err, "Failed to create facilitator invite."));
                        }
                      }}
                    >
                      Generate invite link
                    </Button>
                  </div>

                  <div className="space-y-2 rounded-[var(--radius)] border border-[var(--studio-border)] p-3">
                    <div className="text-sm font-semibold">Attach member by email</div>
                    <Input
                      value={membershipEmail}
                      onChange={(e) => setMembershipEmail(e.target.value)}
                      placeholder="member@client.com"
                    />
                    <select
                      value={membershipRole}
                      onChange={(e) =>
                        setMembershipRole(
                          e.target.value === "participant" ? "participant" : "facilitator"
                        )
                      }
                      className="h-10 w-full rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 text-sm"
                    >
                      <option value="facilitator">Facilitator</option>
                      <option value="participant">Participant</option>
                    </select>
                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={() => {
                        try {
                          addMembership({
                            orgId: activeOrgId,
                            role: membershipRole,
                            email: membershipEmail,
                            createdBy: userId,
                          });
                          setMembershipEmail("");
                          reloadOrganizations();
                          pushNotice("ok", "Membership added.");
                        } catch (err: unknown) {
                          pushNotice("err", toMessage(err, "Failed to add membership."));
                        }
                      }}
                    >
                      Add membership
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 rounded-[var(--radius)] border border-[var(--studio-border)] p-3">
                  <div className="text-sm font-semibold">Create participant (simplified)</div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input
                      value={participantName}
                      onChange={(e) => setParticipantName(e.target.value)}
                      placeholder="Display name"
                    />
                    <Input
                      value={participantEmail}
                      onChange={(e) => setParticipantEmail(e.target.value)}
                      placeholder="Email (optional)"
                    />
                  </div>
                  <Button
                    className="w-full md:w-auto"
                    variant="secondary"
                    onClick={() => {
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
                        pushNotice("ok", `Participant created. Join code: ${p.join_code}`);
                      } catch (err: unknown) {
                        pushNotice("err", toMessage(err, "Failed to create participant."));
                      }
                    }}
                  >
                    Add participant
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold">Members</div>
                  {memberships.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No memberships yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {memberships.map((m) => (
                        <div
                          key={m.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--studio-border)] px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="font-medium">{m.email ?? m.user_id ?? "Unknown"}</div>
                            <div className="text-xs text-muted-foreground">role: {m.role}</div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              removeMembership(m.id);
                              reloadOrganizations();
                              pushNotice("ok", "Membership removed.");
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold">Facilitator invites</div>
                  {invites.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No invites for this organization.</div>
                  ) : (
                    <div className="space-y-2">
                      {invites.map((inv) => {
                        const link = `${registrationBase}/register/facilitator?token=${inv.token}`;
                        return (
                          <div
                            key={inv.id}
                            className="rounded-[var(--radius)] border border-[var(--studio-border)] p-3 space-y-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="font-medium">{inv.email}</div>
                                <div className="text-xs text-muted-foreground">
                                  status: {inv.status} · expires: {new Date(inv.expires_at).toLocaleString()}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    void navigator.clipboard.writeText(link);
                                    pushNotice("ok", "Registration link copied.");
                                  }}
                                >
                                  Copy link
                                </Button>
                                {inv.status === "pending" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      revokeFacilitatorInvite(inv.id);
                                      reloadOrganizations();
                                      pushNotice("ok", "Invite revoked.");
                                    }}
                                  >
                                    Revoke
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold">Managed participants</div>
                  {participants.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No participants yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {participants.map((p) => (
                        <div
                          key={p.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--studio-border)] px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">{p.display_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.email ?? "no email"} · join code: <b>{p.join_code}</b>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              deactivateManagedParticipant(p.id);
                              reloadOrganizations();
                              pushNotice("ok", "Participant deactivated.");
                            }}
                          >
                            Deactivate
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
