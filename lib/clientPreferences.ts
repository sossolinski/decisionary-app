"use client";

export type ThemePreference = "auto" | "light" | "dark";
export type LanguagePreference = "en" | "pl";
export type NotificationPreference = {
  productUpdates: boolean;
  exerciseAlerts: boolean;
  rosterChanges: boolean;
};

export const THEME_PREFERENCE_KEY = "decisionary.theme";
export const LANGUAGE_PREFERENCE_KEY = "decisionary.language";
export const NOTIFICATION_PREFERENCE_KEY = "decisionary.notifications";

function canUseDOM() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function readThemePreference(): ThemePreference {
  if (!canUseDOM()) return "auto";
  const raw = window.localStorage.getItem(THEME_PREFERENCE_KEY);
  return raw === "light" || raw === "dark" || raw === "auto" ? raw : "auto";
}

export function saveThemePreference(value: ThemePreference) {
  if (!canUseDOM()) return;
  window.localStorage.setItem(THEME_PREFERENCE_KEY, value);
}

export function applyThemePreference(value: ThemePreference) {
  if (!canUseDOM()) return;
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const useDark = value === "dark" || (value === "auto" && prefersDark);
  root.classList.toggle("dark", useDark);
}

export function readLanguagePreference(): LanguagePreference {
  if (!canUseDOM()) return "en";
  const raw = window.localStorage.getItem(LANGUAGE_PREFERENCE_KEY);
  return raw === "pl" || raw === "en" ? raw : "en";
}

export function saveLanguagePreference(value: LanguagePreference) {
  if (!canUseDOM()) return;
  window.localStorage.setItem(LANGUAGE_PREFERENCE_KEY, value);
}

export function applyLanguagePreference(value: LanguagePreference) {
  if (!canUseDOM()) return;
  document.documentElement.lang = value;
}

export function readNotificationPreference(): NotificationPreference {
  if (!canUseDOM()) {
    return { productUpdates: true, exerciseAlerts: true, rosterChanges: true };
  }

  const raw = window.localStorage.getItem(NOTIFICATION_PREFERENCE_KEY);
  if (!raw) {
    return { productUpdates: true, exerciseAlerts: true, rosterChanges: true };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      productUpdates: parsed?.productUpdates !== false,
      exerciseAlerts: parsed?.exerciseAlerts !== false,
      rosterChanges: parsed?.rosterChanges !== false,
    };
  } catch {
    return { productUpdates: true, exerciseAlerts: true, rosterChanges: true };
  }
}

export function saveNotificationPreference(value: NotificationPreference) {
  if (!canUseDOM()) return;
  window.localStorage.setItem(NOTIFICATION_PREFERENCE_KEY, JSON.stringify(value));
}
