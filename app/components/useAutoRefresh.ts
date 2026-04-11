"use client";

import { useEffect, useRef } from "react";

type UseAutoRefreshOptions = {
  enabled?: boolean;
  intervalMs?: number;
};

export default function useAutoRefresh(
  refresh: () => Promise<void> | void,
  { enabled = true, intervalMs = 30000 }: UseAutoRefreshOptions = {}
) {
  const refreshRef = useRef(refresh);
  const runningRef = useRef(false);

  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;

    async function run() {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        await refreshRef.current();
      } finally {
        runningRef.current = false;
      }
    }

    function onFocus() {
      void run();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void run();
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void run();
      }
    }, intervalMs);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, intervalMs]);
}
