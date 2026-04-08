"use client";

import type { AppRole } from "@/lib/rbac";

const STORE_KEY = "decisionary.mgmt.v1";
const ACTIVE_ORG_KEY_PREFIX = "decisionary.active-org.v1";

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

type Store = {
  version: 1;
  organizations: Organization[];
  memberships: OrganizationMembership[];
  facilitator_invites: FacilitatorInvite[];
  participants: ManagedParticipant[];
};

const EMPTY_STORE: Store = {
  version: 1,
  organizations: [],
  memberships: [],
  facilitator_invites: [],
  participants: [],
};

function nowIso() {
  return new Date().toISOString();
}

function safeLower(v: string | null | undefined) {
  return (v ?? "").trim().toLowerCase();
}

function slugify(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `org-${Math.random().toString(36).slice(2, 8)}`;
}

function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function randomToken() {
  return `${Math.random().toString(36).slice(2, 10)}${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function randomJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function isClient() {
  return typeof window !== "undefined";
}

function readStore(): Store {
  if (!isClient()) return EMPTY_STORE;

  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return EMPTY_STORE;

    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      version: 1,
      organizations: Array.isArray(parsed.organizations) ? parsed.organizations : [],
      memberships: Array.isArray(parsed.memberships) ? parsed.memberships : [],
      facilitator_invites: Array.isArray(parsed.facilitator_invites)
        ? parsed.facilitator_invites
        : [],
      participants: Array.isArray(parsed.participants) ? parsed.participants : [],
    };
  } catch {
    return EMPTY_STORE;
  }
}

function writeStore(store: Store) {
  if (!isClient()) return;
  window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function withStore<T>(fn: (store: Store) => T): T {
  const base = readStore();
  const cloned: Store = JSON.parse(JSON.stringify(base)) as Store;
  const result = fn(cloned);
  writeStore(cloned);
  return result;
}

function userStorageKey(userId: string | null | undefined, email: string | null | undefined) {
  const uid = (userId ?? "").trim();
  if (uid) return `${ACTIVE_ORG_KEY_PREFIX}uid:${uid}`;

  const em = safeLower(email);
  if (em) return `${ACTIVE_ORG_KEY_PREFIX}email:${em}`;

  return `${ACTIVE_ORG_KEY_PREFIX}anon`;
}

function ensureUniqueSlug(store: Store, slug: string) {
  const taken = new Set(store.organizations.map((o) => o.slug));
  if (!taken.has(slug)) return slug;

  let i = 2;
  while (taken.has(`${slug}-${i}`)) i += 1;
  return `${slug}-${i}`;
}

export function ensureAdminBootstrap(args: {
  userId: string | null;
  email: string | null;
}) {
  if (!args.userId) return;

  withStore((store) => {
    if (store.organizations.length === 0) {
      const org: Organization = {
        id: randomId(),
        name: "Default Organization",
        slug: "default-organization",
        created_at: nowIso(),
        created_by: args.userId,
        archived: false,
      };
      store.organizations.push(org);
    }

    const hasAdminMembership = store.memberships.some(
      (m) => m.role === "admin" && (m.user_id === args.userId || safeLower(m.email) === safeLower(args.email))
    );

    if (!hasAdminMembership) {
      const firstOrg = store.organizations[0];
      if (!firstOrg) return;

      store.memberships.push({
        id: randomId(),
        org_id: firstOrg.id,
        user_id: args.userId,
        email: safeLower(args.email) || null,
        role: "admin",
        created_at: nowIso(),
        created_by: args.userId,
      });
    }
  });
}

export function getActiveOrgId(args: {
  userId: string | null;
  email: string | null;
}): string | null {
  if (!isClient()) return null;
  const key = userStorageKey(args.userId, args.email);
  const v = window.localStorage.getItem(key);
  return v && v.trim() ? v : null;
}

export function setActiveOrgId(args: {
  userId: string | null;
  email: string | null;
  orgId: string | null;
}) {
  if (!isClient()) return;
  const key = userStorageKey(args.userId, args.email);
  if (!args.orgId) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, args.orgId);
}

export function listAllOrganizations() {
  return readStore().organizations.filter((o) => !o.archived);
}

export function listMembershipsForOrg(orgId: string) {
  return readStore().memberships.filter((m) => m.org_id === orgId);
}

export function listInvitesForOrg(orgId: string) {
  const now = Date.now();
  return withStore((store) => {
    for (const inv of store.facilitator_invites) {
      if (inv.status === "pending" && new Date(inv.expires_at).getTime() < now) {
        inv.status = "expired";
      }
    }

    return store.facilitator_invites
      .filter((x) => x.org_id === orgId)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  });
}

export function listParticipantsForOrg(orgId: string) {
  return readStore()
    .participants
    .filter((p) => p.org_id === orgId && p.active)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export function listOrganizationsForUser(args: {
  userId: string | null;
  email: string | null;
  role: AppRole | null;
}) {
  const store = readStore();

  if (args.role === "admin") {
    return store.organizations.filter((o) => !o.archived);
  }

  const uid = args.userId;
  const email = safeLower(args.email);

  if (!uid && !email) return [];

  const membershipOrgIds = new Set(
    store.memberships
      .filter((m) => {
        if (m.role === "admin") return false;
        if (uid && m.user_id === uid) return true;
        if (email && safeLower(m.email) === email) return true;
        return false;
      })
      .map((m) => m.org_id)
  );

  return store.organizations.filter((o) => !o.archived && membershipOrgIds.has(o.id));
}

export function createOrganization(args: {
  name: string;
  createdByUserId: string | null;
  createdByEmail: string | null;
}) {
  const cleanName = args.name.trim();
  if (!cleanName) throw new Error("Organization name is required.");

  return withStore((store) => {
    const orgId = randomId();
    const org: Organization = {
      id: orgId,
      name: cleanName,
      slug: ensureUniqueSlug(store, slugify(cleanName)),
      created_at: nowIso(),
      created_by: args.createdByUserId,
      archived: false,
    };

    store.organizations.unshift(org);

    if (args.createdByUserId || args.createdByEmail) {
      const membershipExists = store.memberships.some(
        (m) =>
          m.org_id === orgId &&
          m.role === "admin" &&
          ((args.createdByUserId && m.user_id === args.createdByUserId) ||
            (safeLower(args.createdByEmail) && safeLower(m.email) === safeLower(args.createdByEmail)))
      );

      if (!membershipExists) {
        store.memberships.push({
          id: randomId(),
          org_id: orgId,
          user_id: args.createdByUserId,
          email: safeLower(args.createdByEmail) || null,
          role: "admin",
          created_at: nowIso(),
          created_by: args.createdByUserId,
        });
      }
    }

    return org;
  });
}

export function deleteOrganization(orgId: string) {
  const cleanOrgId = (orgId ?? "").trim();
  if (!cleanOrgId) throw new Error("Organization id is required.");

  return withStore((store) => {
    const org = store.organizations.find((x) => x.id === cleanOrgId);
    if (!org || org.archived) {
      throw new Error("Organization not found.");
    }

    const activeOrganizations = store.organizations.filter((x) => !x.archived);
    if (activeOrganizations.length <= 1) {
      throw new Error("You must keep at least one organization.");
    }

    org.archived = true;

    store.memberships = store.memberships.filter((m) => m.org_id !== cleanOrgId);
    store.facilitator_invites = store.facilitator_invites.filter(
      (invite) => invite.org_id !== cleanOrgId
    );
    store.participants = store.participants.filter((p) => p.org_id !== cleanOrgId);

    return org;
  });
}

export function addMembership(args: {
  orgId: string;
  role: OrgRole;
  email?: string | null;
  userId?: string | null;
  createdBy: string | null;
}) {
  const emailNorm = safeLower(args.email);
  const userId = (args.userId ?? "").trim();

  if (!emailNorm && !userId) {
    throw new Error("Provide userId or email.");
  }

  return withStore((store) => {
    const exists = store.memberships.some((m) => {
      if (m.org_id !== args.orgId || m.role !== args.role) return false;
      if (userId && m.user_id === userId) return true;
      if (emailNorm && safeLower(m.email) === emailNorm) return true;
      return false;
    });

    if (exists) {
      throw new Error("Membership already exists.");
    }

    const membership: OrganizationMembership = {
      id: randomId(),
      org_id: args.orgId,
      role: args.role,
      user_id: userId || null,
      email: emailNorm || null,
      created_at: nowIso(),
      created_by: args.createdBy,
    };

    store.memberships.push(membership);
    return membership;
  });
}

export function removeMembership(membershipId: string) {
  withStore((store) => {
    store.memberships = store.memberships.filter((m) => m.id !== membershipId);
  });
}

export function createFacilitatorInvite(args: {
  orgId: string;
  email: string;
  createdBy: string | null;
  ttlDays?: number;
}) {
  const emailNorm = safeLower(args.email);
  if (!emailNorm || !emailNorm.includes("@")) {
    throw new Error("Valid facilitator email is required.");
  }

  return withStore((store) => {
    const now = Date.now();
    const ttlMs = Math.max(1, args.ttlDays ?? 14) * 24 * 60 * 60 * 1000;
    const invite: FacilitatorInvite = {
      id: randomId(),
      org_id: args.orgId,
      email: emailNorm,
      token: randomToken(),
      status: "pending",
      created_at: new Date(now).toISOString(),
      created_by: args.createdBy,
      expires_at: new Date(now + ttlMs).toISOString(),
      accepted_at: null,
      accepted_user_id: null,
    };

    store.facilitator_invites.unshift(invite);
    return invite;
  });
}

export function revokeFacilitatorInvite(inviteId: string) {
  withStore((store) => {
    const invite = store.facilitator_invites.find((x) => x.id === inviteId);
    if (!invite) return;
    invite.status = "revoked";
  });
}

export function acceptFacilitatorInvite(args: {
  token: string;
  userId: string | null;
  email: string | null;
}) {
  const token = (args.token ?? "").trim();
  if (!token) throw new Error("Invite token is required.");

  return withStore((store) => {
    const invite = store.facilitator_invites.find((x) => x.token === token);
    if (!invite) throw new Error("Invite not found.");

    if (invite.status !== "pending") {
      throw new Error(`Invite status is ${invite.status}.`);
    }

    if (new Date(invite.expires_at).getTime() < Date.now()) {
      invite.status = "expired";
      throw new Error("Invite expired.");
    }

    const emailNorm = safeLower(args.email);
    if (emailNorm && safeLower(invite.email) !== emailNorm) {
      throw new Error("Signed-in email does not match invited email.");
    }

    invite.status = "accepted";
    invite.accepted_at = nowIso();
    invite.accepted_user_id = args.userId;

    const hasMembership = store.memberships.some(
      (m) =>
        m.org_id === invite.org_id &&
        m.role === "facilitator" &&
        ((args.userId && m.user_id === args.userId) ||
          (emailNorm && safeLower(m.email) === emailNorm))
    );

    if (!hasMembership) {
      store.memberships.push({
        id: randomId(),
        org_id: invite.org_id,
        user_id: args.userId,
        email: emailNorm || invite.email,
        role: "facilitator",
        created_at: nowIso(),
        created_by: invite.created_by,
      });
    }

    return invite;
  });
}

export function findInviteByToken(token: string) {
  const clean = (token ?? "").trim();
  if (!clean) return null;

  const store = readStore();
  return store.facilitator_invites.find((x) => x.token === clean) ?? null;
}

export function addManagedParticipant(args: {
  orgId: string;
  displayName: string;
  email?: string | null;
  createdBy: string | null;
}) {
  const displayName = args.displayName.trim();
  if (!displayName) throw new Error("Participant name is required.");

  const emailNorm = safeLower(args.email) || null;

  return withStore((store) => {
    const participant: ManagedParticipant = {
      id: randomId(),
      org_id: args.orgId,
      display_name: displayName,
      email: emailNorm,
      join_code: randomJoinCode(),
      created_at: nowIso(),
      created_by: args.createdBy,
      active: true,
    };

    store.participants.unshift(participant);
    return participant;
  });
}

export function deactivateManagedParticipant(participantId: string) {
  withStore((store) => {
    const p = store.participants.find((x) => x.id === participantId);
    if (!p) return;
    p.active = false;
  });
}
