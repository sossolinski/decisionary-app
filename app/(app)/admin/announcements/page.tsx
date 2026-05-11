"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BellRing, Building2, Megaphone, Sparkles } from "lucide-react";

import { useRoleContext } from "@/app/components/useRoleContext";
import useAutoRefresh from "@/app/components/useAutoRefresh";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import {
  archiveNotificationAnnouncement,
  createNotificationAnnouncement,
  listNotificationAnnouncements,
  type NotificationAnnouncement,
  type NotificationAnnouncementAudience,
  type NotificationAnnouncementKind,
  type NotificationAnnouncementPriority,
} from "@/lib/organizations";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import HintTooltip from "@/app/components/HintTooltip";
import { getErrorMessage } from "@/lib/errors";

type NoticeTone = "ok" | "err";

function toneClass(tone: NoticeTone) {
  return tone === "ok" ? "notice notice-success" : "notice notice-error";
}

type PendingConfirm = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "default" | "destructive";
  onConfirm: () => Promise<void>;
};

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
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const currentOrgAnnouncements = useMemo(
    () => (scope === "global" ? globalAnnouncements : orgAnnouncements),
    [globalAnnouncements, orgAnnouncements, scope]
  );

  const refreshAnnouncements = useCallback(async () => {
    const [globalItems, orgItems] = await Promise.all([
      listNotificationAnnouncements(null),
      activeOrgId ? listNotificationAnnouncements(activeOrgId) : Promise.resolve([]),
    ]);
    setGlobalAnnouncements(globalItems);
    setOrgAnnouncements(orgItems);
  }, [activeOrgId]);

  useEffect(() => {
    if (!isPermAdmin) return;
    void refreshAnnouncements().catch((err: unknown) => {
      setNotice({ tone: "err", text: getErrorMessage(err, "Failed to load announcements.") });
    });
  }, [isPermAdmin, refreshAnnouncements]);

  useAutoRefresh(
    async () => {
      await refreshAnnouncements();
    },
    { enabled: isPermAdmin, intervalMs: 30000 }
  );

  function requestArchiveAnnouncement(announcement: NotificationAnnouncement) {
    setPendingConfirm({
      title: "Archive announcement?",
      description: `This archives "${announcement.title}" and removes it from active notification surfaces.`,
      confirmLabel: "Archive announcement",
      tone: "destructive",
      onConfirm: () => archiveAnnouncementNow(announcement.id),
    });
  }

  async function archiveAnnouncementNow(announcementId: string) {
    try {
      setBusyKey(`announcement:archive:${announcementId}`);
      await archiveNotificationAnnouncement(announcementId);
      await refreshAnnouncements();
      setNotice({ tone: "ok", text: "Announcement archived." });
    } catch (err: unknown) {
      setNotice({ tone: "err", text: getErrorMessage(err, "Failed to archive announcement.") });
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return <div className="text-sm text-[color:var(--studio-muted)]">Loading…</div>;
  }

  if (!isPermAdmin) {
    return (
      <section className="rounded-2xl border border-border bg-background px-5 py-5 shadow-[var(--studio-shadow)]">
        <h1 className="text-lg font-semibold text-foreground">Access denied</h1>
        <p className="mt-1 text-sm leading-6 text-[color:var(--studio-muted)]">
          Announcements are only available to permanent administrators.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-background px-5 py-5 shadow-[var(--studio-shadow)] md:px-6 md:py-6">
        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.95fr] lg:items-start">
          <div className="space-y-4">
            <div className="ui-eyebrow">
              <Sparkles className="h-3.5 w-3.5" />
              Announcement workspace
            </div>

            <div className="space-y-2">
              <h1 className="max-w-3xl text-[28px] font-semibold leading-tight tracking-tight text-foreground">
                Manage shared announcements without mixing them into organization setup.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-[color:var(--studio-muted)]">
                Publish platform-wide notices or target the selected organization when only one workspace needs context.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Button asChild>
                <Link href="/admin">
                  Admin overview
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/admin/organizations">
                  Organizations
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 self-start sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="rounded-2xl border border-border bg-background px-4 py-4 shadow-[0_8px_20px_hsl(220_20%_20%/0.025)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="ui-metric-label whitespace-nowrap">Global</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{globalAnnouncements.length}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-[color:var(--studio-muted)]">
                  <Megaphone className="h-4 w-4" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-4 shadow-[0_8px_20px_hsl(220_20%_20%/0.025)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="ui-metric-label whitespace-nowrap">Org notices</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{orgAnnouncements.length}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-[color:var(--studio-muted)]">
                  <BellRing className="h-4 w-4" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-4 shadow-[0_8px_20px_hsl(220_20%_20%/0.025)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="ui-metric-label whitespace-nowrap">Orgs</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{organizations.length}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-[color:var(--studio-muted)]">
                  <Building2 className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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
        <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--studio-shadow)]">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-2 text-base font-semibold text-foreground">
              Scope
              <HintTooltip text="Choose whether you are publishing for the whole platform or only the selected organization." />
            </div>
          </div>
          <div className="space-y-3 px-5 py-5">
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
          </div>
        </section>

        <div className="space-y-4">
          <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--studio-shadow)]">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                <BellRing className="h-5 w-5 opacity-80" />
                Publish announcement
                <HintTooltip
                  text="Use global scope for shared platform notices and organization scope for workspace-specific communication."
                  side="right"
                />
              </div>
            </div>
            <div className="space-y-4 px-5 py-5">
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
                  <label className="ui-form-label">Open page (optional)</label>
                  <Input
                    value={linkPath}
                    onChange={(e) => setLinkPath(e.target.value)}
                    placeholder="/settings"
                  />
                  <p className="mt-1.5 text-xs leading-5 text-[color:var(--studio-muted2)]">
                    Leave empty for a text-only notice. Add an internal page when the announcement should open somewhere.
                  </p>
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
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--studio-shadow)]">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                Active announcements
                <HintTooltip
                  text={
                    scope === "global"
                      ? "Global notices visible across the workspace."
                      : activeOrg
                      ? `Notices currently scoped to ${activeOrg.name}.`
                      : "Pick an active organization first to view organization-scoped notices."
                  }
                />
              </div>
            </div>
            <div className="space-y-3 px-5 py-5">
              {currentOrgAnnouncements.length === 0 ? (
                <div className="ui-empty-state">No active announcements in this scope.</div>
              ) : (
                currentOrgAnnouncements.map((announcement) => (
                  <div key={announcement.id} className="rounded-2xl border border-border bg-background px-4 py-4 shadow-[0_8px_20px_hsl(220_20%_20%/0.025)] transition hover:border-[var(--studio-border-strong)]">
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
                        onClick={() => requestArchiveAnnouncement(announcement)}
                      >
                        {busyKey === `announcement:archive:${announcement.id}` ? "…" : "Archive"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

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
