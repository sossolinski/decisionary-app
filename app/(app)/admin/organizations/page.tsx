"use client";

import { useEffect, useState } from "react";
import {
  addManagedParticipant,
  addMembership,
  createFacilitatorInvite,
  createOrganization,
  deleteOrganization,
  deactivateManagedParticipant,
  listInvitesForOrg,
  listMembershipsForOrg,
  listParticipantsForOrg,
  removeMembership,
  revokeFacilitatorInvite,
  type FacilitatorInvite,
  type ManagedParticipant,
  type OrganizationMembership,
} from "@/lib/organizations";
import { useRoleContext } from "@/app/components/useRoleContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { copyTextToClipboard } from "@/lib/clientClipboard";
import { Building2, Sparkles, UserPlus, Users, MailPlus, Trash2 } from "lucide-react";

type NoticeTone = "ok" | "err";

function toneClass(tone: NoticeTone) {
  if (tone === "ok") return "notice notice-success";
  return "notice notice-error";
}

function toMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function AdminOrganizationsPage() {
  const {
    loading,
    isPermAdmin,
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
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
  const [invites, setInvites] = useState<FacilitatorInvite[]>([]);
  const [participants, setParticipants] = useState<ManagedParticipant[]>([]);

  async function refreshOrgDetails(orgId: string | null) {
    if (!orgId) {
      setMemberships([]);
      setInvites([]);
      setParticipants([]);
      return;
    }

    const [nextMemberships, nextInvites, nextParticipants] = await Promise.all([
      listMembershipsForOrg(orgId),
      listInvitesForOrg(orgId),
      listParticipantsForOrg(orgId),
    ]);

    setMemberships(nextMemberships);
    setInvites(nextInvites);
    setParticipants(nextParticipants);
  }

  function pushNotice(tone: NoticeTone, text: string) {
    setNotice({ tone, text });
  }

  async function copyOrWarn(value: string, okMessage: string) {
    const ok = await copyTextToClipboard(value);
    if (ok) pushNotice("ok", okMessage);
    else pushNotice("err", "Clipboard unavailable. Copy manually.");
  }

  useEffect(() => {
    void refreshOrgDetails(activeOrgId).catch((err) => {
      pushNotice("err", toMessage(err, "Failed to load organization details."));
    });
  }, [activeOrgId]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  if (!isPermAdmin) {
    return (
      <div>
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
    <div className="space-y-5">
      <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden">
        <div className="relative px-5 py-5 md:px-6 md:py-6">
          <div className="pointer-events-none absolute right-0 top-0 h-28 w-52 rounded-bl-[28px] bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_62%)]" />
          <div className="relative grid gap-5 lg:grid-cols-[1.3fr_0.9fr] lg:items-start">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--studio-border)] bg-background/80 px-3 py-1 text-xs font-semibold text-[color:var(--studio-muted)]">
                <Sparkles className="h-3.5 w-3.5" />
                Admin workspace
              </div>

              <div className="space-y-2">
                <h1 className="text-[28px] font-semibold tracking-tight">Manage organizations without losing track of the people inside them.</h1>
                <p className="max-w-[62ch] text-sm leading-7 text-[color:var(--studio-muted)]">
                  Control organization context, create facilitator access paths, and maintain the participant roster from one operational view.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    reloadOrganizations();
                    pushNotice("ok", "Organization context refreshed.");
                  }}
                >
                  Refresh
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <div className="surface2 rounded-[16px] px-4 py-4 shadow-soft">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--studio-muted2)]">Organizations</div>
                <div className="mt-2 text-3xl font-semibold">{organizations.length}</div>
              </div>
              <div className="surface2 rounded-[16px] px-4 py-4 shadow-soft">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--studio-muted2)]">Members</div>
                <div className="mt-2 text-3xl font-semibold">{memberships.length}</div>
              </div>
              <div className="surface2 rounded-[16px] px-4 py-4 shadow-soft">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--studio-muted2)]">Participants</div>
                <div className="mt-2 text-3xl font-semibold">{participants.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {notice ? (
        <div className={toneClass(notice.tone)}>
          {notice.text}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 opacity-80" />
              Organizations
            </CardTitle>
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
                disabled={busyKey !== null}
                  onClick={() => {
                    try {
                      setBusyKey("org:create");
                      void (async () => {
                        try {
                          const org = await createOrganization({
                            name: orgName,
                          });
                          setOrgName("");
                          reloadOrganizations();
                          setActiveOrgId(org.id);
                          pushNotice("ok", `Organization "${org.name}" created.`);
                        } catch (err: unknown) {
                          pushNotice("err", toMessage(err, "Failed to create organization."));
                        } finally {
                          setBusyKey(null);
                        }
                      })();
                    } catch (err: unknown) {
                      setBusyKey(null);
                      pushNotice("err", toMessage(err, "Failed to create organization."));
                    }
                }}
              >
                {busyKey === "org:create" ? "Creating…" : "Create organization"}
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
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold">Organization controls</div>
                    <div className="mt-1 text-xs text-[color:var(--studio-muted2)]">
                      Manage the active organization and remove it if it is no longer needed.
                    </div>
                  </div>

                  <Button
                    variant="destructive"
                    className="gap-2"
                    disabled={busyKey !== null}
                    onClick={() => {
                      if (!activeOrgId || !activeOrg) return;
                      if (
                        !confirm(
                          `Delete organization "${activeOrg.name}"? This will remove its memberships, invites, and managed participants from Decisionary.`
                        )
                      ) {
                        return;
                      }

                      try {
                        setBusyKey("org:delete");
                        void (async () => {
                          try {
                            const deletedOrgId = activeOrgId;
                            const deletedOrgName = activeOrg.name;
                            await deleteOrganization(deletedOrgId);
                            reloadOrganizations();

                            const nextOrgId =
                              organizations.find((org) => org.id !== deletedOrgId)?.id ?? null;
                            setActiveOrgId(nextOrgId);
                            await refreshOrgDetails(nextOrgId);

                            pushNotice("ok", `Organization "${deletedOrgName}" deleted.`);
                          } catch (err: unknown) {
                            pushNotice("err", toMessage(err, "Failed to delete organization."));
                          } finally {
                            setBusyKey(null);
                          }
                        })();
                      } catch (err: unknown) {
                        setBusyKey(null);
                        pushNotice("err", toMessage(err, "Failed to delete organization."));
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    {busyKey === "org:delete" ? "Deleting…" : "Delete organization"}
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="panel-subtle space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <MailPlus className="h-4 w-4 opacity-80" />
                      Invite facilitator (link)
                    </div>
                    <Input
                      value={facilitatorEmail}
                      onChange={(e) => setFacilitatorEmail(e.target.value)}
                      placeholder="facilitator@client.com"
                    />
                    <Button
                      className="w-full"
                      disabled={busyKey !== null}
                      onClick={async () => {
                        try {
                          setBusyKey("invite:create");
                          const invite = await createFacilitatorInvite({
                            orgId: activeOrgId,
                            email: facilitatorEmail,
                          });
                          setFacilitatorEmail("");
                          await refreshOrgDetails(activeOrgId);

                          const link = `${registrationBase}/register/facilitator?token=${invite.token}`;
                          await copyOrWarn(link, "Invite created. Registration link copied.");
                        } catch (err: unknown) {
                          pushNotice("err", toMessage(err, "Failed to create facilitator invite."));
                        } finally {
                          setBusyKey(null);
                        }
                      }}
                    >
                      {busyKey === "invite:create" ? "Generating…" : "Generate invite link"}
                    </Button>
                  </div>

                  <div className="panel-subtle space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <UserPlus className="h-4 w-4 opacity-80" />
                      Attach member by email
                    </div>
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
                      disabled={busyKey !== null}
                      onClick={async () => {
                        try {
                          setBusyKey("membership:add");
                          await addMembership({
                            orgId: activeOrgId,
                            role: membershipRole,
                            email: membershipEmail,
                          });
                          setMembershipEmail("");
                          await refreshOrgDetails(activeOrgId);
                          pushNotice("ok", "Membership added.");
                        } catch (err: unknown) {
                          pushNotice("err", toMessage(err, "Failed to add membership."));
                        } finally {
                          setBusyKey(null);
                        }
                      }}
                    >
                      {busyKey === "membership:add" ? "Adding…" : "Add membership"}
                    </Button>
                  </div>
                </div>

                <div className="panel-subtle space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Users className="h-4 w-4 opacity-80" />
                    Create participant (simplified)
                  </div>
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
                    disabled={busyKey !== null}
                    onClick={async () => {
                      try {
                        setBusyKey("participant:add");
                        const p = await addManagedParticipant({
                          orgId: activeOrgId,
                          displayName: participantName,
                          email: participantEmail,
                        });
                        setParticipantName("");
                        setParticipantEmail("");
                        await refreshOrgDetails(activeOrgId);
                        pushNotice("ok", `Participant created. Join code: ${p.join_code}`);
                      } catch (err: unknown) {
                        pushNotice("err", toMessage(err, "Failed to create participant."));
                      } finally {
                        setBusyKey(null);
                      }
                    }}
                  >
                    {busyKey === "participant:add" ? "Creating…" : "Add participant"}
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
                              if (!confirm("Remove this membership?")) return;
                              void (async () => {
                                try {
                                  await removeMembership(m.id);
                                  await refreshOrgDetails(activeOrgId);
                                  pushNotice("ok", "Membership removed.");
                                } catch (err: unknown) {
                                  pushNotice("err", toMessage(err, "Failed to remove membership."));
                                }
                              })();
                            }}
                            disabled={busyKey !== null}
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
                            className="panel-subtle space-y-2"
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
                                  disabled={busyKey !== null}
                                  onClick={async () => {
                                    await copyOrWarn(link, "Registration link copied.");
                                  }}
                                >
                                  Copy link
                                </Button>
                                {inv.status === "pending" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      if (!confirm("Revoke this invite?")) return;
                                      void (async () => {
                                        try {
                                          await revokeFacilitatorInvite(inv.id);
                                          await refreshOrgDetails(activeOrgId);
                                          pushNotice("ok", "Invite revoked.");
                                        } catch (err: unknown) {
                                          pushNotice("err", toMessage(err, "Failed to revoke invite."));
                                        }
                                      })();
                                    }}
                                    disabled={busyKey !== null}
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
                              if (!confirm("Deactivate this participant account?")) return;
                              void (async () => {
                                try {
                                  await deactivateManagedParticipant(p.id);
                                  await refreshOrgDetails(activeOrgId);
                                  pushNotice("ok", "Participant deactivated.");
                                } catch (err: unknown) {
                                  pushNotice("err", toMessage(err, "Failed to deactivate participant."));
                                }
                              })();
                            }}
                            disabled={busyKey !== null}
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
