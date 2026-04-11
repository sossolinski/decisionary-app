"use client";

import { useRoleContext } from "@/app/components/useRoleContext";

function humanRole(value?: string | null) {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function RoleBadge() {
  const { loading, role, activeRole, isDisabled, activeOrg } = useRoleContext();
  if (loading) return null;

  const perm = role ?? "—";
  const view = activeRole ?? "—";

  return (
    <div className="hidden xl:flex items-center">
      <div className="flex min-w-0 items-center gap-3 rounded-[14px] border border-[color:var(--studio-border)] bg-[var(--studio-surface2)] px-3 py-2 text-xs text-[color:var(--studio-muted2)]">
        <span>
          Viewing as <b className="text-foreground">{humanRole(view)}</b>
        </span>
        <span className="h-3 w-px bg-[color:var(--studio-border)]" />
        <span>
          Account access <b className="text-foreground">{humanRole(perm)}</b>
        </span>
        {activeOrg ? (
          <>
            <span className="h-3 w-px bg-[color:var(--studio-border)]" />
            <span className="max-w-[180px] truncate">
              Organization <b className="text-foreground">{activeOrg.name}</b>
            </span>
          </>
        ) : null}
        {isDisabled ? (
          <>
            <span className="h-3 w-px bg-[color:var(--studio-border)]" />
            <span className="text-destructive">Disabled</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
