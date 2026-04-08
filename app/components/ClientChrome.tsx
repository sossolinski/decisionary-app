"use client";

import { usePathname } from "next/navigation";
import AppShell from "@/app/components/AppShell";

export default function ClientChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Add more routes without chrome here, e.g. "/join"
  const noChrome = pathname === "/login";

  if (noChrome) return <>{children}</>;

  return <AppShell>{children}</AppShell>;
}
