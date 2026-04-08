"use client";

import { useRoleContext } from "@/app/components/useRoleContext";

export default function RoleBadge() {
  const { loading, role, activeRole, isDisabled, activeOrg } = useRoleContext();
  if (loading) return null;

  const perm = role ?? "—";
  const view = activeRole ?? "—";

  return (
    <div className="hidden md:flex items-center gap-2 text-xs">
      <span className="rounded-[999px] border border-[color:var(--studio-border)] bg-[var(--studio-surface)] px-2 py-1">
        perm: <b>{perm}</b>
      </span>
      <span className="rounded-[999px] border border-[color:var(--studio-border)] bg-[var(--studio-surface)] px-2 py-1">
        view: <b>{view}</b>
      </span>
      {isDisabled ? (
        <span className="rounded-[999px] border border-[color:var(--studio-border)] bg-[var(--studio-surface)] px-2 py-1 text-red-400">
          disabled
        </span>
      ) : null}
      {activeOrg ? (
        <span className="rounded-[999px] border border-[color:var(--studio-border)] bg-[var(--studio-surface)] px-2 py-1 max-w-[220px] truncate">
          org: <b>{activeOrg.name}</b>
        </span>
      ) : null}
    </div>
  );
}
