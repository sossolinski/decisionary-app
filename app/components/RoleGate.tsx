"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRoleContext, type Role } from "@/app/components/useRoleContext";

export default function RoleGate({
  allow,
  redirectTo,
  children,
}: {
  allow: Role[];
  redirectTo?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { loading, activeRole, isDisabled } = useRoleContext();

  const allowed = !!activeRole && allow.includes(activeRole) && !isDisabled;

  useEffect(() => {
    if (!loading && !allowed && redirectTo) {
      router.replace(redirectTo);
    }
  }, [loading, allowed, redirectTo, router]);

  if (loading) return null;
  if (!allowed) return null;

  return <>{children}</>;
}
