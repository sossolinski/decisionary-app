export type AppRole = "admin" | "facilitator" | "participant";

export type Capability =
  | "org:read"
  | "org:write"
  | "users:invite"
  | "users:manage"
  | "scenario:read"
  | "scenario:write"
  | "session:read"
  | "session:write"
  | "participant:manage";

const ROLE_CAPABILITIES: Record<AppRole, Capability[]> = {
  admin: [
    "org:read",
    "org:write",
    "users:invite",
    "users:manage",
    "scenario:read",
    "scenario:write",
    "session:read",
    "session:write",
    "participant:manage",
  ],
  facilitator: [
    "org:read",
    "users:invite",
    "users:manage",
    "scenario:read",
    "scenario:write",
    "session:read",
    "session:write",
    "participant:manage",
  ],
  participant: ["session:read"],
};

export function hasCapability(
  role: AppRole | null | undefined,
  capability: Capability
): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role].includes(capability);
}

