// @ts-check
/**
 * AEGIS-AI Shield v3.2.0 — SPA-Aware Anti-History Trap Guard
 * Protects against pushState flooding, replaceState rewriting traps, and popstate-triggered
 * history.forward()/go(+n) Back-button hijacks while keeping React Router, Next.js, and Vue Router smooth.
 */
import { TIMINGS } from "./constants.js";
import { safeTry } from "./debug.js";

/**
 * Normalize a pushState/replaceState target URL into a canonical route key (origin + pathname + search)
 * so hash-spam or identical-path trap loops are accurately distinguished from genuine route changes.
 * @param {string | URL | null | undefined} targetUrl
 * @param {string} currentHref
 * @returns {{ routeKey: string, isHashOnly: boolean }}
 */
export function normalizeHistoryRouteKey(targetUrl, currentHref) {
  return safeTry(
    "historyGuard.normalizeRoute",
    () => {
      const cur = new URL(currentHref);
      if (targetUrl === undefined || targetUrl === null || targetUrl === "") {
        return { routeKey: `${cur.origin}${cur.pathname}${cur.search}`, isHashOnly: true };
      }
      const next = new URL(String(targetUrl), cur.href);
      const curKey = `${cur.origin}${cur.pathname}${cur.search}`;
      const nextKey = `${next.origin}${next.pathname}${next.search}`;
      const isHashOnly = curKey === nextKey;
      return { routeKey: nextKey, isHashOnly };
    },
    { routeKey: String(currentHref || ""), isHashOnly: true }
  );
}

/**
 * Create a stateful, SPA-aware history trap detector covering pushState, replaceState, and forward/go hijacks.
 * @param {object} [opts]
 * @param {number} [opts.windowMs]
 * @param {number} [opts.maxDistinctNonGestureCalls]
 * @param {number} [opts.maxDuplicateNonGestureCalls]
 * @param {number} [opts.maxReplaceNonGestureCalls]
 * @param {number} [opts.userGestureWindowMs]
 * @param {number} [opts.popStateGraceMs]
 */
export function createHistoryFloodDetector(opts = {}) {
  const windowMs = Number(opts.windowMs) || TIMINGS.HISTORY_FLOOD_WINDOW_MS;
  const maxDistinct = Number(opts.maxDistinctNonGestureCalls) || TIMINGS.HISTORY_FLOOD_MAX_CALLS;
  const maxDuplicates = Number(opts.maxDuplicateNonGestureCalls) || TIMINGS.HISTORY_FLOOD_MAX_DUPES;
  const maxReplaces = Number(opts.maxReplaceNonGestureCalls) || TIMINGS.HISTORY_REPLACE_MAX_CALLS;
  const userGestureWindowMs = Number(opts.userGestureWindowMs) || 1600;
  const popStateGraceMs = Number(opts.popStateGraceMs) || TIMINGS.POPSTATE_GRACE_MS;

  /** @type {Array<{ ts: number, routeKey: string, isHashOnly: boolean }>} */
  const pushEvents = [];
  /** @type {Array<{ ts: number, routeKey: string, isHashOnly: boolean }>} */
  const replaceEvents = [];

  return {
    /**
     * Evaluate whether a history.pushState call should be blocked.
     * @param {object} params
     * @param {number} params.now
     * @param {number} [params.lastUserGestureTs]
     * @param {number} [params.lastAuthGestureTs]
     * @param {number} [params.lastPopStateTs]
     * @param {string | URL | null | undefined} [params.targetUrl]
     * @param {string} params.currentHref
     * @returns {{ block: boolean, reason: string }}
     */
    shouldBlockPush({
      now,
      lastUserGestureTs = 0,
      lastAuthGestureTs = 0,
      lastPopStateTs = 0,
      targetUrl,
      currentHref
    }) {
      if (lastAuthGestureTs > 0 && now - lastAuthGestureTs < TIMINGS.AUTH_GESTURE_WINDOW_MS) {
        return { block: false, reason: "auth_grace" };
      }

      const duringPopState = lastPopStateTs > 0 && now - lastPopStateTs < popStateGraceMs;
      const { routeKey, isHashOnly } = normalizeHistoryRouteKey(targetUrl, currentHref);

      // Even if user clicked slightly earlier, a popstate event followed immediately by hash/same-route re-push is a Back-button trap
      if (duringPopState && isHashOnly) {
        return { block: true, reason: "popstate_trap_repush" };
      }

      if (lastUserGestureTs > 0 && now - lastUserGestureTs < userGestureWindowMs) {
        return { block: false, reason: "user_gesture" };
      }

      while (pushEvents.length > 0 && now - pushEvents[0].ts > windowMs) {
        pushEvents.shift();
      }

      pushEvents.push({ ts: now, routeKey, isHashOnly });

      let sameRouteCount = 0;
      let hashSpamCount = 0;
      for (const ev of pushEvents) {
        if (ev.routeKey === routeKey) sameRouteCount += 1;
        if (ev.isHashOnly) hashSpamCount += 1;
      }

      if (duringPopState && sameRouteCount >= 2) {
        return { block: true, reason: "popstate_trap_repush" };
      }

      if (sameRouteCount >= maxDuplicates || hashSpamCount >= maxDuplicates) {
        return { block: true, reason: "duplicate_or_hash_flood" };
      }

      if (pushEvents.length > maxDistinct) {
        return { block: true, reason: "rapid_non_gesture_flood" };
      }

      return { block: false, reason: "spa_route_allowed" };
    },

    /**
     * Evaluate whether a history.replaceState call is a suspicious Back-button rewrite trap or flood.
     * Allows normal SPA state/scroll/query updates and user-gesture updates.
     * @param {object} params
     * @param {number} params.now
     * @param {number} [params.lastUserGestureTs]
     * @param {number} [params.lastAuthGestureTs]
     * @param {number} [params.lastPopStateTs]
     * @param {string | URL | null | undefined} [params.targetUrl]
     * @param {string} params.currentHref
     * @returns {{ block: boolean, reason: string }}
     */
    shouldBlockReplace({
      now,
      lastUserGestureTs = 0,
      lastAuthGestureTs = 0,
      lastPopStateTs = 0,
      targetUrl,
      currentHref
    }) {
      if (lastAuthGestureTs > 0 && now - lastAuthGestureTs < TIMINGS.AUTH_GESTURE_WINDOW_MS) {
        return { block: false, reason: "auth_grace" };
      }

      const duringPopState = lastPopStateTs > 0 && now - lastPopStateTs < popStateGraceMs;
      const { routeKey, isHashOnly } = normalizeHistoryRouteKey(targetUrl, currentHref);

      while (replaceEvents.length > 0 && now - replaceEvents[0].ts > windowMs) {
        replaceEvents.shift();
      }
      replaceEvents.push({ ts: now, routeKey, isHashOnly });

      let sameRouteCount = 0;
      for (const ev of replaceEvents) {
        if (ev.routeKey === routeKey) sameRouteCount += 1;
      }

      // Back-button trap: rewriting URL repeatedly right inside popstate
      if (duringPopState && sameRouteCount >= 2 && isHashOnly) {
        return { block: true, reason: "popstate_replace_trap" };
      }

      if (lastUserGestureTs > 0 && now - lastUserGestureTs < userGestureWindowMs) {
        return { block: false, reason: "user_gesture" };
      }

      // Rapid non-gesture replaceState spam (e.g. URL oscillation / anti-back trap)
      if (replaceEvents.length > maxReplaces && sameRouteCount >= maxDuplicates) {
        return { block: true, reason: "replace_state_flood" };
      }

      return { block: false, reason: "spa_replace_allowed" };
    },

    /**
     * Evaluate whether a programmatic history.forward() or history.go(n >= 0) call is cancelling a user's Back press.
     * @param {object} params
     * @param {number} params.now
     * @param {number} [params.delta]
     * @param {number} [params.lastUserGestureTs]
     * @param {number} [params.lastPopStateTs]
     * @returns {{ block: boolean, reason: string }}
     */
    shouldBlockForwardTrap({ now, delta = 1, lastUserGestureTs = 0, lastPopStateTs = 0 }) {
      const numericDelta = Number(delta);
      if (!Number.isFinite(numericDelta) || numericDelta < 0) {
        return { block: false, reason: "back_nav_allowed" };
      }
      if (lastUserGestureTs > 0 && now - lastUserGestureTs < 700) {
        return { block: false, reason: "user_gesture" };
      }
      const duringPopState = lastPopStateTs > 0 && now - lastPopStateTs < 950;
      if (duringPopState) {
        return { block: true, reason: "popstate_forward_cancel_trap" };
      }
      return { block: false, reason: "normal_forward_allowed" };
    },

    reset() {
      pushEvents.length = 0;
      replaceEvents.length = 0;
    }
  };
}
