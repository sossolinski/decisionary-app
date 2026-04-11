"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/app/components/ui/sheet";

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
        <div className="sr-only">
          <SheetTitle>Navigation menu</SheetTitle>
          <SheetDescription>
            Browse the main workspace sections and switch views.
          </SheetDescription>
        </div>
        {children}
      </SheetContent>
    </Sheet>
  );
}
