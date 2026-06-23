// =============================================================================
// frontend/src/lib/friendRequestCount.ts
//
// Lightweight subscription-based counter for the number of pending incoming
// friend requests. Used to drive the badge on the Friends nav entry in both
// the desktop sidebar and the mobile bottom nav.
//
// Design notes:
//   - The Friends page itself fetches the full list; this module only cares
//     about the *length* so the badge can render without dragging the whole
//     list into the Layout tree.
//   - We expose a tiny event bus (`subscribe` / `refresh`) so any page that
//     mutates requests (accept, decline, cancel, send) can immediately
//     invalidate the cached count instead of waiting for the poll interval.
//   - The hook runs an interval poll as a safety net for cases where another
//     device sends a request — we don't have realtime subscriptions wired up
//     here, and polling every 60s is cheap on this edge function.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { socialApi } from "./api";

/** How often (ms) to re-poll the server for the incoming count. */
const POLL_INTERVAL_MS = 60_000;

type Listener = (count: number) => void;

let cachedCount: number | null = null;
let inflight: Promise<number> | null = null;
const listeners = new Set<Listener>();

/**
 * Fetch the incoming request count from the server, deduplicating concurrent
 * callers so multiple components mounting at once don't all hit the edge
 * function in parallel.
 */
async function fetchCount(): Promise<number> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await socialApi.listRequests("incoming");
      const count = res.requests?.length ?? 0;
      return count;
    } catch (err) {
      // Surface to console for dev visibility; keep the previous cached value
      // so a transient network blip doesn't zero the badge.
      console.warn("friendRequestCount: fetch failed", err);
      return cachedCount ?? 0;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function setCount(count: number) {
  cachedCount = count;
  listeners.forEach((fn) => fn(count));
}

/** Public API used by mutation sites (Friends page, etc.) to force a refresh. */
export async function refreshFriendRequestCount(): Promise<number> {
  const count = await fetchCount();
  setCount(count);
  return count;
}

/** Subscribe a listener to count changes. Returns an unsubscribe fn. */
export function subscribeFriendRequestCount(fn: Listener): () => void {
  listeners.add(fn);
  // Push current value immediately if we have one — keeps new mounts in sync
  // without waiting for the next refresh.
  if (cachedCount !== null) fn(cachedCount);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Hook returning the current incoming-request count plus a manual refresh
 * helper. Handles the initial fetch, the poll interval, and a refresh when
 * the tab regains focus (so returning users see fresh data without waiting).
 */
export function useFriendRequestCount(): { count: number; refresh: () => void } {
  const [count, setLocalCount] = useState<number>(cachedCount ?? 0);
  const mountedRef = useRef(true);

  const refresh = useCallback(() => {
    void refreshFriendRequestCount();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = subscribeFriendRequestCount(setLocalCount);

    // First load (only if we don't already have a cached value).
    if (cachedCount === null) {
      void refreshFriendRequestCount();
    }

    const interval = window.setInterval(() => {
      void refreshFriendRequestCount();
    }, POLL_INTERVAL_MS);

    const onFocus = () => {
      void refreshFriendRequestCount();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      mountedRef.current = false;
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return { count, refresh };
}
