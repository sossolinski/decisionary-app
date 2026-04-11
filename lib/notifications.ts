"use client";

import { supabase } from "./supabaseClient";

export type NotificationKind =
  | "session_update"
  | "session_development"
  | "overdue_task"
  | "session_assignment"
  | "role_assignment"
  | "system_notice"
  | "product_update";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  group: "session" | "system" | "product";
  priority: "normal" | "important";
  title: string;
  body: string;
  href: string;
  at: string;
};

const NOTIFICATION_CENTER_SEEN_AT_KEY = "decisionary.notification-center.seen-at";
const NOTIFICATION_CENTER_HIDDEN_IDS_KEY = "decisionary.notification-center.hidden-ids";

type SessionSummaryRow = {
  id: string;
  title?: string | null;
  join_code?: string | null;
  status?: string | null;
  scenarios?: {
    title?: string | null;
  } | { title?: string | null }[] | null;
};

type SessionParticipantRow = {
  session_id: string;
  joined_at: string;
  sessions?: SessionSummaryRow | SessionSummaryRow[] | null;
};

type SessionRoleAssignmentRow = {
  id: string;
  session_id: string;
  role_key: string | null;
  assigned_at: string;
  sessions?: SessionSummaryRow | SessionSummaryRow[] | null;
};

type SessionTaskNotificationRow = {
  id: string;
  session_id: string;
  title: string;
  due_at: string | null;
  status: string;
};

type SessionConsequenceNotificationRow = {
  id: string;
  session_id: string;
  title: string;
  applied_at: string;
  severity: string;
};

type SessionInjectNotificationRow = {
  id: string;
  session_id: string;
  delivered_at: string;
  injects?: {
    title?: string | null;
    channel?: string | null;
  } | null;
};

type NotificationAnnouncementRow = {
  id: string;
  kind: "system" | "product";
  priority: "normal" | "important";
  title: string;
  body: string;
  link_path: string | null;
  published_at: string;
};

function canUseDOM() {
  return typeof window !== "undefined";
}

export function readNotificationCenterSeenAt() {
  if (!canUseDOM()) return 0;
  const raw = window.localStorage.getItem(NOTIFICATION_CENTER_SEEN_AT_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function markNotificationCenterSeen() {
  if (!canUseDOM()) return;
  window.localStorage.setItem(NOTIFICATION_CENTER_SEEN_AT_KEY, String(Date.now()));
}

export function readHiddenNotificationIds() {
  if (!canUseDOM()) return [];
  const raw = window.localStorage.getItem(NOTIFICATION_CENTER_HIDDEN_IDS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

export function hideNotifications(ids: string[]) {
  if (!canUseDOM() || ids.length === 0) return;
  const next = Array.from(new Set([...readHiddenNotificationIds(), ...ids]));
  window.localStorage.setItem(NOTIFICATION_CENTER_HIDDEN_IDS_KEY, JSON.stringify(next));
}

export function notificationIsUnread(item: AppNotification, seenAt: number) {
  const at = new Date(item.at).getTime();
  if (!Number.isFinite(at)) return false;
  return at > seenAt;
}

export function formatNotificationTime(iso: string) {
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return "Now";

  const diffMs = Date.now() - at;
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return "Now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function getSessionIdFromPath(pathname: string | null | undefined) {
  const value = pathname ?? "";
  const facilitatorMatch = value.match(/^\/facilitator\/sessions\/([0-9a-f-]{36})$/i);
  if (facilitatorMatch?.[1]) return facilitatorMatch[1];
  const participantMatch = value.match(/^\/sessions\/([0-9a-f-]{36})$/i);
  if (participantMatch?.[1]) return participantMatch[1];
  return null;
}

function buildSessionHref(sessionId: string) {
  return `/sessions/${sessionId}`;
}

function scenarioLabel(row: SessionSummaryRow | null | undefined) {
  const scenario = Array.isArray(row?.scenarios) ? row?.scenarios[0] : row?.scenarios;
  return scenario?.title?.trim() || row?.title?.trim() || `Session ${row?.id?.slice(0, 8) ?? ""}`;
}

function roleLabel(value: string | null | undefined) {
  if (!value) return "team role";
  return value.replaceAll("_", " ");
}

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function isMissingAnnouncementInfra(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const message = "message" in error && typeof error.message === "string" ? error.message.toLowerCase() : "";

  return (
    code === "PGRST202" ||
    message.includes("list_my_notification_announcements") ||
    message.includes("notification_announcements")
  );
}

async function listAnnouncementNotifications() {
  const { data, error } = await supabase.rpc("list_my_notification_announcements");
  if (error) {
    if (isMissingAnnouncementInfra(error)) {
      return { systemItems: [], productItems: [] };
    }
    throw error;
  }

  const rows = (data ?? []) as NotificationAnnouncementRow[];
  const systemItems: AppNotification[] = [];
  const productItems: AppNotification[] = [];

  for (const row of rows) {
    const item: AppNotification = {
      id: `announcement:${row.id}`,
      kind: row.kind === "product" ? "product_update" : "system_notice",
      group: row.kind === "product" ? "product" : "system",
      priority: row.priority,
      title: row.title,
      body: row.body,
      href: row.link_path?.trim() || "/settings",
      at: row.published_at,
    };

    if (row.kind === "product") productItems.push(item);
    else systemItems.push(item);
  }

  return { systemItems, productItems };
}

async function listSystemNotifications(userId: string) {
  const [participantsRes, rolesRes] = await Promise.all([
    supabase
      .from("session_participants")
      .select(
        `
          session_id,
          joined_at,
          sessions:session_id (
            id,
            title,
            join_code,
            status,
            scenarios:scenario_id (
              title
            )
          )
        `
      )
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })
      .limit(6),
    supabase
      .from("session_role_assignments")
      .select(
        `
          id,
          session_id,
          role_key,
          assigned_at,
          sessions:session_id (
            id,
            title,
            join_code,
            status,
            scenarios:scenario_id (
              title
            )
          )
        `
      )
      .eq("user_id", userId)
      .order("assigned_at", { ascending: false })
      .limit(6),
  ]);

  if (participantsRes.error) throw participantsRes.error;
  if (rolesRes.error) throw rolesRes.error;

  const participantNotifications: AppNotification[] = ((participantsRes.data ?? []) as unknown as SessionParticipantRow[]).map(
    (row) => ({
      id: `participant:${row.session_id}:${row.joined_at}`,
      kind: "session_assignment",
      group: "system",
      priority: "important",
      title: "You were added to an exercise",
      body: scenarioLabel(one(row.sessions)),
      href: buildSessionHref(row.session_id),
      at: row.joined_at,
    })
  );

  const roleNotifications: AppNotification[] = ((rolesRes.data ?? []) as unknown as SessionRoleAssignmentRow[]).map(
    (row) => ({
      id: `role:${row.id}`,
      kind: "role_assignment",
      group: "system",
      priority: "important",
      title: "New role assignment",
      body: `You were assigned as ${roleLabel(row.role_key)} in ${scenarioLabel(one(row.sessions))}.`,
      href: buildSessionHref(row.session_id),
      at: row.assigned_at,
    })
  );

  return [...participantNotifications, ...roleNotifications]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);
}

async function listSessionNotifications(sessionId: string) {
  const [tasksRes, consequencesRes, injectsRes] = await Promise.all([
    supabase
      .from("session_tasks")
      .select("id, session_id, title, due_at, status")
      .eq("session_id", sessionId)
      .not("status", "in", '("done","cancelled")')
      .not("due_at", "is", null)
      .order("due_at", { ascending: true })
      .limit(3),
    supabase
      .from("session_consequences")
      .select("id, session_id, title, applied_at, severity")
      .eq("session_id", sessionId)
      .order("applied_at", { ascending: false })
      .limit(3),
    supabase
      .from("session_injects")
      .select(
        `
          id,
          session_id,
          delivered_at,
          injects:inject_id (
            title,
            channel
          )
        `
      )
      .eq("session_id", sessionId)
      .order("delivered_at", { ascending: false })
      .limit(3),
  ]);

  if (tasksRes.error) throw tasksRes.error;
  if (consequencesRes.error) throw consequencesRes.error;
  if (injectsRes.error) throw injectsRes.error;

  const now = Date.now();

  const taskNotifications: AppNotification[] = ((tasksRes.data ?? []) as SessionTaskNotificationRow[])
    .filter((row) => {
      const dueAt = new Date(row.due_at ?? 0).getTime();
      return Number.isFinite(dueAt) && dueAt <= now;
    })
    .map((row) => ({
      id: `task:${row.id}`,
      kind: "overdue_task",
      group: "session",
      priority: "important",
      title: "Overdue follow-up",
      body: row.title,
      href: buildSessionHref(row.session_id),
      at: row.due_at ?? new Date().toISOString(),
    }));

  const consequenceNotifications: AppNotification[] = ((consequencesRes.data ?? []) as SessionConsequenceNotificationRow[]).map(
    (row) => ({
      id: `consequence:${row.id}`,
      kind: "session_development",
      group: "session",
      priority: row.severity === "critical" || row.severity === "high" ? "important" : "normal",
      title: "Session development",
      body: row.title,
      href: buildSessionHref(row.session_id),
      at: row.applied_at,
    })
  );

  const injectNotifications: AppNotification[] = ((injectsRes.data ?? []) as SessionInjectNotificationRow[]).map(
    (row) => ({
      id: `inject:${row.id}`,
      kind: "session_update",
      group: "session",
      priority: row.injects?.channel === "pulse" ? "important" : "normal",
      title: row.injects?.channel === "pulse" ? "New pulse item" : "New session update",
      body: row.injects?.title?.trim() || "A new update arrived in this session.",
      href: buildSessionHref(row.session_id),
      at: row.delivered_at,
    })
  );

  return [...taskNotifications, ...consequenceNotifications, ...injectNotifications]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);
}

export async function listNotificationCenterItems(params: {
  userId: string;
  pathname?: string | null;
}) {
  const sessionId = getSessionIdFromPath(params.pathname);
  const [systemItems, sessionItems, announcementItems] = await Promise.all([
    listSystemNotifications(params.userId),
    sessionId ? listSessionNotifications(sessionId) : Promise.resolve<AppNotification[]>([]),
    listAnnouncementNotifications(),
  ]);

  return {
    sessionItems,
    systemItems: [...systemItems, ...announcementItems.systemItems]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8),
    productItems: announcementItems.productItems
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8),
  };
}
