// app/(app)/layout.tsx
import type { ReactNode } from "react";

import AppTopbar from "@/app/components/AppTopbar";
import AppSidebar from "@/app/components/AppSidebar";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppTopbar />

      {/* Fixed sidebar (desktop) */}
      <aside className="hidden md:block fixed left-0 top-14 h-[calc(100vh-3.5rem)] w-72 border-r border-border bg-background">
        <div className="h-full overflow-y-auto p-4">
          <AppSidebar />
        </div>
      </aside>

      {/* Main content */}
      <main className="min-h-[calc(100vh-3.5rem)] px-4 py-4 md:pl-[18rem]">
        {children}
      </main>
    </div>
  );
}
