import { supabase } from "./supabaseClient";

export type OrgRole = "admin" | "facilitator" | "participant";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  created_by: string | null;
  archived: boolean;
};

export type OrganizationMembership = {
  id: string;
  org_id: string;
  user_id: string | null;
  email: string | null;
  role: OrgRole;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
};

export type FacilitatorInvite = {
  id: string;
  org_id: string;
  email: string;
  token: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  created_at: string;
  created_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  accepted_user_id: string | null;
};

export type FacilitatorInviteLookup = FacilitatorInvite & {
  org_name: string;
  org_slug: string;
};

export type ManagedParticipant = {
  id: string;
  org_id: string;
  display_name: string;
  email: string | null;
  join_code: string;
  created_at: string;
  created_by: string | null;
  active: boolean;
};

export type NotificationAnnouncementKind = "system" | "product";
export type NotificationAnnouncementAudience = "all" | "admins" | "facilitators" | "participants";
export type NotificationAnnouncementPriority = "normal" | "important";

export type NotificationAnnouncement = {
  id: string;
  org_id: string | null;
  kind: NotificationAnnouncementKind;
  audience: NotificationAnnouncementAudience;
  priority: NotificationAnnouncementPriority;
  title: string;
  body: string;
  link_path: string | null;
  published_at: string;
  expires_at: string | null;
  archived: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

function isMissingAnnouncementInfra(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const message = "message" in error && typeof error.message === "string" ? error.message.toLowerCase() : "";

  return (
    code === "PGRST202" ||
    message.includes("notification_announcements") ||
    message.includes("admin_list_notification_announcements") ||
    message.includes("admin_create_notification_announcement") ||
    message.includes("admin_archive_notification_announcement")
  );
}

export async function listOrganizationsForCurrentUser() {
  const { data, error } = await supabase.rpc("list_my_organizations");

  if (error) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw error;

    const fallback = await supabase
      .from("org_memberships")
      .select("organizations(*)")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (fallback.error) throw error;

    return (fallback.data ?? [])
      .flatMap((row) => {
        const org = row.organizations;
        if (!org) return [];
        return Array.isArray(org) ? org : [org];
      })
      .filter((org): org is Organization => !org.archived)
      .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
  }

  return (data ?? []) as Organization[];
}

export async function getMyActiveOrgId(userId: string) {
  const { data, error } = await supabase.rpc("get_my_active_org_id");

  if (error) {
    const fallback = await supabase
      .from("user_org_settings")
      .select("active_org_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (fallback.error) throw error;
    return (fallback.data?.active_org_id ?? null) as string | null;
  }

  return (data ?? null) as string | null;
}

export async function setMyActiveOrgId(orgId: string | null) {
  const { error } = await supabase.rpc("set_my_active_org", {
    p_org_id: orgId,
  });
  if (error) throw error;
}

export async function createOrganization(params: { name: string }) {
  const { data, error } = await supabase.rpc("admin_create_organization", {
    p_name: params.name,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as Organization;
}

export async function listAllOrganizationsForAdmin() {
  const { data, error } = await supabase.rpc("admin_list_all_organizations");
  if (error) throw error;
  return (data ?? []) as Organization[];
}

export async function archiveOrganization(orgId: string) {
  const { data, error } = await supabase.rpc("admin_archive_organization", {
    p_org_id: orgId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as Organization;
}

export async function restoreOrganization(orgId: string) {
  const { data, error } = await supabase.rpc("admin_restore_organization", {
    p_org_id: orgId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as Organization;
}

export async function deleteOrganization(orgId: string) {
  const { error } = await supabase.rpc("admin_delete_organization", {
    p_org_id: orgId,
  });
  if (error) throw error;
}

export async function listMembershipsForOrg(orgId: string) {
  const { data, error } = await supabase.rpc("admin_list_org_memberships", {
    p_org_id: orgId,
  });

  if (error) throw error;
  return (data ?? []) as OrganizationMembership[];
}

export async function addMembership(params: {
  orgId: string;
  role: OrgRole;
  email: string;
}) {
  const { data, error } = await supabase.rpc("admin_add_org_membership", {
    p_org_id: params.orgId,
    p_email: params.email,
    p_role: params.role,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as OrganizationMembership;
}

export async function removeMembership(membershipId: string) {
  const { error } = await supabase.rpc("admin_remove_org_membership", {
    p_membership_id: membershipId,
  });
  if (error) throw error;
}

export async function listInvitesForOrg(orgId: string) {
  const { data, error } = await supabase.rpc("admin_list_facilitator_invites", {
    p_org_id: orgId,
  });

  if (error) throw error;
  return (data ?? []) as FacilitatorInvite[];
}

export async function createFacilitatorInvite(params: {
  orgId: string;
  email: string;
  ttlDays?: number;
}) {
  const { data, error } = await supabase.rpc("admin_create_facilitator_invite", {
    p_org_id: params.orgId,
    p_email: params.email,
    p_ttl_days: params.ttlDays ?? 14,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as FacilitatorInvite;
}

export async function revokeFacilitatorInvite(inviteId: string) {
  const { error } = await supabase.rpc("admin_revoke_facilitator_invite", {
    p_invite_id: inviteId,
  });
  if (error) throw error;
}

export async function getFacilitatorInviteByToken(token: string) {
  const { data, error } = await supabase.rpc("get_facilitator_invite_by_token", {
    p_token: token,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as FacilitatorInviteLookup | null;
}

export async function acceptFacilitatorInvite(token: string) {
  const { error } = await supabase.rpc("accept_facilitator_invite", {
    p_token: token,
  });
  if (error) throw error;
}

export async function listParticipantsForOrg(orgId: string) {
  const { data, error } = await supabase.rpc("admin_list_managed_participants", {
    p_org_id: orgId,
  });

  if (error) throw error;
  return (data ?? []) as ManagedParticipant[];
}

export async function addManagedParticipant(params: {
  orgId: string;
  displayName: string;
  email?: string | null;
}) {
  const { data, error } = await supabase.rpc("create_managed_participant", {
    p_org_id: params.orgId,
    p_display_name: params.displayName,
    p_email: params.email ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as ManagedParticipant;
}

export async function deactivateManagedParticipant(participantId: string) {
  const { error } = await supabase.rpc("deactivate_managed_participant", {
    p_participant_id: participantId,
  });
  if (error) throw error;
}

export async function listNotificationAnnouncements(orgId: string | null) {
  const { data, error } = await supabase.rpc("admin_list_notification_announcements", {
    p_org_id: orgId,
  });

  if (error) {
    if (isMissingAnnouncementInfra(error)) return [];
    throw error;
  }
  return (data ?? []) as NotificationAnnouncement[];
}

export async function createNotificationAnnouncement(params: {
  orgId: string | null;
  title: string;
  body: string;
  linkPath?: string | null;
  kind: NotificationAnnouncementKind;
  audience: NotificationAnnouncementAudience;
  priority: NotificationAnnouncementPriority;
  expiresAt?: string | null;
}) {
  const { data, error } = await supabase.rpc("admin_create_notification_announcement", {
    p_org_id: params.orgId,
    p_title: params.title,
    p_body: params.body,
    p_link_path: params.linkPath ?? null,
    p_kind: params.kind,
    p_audience: params.audience,
    p_priority: params.priority,
    p_expires_at: params.expiresAt ?? null,
  });
  if (error) {
    if (isMissingAnnouncementInfra(error)) {
      throw new Error("Notification announcements need the latest Supabase migration before publishing is available.");
    }
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row as NotificationAnnouncement;
}

export async function archiveNotificationAnnouncement(announcementId: string) {
  const { error } = await supabase.rpc("admin_archive_notification_announcement", {
    p_announcement_id: announcementId,
  });
  if (error) {
    if (isMissingAnnouncementInfra(error)) {
      throw new Error("Notification announcements need the latest Supabase migration before archiving is available.");
    }
    throw error;
  }
}
