export type SessionStatus = "draft" | "live" | "ended" | "unknown";

export function normalizeSessionStatus(status: string | null | undefined): SessionStatus {
  const s = String(status ?? "").trim().toLowerCase();
  if (!s) return "unknown";

  if (s === "draft" || s === "new" || s === "pending") return "draft";
  if (s === "live" || s === "active" || s === "running" || s === "started") return "live";
  if (s === "ended" || s === "closed" || s === "finished" || s === "completed") return "ended";

  return "unknown";
}

