"use client";

import { usePathname } from "next/navigation";
import AppShell from "@/app/components/AppShell";

export default function ClientChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Tu możesz dopisać kolejne ścieżki bez chrome, np. "/join"
  const noChrome = pathname === "/login";

  if (noChrome) return <>{children}</>;

  return <AppShell>{children}</AppShell>;
}
