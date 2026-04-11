"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, Sparkles } from "lucide-react";

import { useRoleContext } from "@/app/components/useRoleContext";
import useAutoRefresh from "@/app/components/useAutoRefresh";
import {
  archiveNotificationAnnouncement,
  createNotificationAnnouncement,
  listNotificationAnnouncements,
  type NotificationAnnouncement,
  type NotificationAnnouncementAudience,
  type NotificationAnnouncementKind,
  type NotificationAnnouncementPriority,
} from "@/lib/organizations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import HintTooltip from "@/app/components/HintTooltip";
import { getErrorMessage } from "@/lib/errors";

type NoticeTone = "ok" | "err";

function toneClass(tone: NoticeTone) {
  return tone === "ok" ? "notice notice-success" : "notice notice-error";
}

export default function AdminAnnouncementsPage() {
  const { loading, isPermAdmin, organizations, activeOrgId, activeOrg } = useRoleContext();
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [scope, setScope] = useState<"org" | "global">("global");
  const [kind, setKind] = useState<NotificationAnnouncementKind>("system");
  const [audience, setAudience] = useState<NotificationAnnouncementAudience>("all");
  const [priority, setPriority] = useState<NotificationAnnouncementPriority>("normal");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkPath, setLinkPath] = useState("");
  const [globalAnnouncements, setGlobalAnnouncements] = useState<NotificationAnnouncement[]>([]);
  const [orgAnnouncements, setOrgAnnouncements] = useState<NotificationAnnouncement[]>([]);

  const currentOrgAnnouncements = useMemo(
    () => (scope === "global" ? globalAnnouncements : orgAnnouncements),
    [globalAnnouncements, orgAnnouncements, scope]
  );

  async function refreshAnnouncements() {
    const [globalItems, orgItems] = await Promise.all([
      listNotificationAnnouncements(null),
      activeOrgId ? listNotificationAnnouncements(activeOrgId) : Promise.resolve([]),
    ]);
    setGlobalAnnouncements(globalItems);
    setOrgAnnouncements(orgItems);
  }

  useEffect(() => {
    if (!isPermAdmin) return;
    void refreshAnnouncements().catch((err: unknown) => {
      setNotice({ tone: "err", text: getErrorMessage(err, "Failed to load announcements.") });
    });
  }, [activeOrgId, isPermAdmin]);

  useAutoRefresh(
    async () => {
      await refreshAnnouncements();
    },
    { enabled: isPermAdmin, intervalMs: 30000 }
  );

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  if (!isPermAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access denied</CardTitle>
          <CardDescription>This page is available only to workspace admins.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

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
                <h1 className="text-[28px] font-semibold tracking-tight">Manage shared announcements without mixing them into organization setup.</h1>
                <p className="max-w-[62ch] text-sm leading-7 text-[color:var(--studio-muted)]">
                  Publish global notices here or switch to the active organization scope when a message belongs to one workspace only.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="ui-metric-card">
                <div className="ui-metric-label">Global</div>
                <div className="mt-2 text-3xl font-semibold">{globalAnnouncements.length}</div>
              </div>
              <div className="ui-metric-card">
                <div className="ui-metric-label">Active org</div>
                <div className="mt-2 text-3xl font-semibold">{orgAnnouncements.length}</div>
              </div>
              <div className="ui-metric-card">
                <div className="ui-metric-label">Organizations</div>
                <div className="mt-2 text-3xl font-semibold">{organizations.length}</div>
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

      <div className="grid gap-4 xl:grid-cols-[1.15fr_1.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Scope</CardTitle>
            <CardDescription>
              Choose whether you are publishing for the whole platform or only the selected organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Button
                type="button"
                variant={scope === "global" ? "default" : "outline"}
                className="justify-start"
                onClick={() => setScope("global")}
              >
                Global announcements
              </Button>
              <Button
                type="button"
                variant={scope === "org" ? "default" : "outline"}
                className="justify-start"
                onClick={() => setScope("org")}
                disabled={!activeOrgId}
              >
                {activeOrg ? `${activeOrg.name}` : "Selected organization"}
              </Button>
            </div>

            <div className="rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 py-3 text-sm text-[color:var(--studio-muted)]">
              {scope === "global"
                ? "Use global notices for platform-wide or cross-workspace communication."
                : activeOrg
                  ? `Currently publishing into ${activeOrg.name}.`
                  : "Pick an active organization first to use organization-scoped announcements."}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellRing className="h-5 w-5 opacity-80" />
                Publish announcement
                <HintTooltip
                  text="Use global scope for shared platform notices and organization scope for workspace-specific communication."
                  side="right"
                />
              </CardTitle>
              <CardDescription>
                The notification center will surface these notices according to scope, audience, and priority.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="ui-form-label">Category</label>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value === "product" ? "product" : "system")}
                    className="h-10 w-full rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 text-sm"
                  >
                    <option value="system">System</option>
                    <option value="product">Product</option>
                  </select>
                </div>
                <div>
                  <label className="ui-form-label">Audience</label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience((e.target.value as NotificationAnnouncementAudience) ?? "all")}
                    className="h-10 w-full rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 text-sm"
                  >
                    <option value="all">Everyone</option>
                    <option value="admins">Admins</option>
                    <option value="facilitators">Facilitators</option>
                    <option value="participants">Participants</option>
                  </select>
                </div>
                <div>
                  <label className="ui-form-label">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority((e.target.value as NotificationAnnouncementPriority) ?? "normal")}
                    className="h-10 w-full rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 text-sm"
                  >
                    <option value="normal">Normal</option>
                    <option value="important">Important</option>
                  </select>
                </div>
                <div>
                  <label className="ui-form-label">Link path</label>
                  <Input
                    value={linkPath}
                    onChange={(e) => setLinkPath(e.target.value)}
                    placeholder="/settings or /facilitator/sessions"
                  />
                </div>
              </div>

              <div>
                <label className="ui-form-label">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notification title" />
              </div>

              <div>
                <label className="ui-form-label">Message</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="What should people know right now?"
                  className="min-h-24 w-full rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 py-2.5 text-sm outline-none transition focus-visible:shadow-[var(--studio-ring)]"
                />
              </div>

              <Button
                disabled={busyKey !== null || (scope === "org" && !activeOrgId)}
                onClick={() => {
                  void (async () => {
                    try {
                      setBusyKey("announcement:create");
                      await createNotificationAnnouncement({
                        orgId: scope === "global" ? null : activeOrgId,
                        title,
                        body,
                        linkPath: linkPath || null,
                        kind,
                        audience,
                        priority,
                      });
                      setTitle("");
                      setBody("");
                      setLinkPath("");
                      await refreshAnnouncements();
                      setNotice({ tone: "ok", text: "Announcement published." });
                    } catch (err: unknown) {
                      setNotice({ tone: "err", text: getErrorMessage(err, "Failed to publish announcement.") });
                    } finally {
                      setBusyKey(null);
                    }
                  })();
                }}
              >
                {busyKey === "announcement:create" ? "Publishing…" : "Publish announcement"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active announcements</CardTitle>
              <CardDescription>
                {scope === "global"
                  ? "Global notices visible across the workspace."
                  : activeOrg
                    ? `Notices currently scoped to ${activeOrg.name}.`
                    : "No organization selected."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentOrgAnnouncements.length === 0 ? (
                <div className="ui-empty-state">No active announcements in this scope.</div>
              ) : (
                currentOrgAnnouncements.map((announcement) => (
                  <div key={announcement.id} className="rounded-[var(--radius)] border border-[var(--studio-border)] px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium">{announcement.title}</div>
                          <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
                            {announcement.kind}
                          </span>
                          <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
                            {announcement.audience}
                          </span>
                          {announcement.priority === "important" ? (
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
                              Important
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-sm text-[color:var(--studio-muted)]">{announcement.body}</div>
                        <div className="mt-2 text-xs text-[color:var(--studio-muted2)]">
                          Published {new Date(announcement.published_at).toLocaleString()}
                          {announcement.link_path ? ` · link ${announcement.link_path}` : ""}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyKey !== null}
                        onClick={() => {
                          if (!confirm(`Archive "${announcement.title}"?`)) return;
                          void (async () => {
                            try {
                              setBusyKey(`announcement:archive:${announcement.id}`);
                              await archiveNotificationAnnouncement(announcement.id);
                              await refreshAnnouncements();
                              setNotice({ tone: "ok", text: "Announcement archived." });
                            } catch (err: unknown) {
                              setNotice({ tone: "err", text: getErrorMessage(err, "Failed to archive announcement.") });
                            } finally {
                              setBusyKey(null);
                            }
                          })();
                        }}
                      >
                        Archive
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
