// app/(app)/layout.tsx
import type { ReactNode } from "react";
import AppShell from "@/app/components/AppShell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[var(--studio-max)] p-6">
        {children}
      </div>
    </AppShell>
  );
}
