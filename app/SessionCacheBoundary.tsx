"use client";

import { useEffect } from "react";
import { clearClientCachePrefix } from "@/lib/client-cache";

const SESSION_USER_KEY = "stock-next:session-user-id";

export default function SessionCacheBoundary({
  userId,
}: {
  userId: string | null;
}) {
  useEffect(() => {
    try {
      const nextUserId = userId || "anonymous";
      const previousUserId = window.sessionStorage.getItem(SESSION_USER_KEY);

      if (previousUserId && previousUserId !== nextUserId) {
        clearClientCachePrefix("");
      }

      window.sessionStorage.setItem(SESSION_USER_KEY, nextUserId);
    } catch {
      // Session storage is optional; pages still work without cache.
    }
  }, [userId]);

  return null;
}
