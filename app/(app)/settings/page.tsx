"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import {
  applyLanguagePreference,
  applyThemePreference,
  readNotificationPreference,
  readLanguagePreference,
  readThemePreference,
  saveNotificationPreference,
  saveLanguagePreference,
  saveThemePreference,
  type NotificationPreference,
  type LanguagePreference,
  type ThemePreference,
} from "@/lib/clientPreferences";

function toMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [fullName, setFullName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemePreference>("auto");
  const [language, setLanguage] = useState<LanguagePreference>("en");
  const [notifications, setNotifications] = useState<NotificationPreference>({
    productUpdates: true,
    exerciseAlerts: true,
    rosterChanges: true,
  });
  const displayNameId = useId();
  const emailId = useId();
  const languageId = useId();
  const themeId = useId();
  const preferencesHydratedRef = useRef(false);
  const profileHeadingId = useId();
  const preferencesHeadingId = useId();
  const notificationsHeadingId = useId();

  useEffect(() => {
    const nextTheme = readThemePreference();
    const nextLanguage = readLanguagePreference();
    const nextNotifications = readNotificationPreference();
    setTheme(nextTheme);
    setLanguage(nextLanguage);
    setNotifications(nextNotifications);
    applyThemePreference(nextTheme);
    applyLanguagePreference(nextLanguage);
    preferencesHydratedRef.current = true;

    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth.user;
        if (!user) {
          setLoading(false);
          return;
        }

        setEmail(user.email ?? "");

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("full_name,email")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;
        setFullName(profile?.full_name ?? "");
        if (profile?.email) setEmail(profile.email);
      } catch (e: unknown) {
        setErr(toMessage(e, "Failed to load account settings."));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!preferencesHydratedRef.current) return;

    applyThemePreference(theme);
    saveThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    if (!preferencesHydratedRef.current) return;

    applyLanguagePreference(language);
    saveLanguagePreference(language);
  }, [language]);

  useEffect(() => {
    if (!preferencesHydratedRef.current) return;

    saveNotificationPreference(notifications);
  }, [notifications]);

  async function saveProfile() {
    setSaving(true);
    setMsg(null);
    setErr(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) throw new Error("Not authenticated.");

      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() || null })
        .eq("user_id", user.id);

      if (error) throw error;
      setMsg("Profile settings saved.");
    } catch (e: unknown) {
      setErr(toMessage(e, "Failed to save profile settings."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading settings…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Profile settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account name and personal workspace preferences.
        </p>
      </div>

      {msg ? <div role="status" aria-live="polite" className="notice notice-success">{msg}</div> : null}
      {err ? <div role="alert" aria-live="assertive" className="notice notice-error">{err}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle id={profileHeadingId}>Profile</CardTitle>
          <CardDescription>
            Update how your account appears across the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4" aria-labelledby={profileHeadingId}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor={displayNameId} className="ui-form-label">Display name</label>
              <Input
                id={displayNameId}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div>
              <label htmlFor={emailId} className="ui-form-label">Email</label>
              <Input id={emailId} value={email} disabled />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void saveProfile()} disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle id={preferencesHeadingId}>Workspace preferences</CardTitle>
          <CardDescription>
            These preferences apply only to this browser for now.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2" aria-labelledby={preferencesHeadingId}>
          <div>
            <label htmlFor={languageId} className="ui-form-label">Language</label>
            <select
              id={languageId}
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguagePreference)}
              className="h-10 w-full rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 text-sm"
            >
              <option value="en">English</option>
              <option value="pl">Polski</option>
            </select>
          </div>

          <div>
            <label htmlFor={themeId} className="ui-form-label">Theme</label>
            <select
              id={themeId}
              value={theme}
              onChange={(e) => setTheme(e.target.value as ThemePreference)}
              className="h-10 w-full rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 text-sm"
            >
              <option value="auto">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle id={notificationsHeadingId}>Notifications</CardTitle>
          <CardDescription>
            Control what the notification center in this browser should surface first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3" aria-labelledby={notificationsHeadingId}>
          <div className="rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 py-3 text-sm text-[color:var(--studio-muted)]">
            These settings affect the topbar notification feed on this device. They do not send email or mobile push notifications.
          </div>
          {[
            {
              key: "exerciseAlerts" as const,
              title: "Exercise alerts",
              description: "Priority updates tied to live sessions and exercise flow.",
            },
            {
              key: "rosterChanges" as const,
              title: "Roster changes",
              description: "Participant joins, removals, and related roster activity.",
            },
            {
              key: "productUpdates" as const,
              title: "Product updates",
              description: "Occasional product and workspace improvement notices.",
            },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-start justify-between gap-4 rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-3"
            >
              <div className="space-y-1">
                <div className="text-sm font-medium">{item.title}</div>
                <div className="text-sm text-muted-foreground">{item.description}</div>
              </div>
              <input
                type="checkbox"
                checked={notifications[item.key]}
                onChange={(e) =>
                  setNotifications((current) => ({
                    ...current,
                    [item.key]: e.target.checked,
                  }))
                }
                className="mt-1 h-4 w-4 rounded border border-[var(--studio-border-strong)]"
                aria-label={item.title}
              />
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
