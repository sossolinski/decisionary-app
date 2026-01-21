"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export default function Collapsible({
  open,
  children,
  durationMs = 220,
}: {
  open: boolean;
  children: React.ReactNode;
  durationMs?: number;
}) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number>(0);
  const [render, setRender] = useState(open);

  useEffect(() => {
    if (open) setRender(true);
  }, [open]);

  // Measure content height whenever it might change
  useLayoutEffect(() => {
    if (!render) return;
    const el = innerRef.current;
    if (!el) return;

    const measure = () => setHeight(el.scrollHeight);

    measure();

    // watch for dynamic content changes (inputs, fonts, etc.)
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    return () => ro.disconnect();
  }, [render, children]);

  // After closing animation, unmount
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => setRender(false), durationMs);
    return () => clearTimeout(t);
  }, [open, durationMs]);

  if (!render) return null;

  return (
    <div
      style={{
        overflow: "hidden",
        height: open ? height : 0,
        transition: `height ${durationMs}ms ease`,
      }}
      aria-hidden={!open}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
