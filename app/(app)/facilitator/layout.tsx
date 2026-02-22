"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useActiveRole } from "@/lib/useActiveRole";

export default function FacilitatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { loading, signedIn, activeRole } = useActiveRole();

  useEffect(() => {
    if (loading) return;

    if (!signedIn) {
      router.replace("/login");
      return;
    }

    if (activeRole !== "facilitator" && activeRole !== "admin") {
      router.replace("/participant");
    }
  }, [loading, signedIn, activeRole, router]);

  if (loading) return null;

  return <>{children}</>;
}
