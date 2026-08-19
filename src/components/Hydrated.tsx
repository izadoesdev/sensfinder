"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/store/settings";

/**
 * Gates rendering until persisted settings have been read from localStorage.
 *
 * The store deliberately skips automatic hydration: it would populate on the client
 * but not on the server, and React would flag the mismatch. Reading it here, after
 * mount, keeps the first paint identical on both sides.
 */
export function Hydrated({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(useSettings.persist.rehydrate()).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <>{ready ? children : fallback}</>;
}
