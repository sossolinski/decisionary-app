import type { ReactNode } from "react";
import AppSidebar from "@/app/components/AppSidebar";
import AppTopbar from "@/app/components/AppTopbar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <div className="flex">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar />
          <main className="min-w-0 flex-1 p-4 md:p-6">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
