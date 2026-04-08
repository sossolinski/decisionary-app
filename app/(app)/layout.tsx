// app/(app)/layout.tsx
import AppShell from "@/app/components/AppShell";
import { RoleContextProvider } from "@/app/components/useRoleContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleContextProvider>
      <AppShell>{children}</AppShell>
    </RoleContextProvider>
  );
}
