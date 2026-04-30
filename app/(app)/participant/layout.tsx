"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useRoleContext } from "@/app/components/useRoleContext";

export default function ParticipantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { loading, userId, activeRole } = useRoleContext();

  useEffect(() => {
    if (loading) return;

    if (!userId) {
      router.replace("/login");
      return;
    }

    if (activeRole !== "participant" && activeRole !== "admin") {
      router.replace("/facilitator");
    }
  }, [loading, userId, activeRole, router]);

  if (loading) return null;

  return <>{children}</>;
}
