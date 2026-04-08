"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/app/components/ui/button";
import { useRoleContext, type Role } from "@/app/components/useRoleContext";
import { logClientError } from "@/lib/errors";

const ROLES: Role[] = ["admin", "facilitator", "participant"];

export default function RoleSwitcher() {
  const { loading, isPermAdmin, activeRole, refresh } = useRoleContext();
  const [busy, setBusy] = useState<Role | null>(null);

  if (loading) return null;
  if (!isPermAdmin) return null; // only permanent admins can "view as"

  async function setViewAs(r: Role) {
    setBusy(r);
    const { error } = await supabase.rpc("set_my_active_role", { p_role: r });
    if (error) {
      logClientError("RoleSwitcher.set_my_active_role", error);
      setBusy(null);
      return;
    }
    await refresh();
    setBusy(null);
  }

  return (
    <div className="space-y-1.5">
      {ROLES.map((r) => {
        const active = activeRole === r;
        return (
          <Button
            key={r}
            size="sm"
            variant="ghost"
            disabled={busy !== null}
            onClick={() => setViewAs(r)}
            className={[
              "h-10 w-full justify-between rounded-[12px] border px-3 text-xs font-semibold capitalize",
              active
                ? "border-primary/25 bg-background text-foreground shadow-sm hover:bg-background"
                : "border-[color:var(--studio-border)] bg-transparent text-[color:var(--studio-muted)] hover:border-[color:var(--studio-border-strong)] hover:bg-background/80 hover:text-foreground",
            ].join(" ")}
          >
            <span>{busy === r ? "…" : r}</span>
            <span
              className={[
                "h-2.5 w-2.5 rounded-full transition-colors",
                active ? "bg-primary" : "bg-[color:var(--studio-border)]",
              ].join(" ")}
            />
          </Button>
        );
      })}
    </div>
  );
}
