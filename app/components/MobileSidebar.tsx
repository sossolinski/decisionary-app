"use client";

import * as React from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export default function MobileSidebar({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-3 w-[320px]">
        {children}
      </SheetContent>
    </Sheet>
  );
}
