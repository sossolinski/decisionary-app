"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/app/components/ui/button";
import { useRoleContext, type Role } from "@/app/components/useRoleContext";
import { logClientError } from "@/lib/errors";

const ROLES: Role[] = ["admin", "facilitator", "participant"];

export default function RoleSwitcher() {
  const { loading, isPermAdmin, activeRole } = useRoleContext();
  const [busy, setBusy] = useState<Role | null>(null);

  if (loading) return null;
  if (!isPermAdmin) return null; // only permanent admins can "view as"

  async function setViewAs(r: Role) {
    setBusy(r);
    const { error } = await supabase.rpc("set_my_active_role", { p_role: r });
    if (error) logClientError("RoleSwitcher.set_my_active_role", error);
    setBusy(null);
  }

  return (
    <div className="hidden lg:flex items-center gap-2">
      <span className="text-xs text-[color:var(--studio-muted2)]">View as</span>
      {ROLES.map((r) => (
        <Button
          key={r}
          size="sm"
          variant={activeRole === r ? "default" : "outline"}
          disabled={busy !== null}
          onClick={() => setViewAs(r)}
          className="h-8 px-3"
        >
          {busy === r ? "…" : r}
        </Button>
      ))}
    </div>
  );
}
