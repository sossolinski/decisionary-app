"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  addManagedParticipant,
  addMembership,
  archiveOrganization,
  createFacilitatorInvite,
  createOrganization,
  deleteOrganization,
  deactivateManagedParticipant,
  listInvitesForOrg,
  listMembershipsForOrg,
  listNotificationAnnouncements,
  listParticipantsForOrg,
  listAllOrganizationsForAdmin,
  removeMembership,
  restoreOrganization,
  revokeFacilitatorInvite,
  type FacilitatorInvite,
  type ManagedParticipant,
  type NotificationAnnouncement,
  type Organization,
  type OrganizationMembership,
} from "@/lib/organizations";
import { useRoleContext } from "@/app/components/useRoleContext";
import useAutoRefresh from "@/app/components/useAutoRefresh";
import HintTooltip from "@/app/components/HintTooltip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { copyTextToClipboard } from "@/lib/clientClipboard";
import { getErrorMessage } from "@/lib/errors";
import { Archive, Building2, MailPlus, RotateCcw, Sparkles, Trash2, UserPlus, Users } from "lucide-react";

type NoticeTone = "ok" | "err";

function toneClass(tone: NoticeTone) {
  if (tone === "ok") return "notice notice-success";
  return "notice notice-error";
}

function toMessage(err: unknown, fallback: string) {
  return getErrorMessage(err, fallback);
}

function shortId(value?: string | null, prefix = "ID") {
  const trimmed = value?.trim();
  if (!trimmed) return `${prefix} unknown`;
  return `${prefix} ${trimmed.slice(0, 8)}`;
}

function membershipLabel(membership: OrganizationMembership) {
  if (membership.email?.trim()) return membership.email;
  return shortId(membership.user_id, "User");
}

function compactIdentity(value: string) {
  return value.trim().replaceAll("@", "@\u200b");
}

export default function AdminOrganizationsPage() {
  const {
    loading,
    isPermAdmin,
    organizations,
    activeOrg,
    activeOrgId,
    setActiveOrgId,
    refresh,
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
  const [announcements, setAnnouncements] = useState<NotificationAnnouncement[]>([]);
  const [archivedOrganizations, setArchivedOrganizations] = useState<Organization[]>([]);
  const [workspaceView, setWorkspaceView] = useState<"people" | "access">("people");
  const orgNameId = useId();
  const facilitatorEmailId = useId();
  const membershipEmailId = useId();
  const membershipRoleId = useId();
  const participantNameId = useId();
  const participantEmailId = useId();
  const canArchiveActiveOrg = organizations.length > 1;
  const latestActivityLabel = useMemo(() => {
    const timestamps = [
      activeOrg?.created_at ?? null,
      ...memberships.map((item) => item.created_at),
      ...invites.map((item) => item.accepted_at ?? item.created_at),
      ...participants.map((item) => item.created_at),
      ...announcements.map((item) => item.updated_at ?? item.published_at),
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter((value) => Number.isFinite(value));

    if (timestamps.length === 0) return "No activity yet";
    return new Date(Math.max(...timestamps)).toLocaleString();
  }, [activeOrg?.created_at, announcements, invites, memberships, participants]);

  async function refreshOrgDetails(orgId: string | null) {
    if (!orgId) {
      setMemberships([]);
      setInvites([]);
      setParticipants([]);
      setAnnouncements([]);
      return;
    }

    const [membershipsResult, invitesResult, participantsResult, announcementsResult] = await Promise.allSettled([
      listMembershipsForOrg(orgId),
      listInvitesForOrg(orgId),
      listParticipantsForOrg(orgId),
      listNotificationAnnouncements(orgId),
    ]);

    const failures: string[] = [];

    if (membershipsResult.status === "fulfilled") {
      setMemberships(membershipsResult.value);
    } else {
      setMemberships([]);
      failures.push("members");
    }

    if (invitesResult.status === "fulfilled") {
      setInvites(invitesResult.value);
    } else {
      setInvites([]);
      failures.push("facilitator invites");
    }

    if (participantsResult.status === "fulfilled") {
      setParticipants(participantsResult.value);
    } else {
      setParticipants([]);
      failures.push("participants");
    }

    if (announcementsResult.status === "fulfilled") {
      setAnnouncements(announcementsResult.value);
    } else {
      setAnnouncements([]);
      pushNotice("err", toMessage(announcementsResult.reason, "Failed to load announcements."));
    }

    if (failures.length > 0) {
      const message =
        failures.length === 3
          ? "Failed to load members, facilitator invites, and participants."
          : `Failed to load ${failures.join(" and ")}.`;
      throw new Error(message);
    }
  }

  async function refreshAdminState(orgId: string | null) {
    const [allOrganizationsResult, detailsResult] = await Promise.allSettled([
      listAllOrganizationsForAdmin(),
      refreshOrgDetails(orgId),
    ]);

    if (allOrganizationsResult.status === "fulfilled") {
      setArchivedOrganizations(allOrganizationsResult.value.filter((org) => org.archived));
    } else {
      setArchivedOrganizations([]);
      pushNotice("err", toMessage(allOrganizationsResult.reason, "Failed to load archived organizations."));
    }

    if (detailsResult.status === "rejected") {
      throw detailsResult.reason;
    }
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
    void refreshAdminState(activeOrgId).catch((err) => {
      pushNotice("err", toMessage(err, "Failed to load organization details."));
    });
  }, [activeOrgId]);

  useAutoRefresh(
    async () => {
      await refresh();
      await refreshAdminState(activeOrgId);
    },
    { enabled: isPermAdmin, intervalMs: 30000 }
  );

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  if (!isPermAdmin) {
    return (
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>This page is available only to workspace admins.</CardDescription>
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
              <div className="ui-eyebrow">
                <Sparkles className="h-3.5 w-3.5" />
                Admin workspace
              </div>

              <div className="space-y-2">
                <h1 className="text-[28px] font-semibold tracking-tight">Manage organizations without losing track of the people inside them.</h1>
                <p className="max-w-[62ch] text-sm leading-7 text-[color:var(--studio-muted)]">
                  Keep organization context tidy, invite facilitators, and look after the participant roster from one place.
                </p>
              </div>

            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <div className="ui-metric-card">
                <div className="ui-metric-label">Active orgs</div>
                <div className="mt-2 text-3xl font-semibold">{organizations.length}</div>
              </div>
              <div className="ui-metric-card">
                <div className="ui-metric-label">Archived</div>
                <div className="mt-2 text-3xl font-semibold">{archivedOrganizations.length}</div>
              </div>
              <div className="ui-metric-card">
                <div className="ui-metric-label">Participants</div>
                <div className="mt-2 text-3xl font-semibold">{participants.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {notice ? (
        <div
          role={notice.tone === "err" ? "alert" : "status"}
          aria-live={notice.tone === "err" ? "assertive" : "polite"}
          className={toneClass(notice.tone)}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 opacity-80" />
              Organization directory
            </CardTitle>
            <CardDescription>
              Switch the active organization here, create a new one, and restore archived workspaces when needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="ui-section-label">Active organizations</div>
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
              <label htmlFor={orgNameId} className="ui-form-label">Organization name</label>
              <Input
                id={orgNameId}
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
                          await refresh();
                          setActiveOrgId(org.id);
                          await refreshAdminState(org.id);
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

            <div className="space-y-2 border-t border-[var(--studio-border)] pt-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                Archived organizations
                <HintTooltip
                  text="Archive is the default off-ramp for organizations that should leave active workflows but stay restorable."
                  side="right"
                />
              </div>

              {archivedOrganizations.length === 0 ? (
                <div className="ui-empty-state">No archived organizations yet.</div>
              ) : (
                <div className="space-y-2">
                  {archivedOrganizations.map((org) => (
                    <div
                      key={org.id}
                      className="rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 py-3"
                    >
                      <div className="space-y-2">
                        <div>
                          <div className="font-medium truncate">{org.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{org.slug}</div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busyKey !== null}
                            onClick={() => {
                              void (async () => {
                                try {
                                  setBusyKey(`org:restore:${org.id}`);
                                  const restored = await restoreOrganization(org.id);
                                  await refresh();
                                  setActiveOrgId(restored.id);
                                  await refreshAdminState(restored.id);
                                  pushNotice("ok", `Organization "${restored.name}" restored.`);
                                } catch (err: unknown) {
                                  pushNotice("err", toMessage(err, "Failed to restore organization."));
                                } finally {
                                  setBusyKey(null);
                                }
                              })();
                            }}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Restore
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyKey !== null}
                            onClick={() => {
                              if (
                                !confirm(
                                  `Delete "${org.name}" permanently? This cannot be undone and removes its remaining memberships, invites, participants, and announcements.`
                                )
                              ) {
                                return;
                              }

                              void (async () => {
                                try {
                                  setBusyKey(`org:delete:${org.id}`);
                                  await deleteOrganization(org.id);
                                  await refresh();
                                  await refreshAdminState(activeOrgId);
                                  pushNotice("ok", `Organization "${org.name}" deleted permanently.`);
                                } catch (err: unknown) {
                                  pushNotice("err", toMessage(err, "Failed to delete organization permanently."));
                                } finally {
                                  setBusyKey(null);
                                }
                              })();
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete permanently
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{activeOrg?.name ?? "Select organization"}</CardTitle>
            <CardDescription>
              {activeOrg ? `Selected workspace · ${activeOrg.slug}` : "Choose org from the list to manage memberships."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {!activeOrgId ? (
              <div className="text-sm text-muted-foreground">No organization selected.</div>
            ) : (
              <>
                <div className="grid gap-3 rounded-[16px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-4 md:grid-cols-4">
                  <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 py-3">
                    <div className="ui-metric-label">Members</div>
                    <div className="mt-2 text-2xl font-semibold">{memberships.length}</div>
                  </div>
                  <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 py-3">
                    <div className="ui-metric-label">Invites</div>
                    <div className="mt-2 text-2xl font-semibold">{invites.length}</div>
                  </div>
                  <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 py-3">
                    <div className="ui-metric-label">Participants</div>
                    <div className="mt-2 text-2xl font-semibold">{participants.length}</div>
                  </div>
                  <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 py-3">
                    <div className="ui-metric-label">Announcements</div>
                    <div className="mt-2 text-2xl font-semibold">{announcements.length}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      Workspace controls
                      <HintTooltip
                        text="Manage the selected organization, its access paths, participant roster, and workspace announcements."
                        side="right"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                    {[
                      { key: "people", label: `People (${memberships.length + participants.length})` },
                      { key: "access", label: "Access & onboarding" },
                    ].map((item) => (
                      <Button
                        key={item.key}
                        type="button"
                        variant={workspaceView === item.key ? "default" : "outline"}
                        size="sm"
                        onClick={() => setWorkspaceView(item.key as "people" | "access")}
                        aria-pressed={workspaceView === item.key}
                        className="rounded-full"
                      >
                        {item.label}
                      </Button>
                    ))}
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-[16px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-4 md:grid-cols-3">
                    <div>
                      <div className="ui-metric-label">Latest activity</div>
                      <div className="mt-2 text-sm font-medium">{latestActivityLabel}</div>
                    </div>
                    <div>
                      <div className="ui-metric-label">Announcement scope</div>
                      <div className="mt-2 text-sm font-medium">
                        {announcements.length} active {announcements.length === 1 ? "notice" : "notices"}
                      </div>
                    </div>
                    <div className="flex items-center md:justify-end">
                      <Button asChild variant="secondary" className="w-full md:w-auto">
                        <Link href="/admin/announcements">Open announcements</Link>
                      </Button>
                    </div>
                  </div>
                </div>

                {workspaceView === "access" ? (
                  <>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      Access and onboarding
                      <HintTooltip
                        text="Invite facilitators, attach members, and create participant accounts for the selected organization."
                        side="right"
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="panel-subtle space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <MailPlus className="h-4 w-4 opacity-80" />
                          Invite facilitator (link)
                        </div>
                        <div>
                          <label htmlFor={facilitatorEmailId} className="ui-form-label">Facilitator email</label>
                          <Input
                            id={facilitatorEmailId}
                            value={facilitatorEmail}
                            onChange={(e) => setFacilitatorEmail(e.target.value)}
                            placeholder="facilitator@client.com"
                          />
                        </div>
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

                      <div className="panel-subtle space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <UserPlus className="h-4 w-4 opacity-80" />
                          Attach member by email
                        </div>
                        <div>
                          <label htmlFor={membershipEmailId} className="ui-form-label">Member email</label>
                          <Input
                            id={membershipEmailId}
                            value={membershipEmail}
                            onChange={(e) => setMembershipEmail(e.target.value)}
                            placeholder="member@client.com"
                          />
                        </div>
                        <div>
                          <label htmlFor={membershipRoleId} className="ui-form-label">Role</label>
                          <select
                            id={membershipRoleId}
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
                        </div>
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

                    <div className="panel-subtle space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Users className="h-4 w-4 opacity-80" />
                        Create participant (simplified)
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <div>
                          <label htmlFor={participantNameId} className="ui-form-label">Display name</label>
                          <Input
                            id={participantNameId}
                            value={participantName}
                            onChange={(e) => setParticipantName(e.target.value)}
                            placeholder="Display name"
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
                  </>
                ) : null}

                {workspaceView === "people" ? (
                  <>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      People directory
                      <HintTooltip
                        text="Review who belongs to this organization, manage invites, and keep participant accounts tidy."
                        side="right"
                      />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-3">
                    <div className="space-y-2">
                      <div className="text-sm font-semibold">Members</div>
                      {memberships.length === 0 ? (
                        <div className="ui-empty-state">No memberships yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {memberships.map((m) => (
                            <div
                              key={m.id}
                              className="rounded-[var(--radius)] border border-[var(--studio-border)] px-3 py-3"
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="break-words text-sm font-medium leading-6">
                                    {compactIdentity(membershipLabel(m))}
                                  </div>
                                  <div className="text-xs text-muted-foreground">Role: {m.role}</div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full sm:w-auto"
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
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-semibold">Facilitator invites</div>
                      {invites.length === 0 ? (
                        <div className="ui-empty-state">No invites for this organization.</div>
                      ) : (
                        <div className="space-y-2">
                          {invites.map((inv) => {
                            const link = `${registrationBase}/register/facilitator?token=${inv.token}`;
                            return (
                              <div key={inv.id} className="rounded-[var(--radius)] border border-[var(--studio-border)] px-3 py-3">
                                <div className="space-y-2">
                                  <div>
                                    <div className="break-words text-sm font-medium leading-6">{compactIdentity(inv.email)}</div>
                                    <div className="text-xs leading-5 text-muted-foreground">
                                      {inv.status} · expires {new Date(inv.expires_at).toLocaleString()}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
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
                        <div className="ui-empty-state">No participants yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {participants.map((p) => (
                            <div
                              key={p.id}
                              className="rounded-[var(--radius)] border border-[var(--studio-border)] px-3 py-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{p.display_name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {p.email ?? "no email"} · join code <b>{p.join_code}</b>
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
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    </div>
                  </>
                ) : null}

                <div className="rounded-[16px] border border-amber-500/20 bg-amber-500/5 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        Danger zone
                        <HintTooltip
                          text={
                            canArchiveActiveOrg
                              ? "Archive the organization to remove it from active workspace flows. Permanent deletion now lives in the archived list."
                              : "At least one active organization must remain in Decisionary, so archiving is unavailable until you create or restore another one."
                          }
                          side="right"
                        />
                      </div>
                      {!canArchiveActiveOrg ? (
                        <div className="mt-2 text-sm text-[color:var(--studio-muted)]">
                          Create or restore one more active organization before archiving this one.
                        </div>
                      ) : null}
                    </div>

                    <Button
                      variant="outline"
                      className="gap-2"
                      disabled={busyKey !== null || !canArchiveActiveOrg}
                      onClick={() => {
                        if (!activeOrgId || !activeOrg) return;
                        if (!canArchiveActiveOrg) {
                          pushNotice(
                            "err",
                            "Create or restore another active organization before archiving this one."
                          );
                          return;
                        }
                        if (
                          !confirm(
                            `Archive organization "${activeOrg.name}"? It will disappear from active workspace views but can still be restored later.`
                          )
                        ) {
                          return;
                        }

                        try {
                          setBusyKey("org:archive");
                          void (async () => {
                            try {
                              const archivedOrgId = activeOrgId;
                              const archivedOrgName = activeOrg.name;
                              await archiveOrganization(archivedOrgId);
                              const allOrganizations = await listAllOrganizationsForAdmin();
                              const nextOrgId =
                                allOrganizations.find((org) => !org.archived && org.id !== archivedOrgId)?.id ??
                                allOrganizations.find((org) => !org.archived)?.id ??
                                null;
                              setActiveOrgId(nextOrgId);
                              await refresh();
                              await refreshAdminState(nextOrgId);

                              pushNotice("ok", `Organization "${archivedOrgName}" archived.`);
                            } catch (err: unknown) {
                              pushNotice("err", toMessage(err, "Failed to archive organization."));
                            } finally {
                              setBusyKey(null);
                            }
                          })();
                        } catch (err: unknown) {
                          setBusyKey(null);
                          pushNotice("err", toMessage(err, "Failed to archive organization."));
                        }
                      }}
                    >
                      <Archive className="h-4 w-4" />
                      {busyKey === "org:archive" ? "Archiving…" : "Archive organization"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
