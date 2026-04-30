"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { useRoleContext } from "@/app/components/useRoleContext";
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

function normalizedEmailKey(value: string) {
  return value.trim().toLowerCase();
}

function resendCooldownStorageKeyForEmail(prefix: string, value: string) {
  return `${prefix}:${normalizedEmailKey(value)}`;
}

function resendTypeStorageKeyForEmail(prefix: string, value: string) {
  return `${prefix}:${normalizedEmailKey(value)}`;
}

export default function SettingsPage() {
  const { isAnonymous: contextIsAnonymous, needsEmailConfirmation } = useRoleContext();
  const resendCooldownSeconds = 45;
  const resendCooldownStorageKeyPrefix = "decisionary.settings.resend-confirmation-until";
  const resendTypeStorageKeyPrefix = "decisionary.settings.resend-confirmation-type";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [upgradeSaving, setUpgradeSaving] = useState(false);
  const [resendSaving, setResendSaving] = useState(false);
  const [resendCooldownLeft, setResendCooldownLeft] = useState(0);
  const [email, setEmail] = useState<string>("");
  const [fullName, setFullName] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [upgradeEmail, setUpgradeEmail] = useState("");
  const [upgradePassword, setUpgradePassword] = useState("");
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
  const upgradeEmailId = useId();
  const upgradePasswordId = useId();
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

        setIsAnonymous(!!user.is_anonymous);
        setEmail(user.email ?? "");
        setUpgradeEmail(user.email ?? "");

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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const confirmationEmail = normalizedEmailKey(email || upgradeEmail);
    if (!confirmationEmail) {
      setResendCooldownLeft(0);
      return;
    }

    const storageKey = resendCooldownStorageKeyForEmail(resendCooldownStorageKeyPrefix, confirmationEmail);
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) {
      setResendCooldownLeft(0);
      return;
    }

    const until = Number(raw);
    if (!Number.isFinite(until)) {
      window.sessionStorage.removeItem(storageKey);
      setResendCooldownLeft(0);
      return;
    }

    const secondsLeft = Math.ceil((until - Date.now()) / 1000);
    if (secondsLeft > 0) {
      setResendCooldownLeft(secondsLeft);
      return;
    }

    window.sessionStorage.removeItem(storageKey);
    setResendCooldownLeft(0);
  }, [email, upgradeEmail]);

  useEffect(() => {
    if (resendCooldownLeft <= 0) return;

    const timeoutId = window.setTimeout(() => {
      setResendCooldownLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [resendCooldownLeft]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const confirmationEmail = normalizedEmailKey(email || upgradeEmail);
    if (!confirmationEmail) return;

    const storageKey = resendCooldownStorageKeyForEmail(resendCooldownStorageKeyPrefix, confirmationEmail);
    if (resendCooldownLeft <= 0) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }

    window.sessionStorage.setItem(
      storageKey,
      String(Date.now() + resendCooldownLeft * 1000)
    );
  }, [email, resendCooldownLeft, upgradeEmail]);

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

  async function upgradeGuestAccount() {
    setUpgradeSaving(true);
    setMsg(null);
    setErr(null);

    try {
      const normalizedEmail = upgradeEmail.trim().toLowerCase();
      if (!normalizedEmail) throw new Error("Email is required.");
      if (!upgradePassword.trim()) throw new Error("Password is required.");
      if (upgradePassword.trim().length < 8) throw new Error("Password must have at least 8 characters.");

      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) throw new Error("Not authenticated.");
      if (!user.is_anonymous) {
        setIsAnonymous(false);
        throw new Error("This account is already upgraded.");
      }

      const { data, error } = await supabase.auth.updateUser({
        email: normalizedEmail,
        password: upgradePassword,
      });

      if (error) throw error;

      setEmail(data.user?.email ?? normalizedEmail);
      setUpgradeEmail(data.user?.email ?? normalizedEmail);
      setUpgradePassword("");
      setIsAnonymous(false);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          resendTypeStorageKeyForEmail(resendTypeStorageKeyPrefix, data.user?.email ?? normalizedEmail),
          "email_change"
        );
      }
      setMsg(
        "Guest account upgraded. If email confirmation is enabled in Supabase, confirm the address from your inbox."
      );
    } catch (e: unknown) {
      setErr(toMessage(e, "Failed to upgrade guest account."));
    } finally {
      setUpgradeSaving(false);
    }
  }

  async function resendConfirmationEmail() {
    setResendSaving(true);
    setMsg(null);
    setErr(null);

    try {
      const confirmationEmail = (email || upgradeEmail).trim().toLowerCase();
      if (!confirmationEmail) throw new Error("Email is missing.");

      const emailRedirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/participant` : undefined;
      const resendType =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(
              resendTypeStorageKeyForEmail(resendTypeStorageKeyPrefix, confirmationEmail)
            ) ?? "signup"
          : "signup";

      const { error } = await supabase.auth.resend({
        type: resendType === "email_change" ? "email_change" : "signup",
        email: confirmationEmail,
        options: { emailRedirectTo },
      });

      if (error) throw error;

      setResendCooldownLeft(resendCooldownSeconds);
      setMsg(`Confirmation email sent again to ${confirmationEmail}.`);
    } catch (e: unknown) {
      setErr(toMessage(e, "Failed to resend confirmation email."));
    } finally {
      setResendSaving(false);
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

      {needsEmailConfirmation ? (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle>Check your inbox</CardTitle>
            <CardDescription>
              Your email address is not confirmed yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-[var(--radius)] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-[color:var(--studio-muted)]">
              Open the confirmation email sent to <b>{email || upgradeEmail || "your inbox"}</b> and click the link to
              finish activating this account on other devices and browsers.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void resendConfirmationEmail()}
                disabled={resendSaving || resendCooldownLeft > 0}
                variant="secondary"
              >
                {resendSaving
                  ? "Sending…"
                  : resendCooldownLeft > 0
                    ? `Resend in ${resendCooldownLeft}s`
                    : "Resend confirmation email"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isAnonymous || contextIsAnonymous ? (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade guest account</CardTitle>
            <CardDescription>
              Add an email and password to keep this participant identity and all joined sessions as a full account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-3 text-sm text-[color:var(--studio-muted)]">
              You are currently signed in as a guest participant.
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor={upgradeEmailId} className="ui-form-label">Email</label>
                <Input
                  id={upgradeEmailId}
                  type="email"
                  value={upgradeEmail}
                  onChange={(e) => setUpgradeEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor={upgradePasswordId} className="ui-form-label">Password</label>
                <Input
                  id={upgradePasswordId}
                  type="password"
                  value={upgradePassword}
                  onChange={(e) => setUpgradePassword(e.target.value)}
                  placeholder="Create a password"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void upgradeGuestAccount()} disabled={upgradeSaving}>
                {upgradeSaving ? "Upgrading…" : "Upgrade account"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

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
