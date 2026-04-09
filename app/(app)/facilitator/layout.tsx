"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useRoleContext } from "@/app/components/useRoleContext";

export default function FacilitatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { loading, userId, activeRole, canFacilitate } = useRoleContext();

  useEffect(() => {
    if (loading) return;

    if (!userId) {
      router.replace("/");
      return;
    }

    if (!canFacilitate) {
      router.replace(activeRole === "participant" ? "/participant" : "/");
    }
  }, [loading, userId, activeRole, canFacilitate, router]);

  if (loading) return null;

  return <>{children}</>;
}
