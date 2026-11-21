// @ts-check
/**
 * AEGIS-AI Shield v3.2.1 — Hardened Content Script Orchestrator & Unified DOM Observer
 * P3 Hardening:
 *  - Treats ALL main_world -> content events (BLOCKED_EVENT, VIDEO_DETECTED, LOG_EVENT) as UNTRUSTED HINTS.
 *  - Independently re-classifies BLOCKED_EVENT URLs using isolated-world state + genuine ev.isTrusted gestures.
 *  - Enforces per-minute and per-page caps on HUD prompts, video dock items, and MAIN world logs.
 */
import { BRIDGE_EVENTS, TIMINGS } from "../shared/constants.js";
import { safeTry } from "../shared/debug.js";
import { diagnoseDestinationBlock } from "../shared/url-classifier.js";
import {
  attachClickGuardListener,
  neutralizeEmptyTrapOverlays,
  neutralizeMaliciousMetaRefreshAndIframes
} from "./click-guard.js";
import { runAiDomAuditFallback } from "./dom-audit.js";
import {
  enqueueManualPrompt,
  renderTopManualHUD,
  updateTopManualHudSavedPosition
} from "./hud-manager.js";
import {
  checkAndBroadcastCaptchaStatus,
  cleanupShortlinkBypassLifecycle,
  runShortlinkDebloatedBypassStep,
  tryEarlyDirectShortlinkBypass
} from "./shortlink-bypass.js";
import {
  initStorageSync,
  isTempAllowActiveHere,
  isUrlInDeniedList,
  isValidOutboundMainEvent,
  logAegisEvent,
  onCaptchaKillSwitch,
  onRuntimeStateChange,
  runtimeState
} from "./state.js";
import {
  applySavedMiniPipPosition,
  cleanupVideoDockLifecycle,
  ensureLazyAutoSkipRunning,
  registerDetectedVideo,
  renderFloatingVideoDock,
  scanDomForVideos,
  stopLazyAutoSkip,
  updateFloatingVideoDockPosition
} from "./video-dock.js";

const RELEVANT_MUTATION_TAGS = new Set([
  "DIV",
  "SECTION",
  "ARTICLE",
  "MAIN",
  "FORM",
  "A",
  "BUTTON",
  "VIDEO",
  "SOURCE",
  "IFRAME",
  "META",
  "SCRIPT",
  "DIALOG"
]);

/**
 * Derive a safe, trusted HUD message purely from isolated-world classification reason.
 * @param {string} reason
 * @param {string} kind
 * @returns {string}
 */
function buildTrustedHudMessage(reason, kind) {
  if (reason === "media_tap_hijack") return "Redirect iklan pada pemutar video ditahan";
  if (reason === "search_hijack") return "Search Hijack (alihan mesin pencari) ditahan";
  if (reason === "hard_ad_or_gambling_pattern") return "Redirect iklan/affiliate/judol ditahan";
  if (reason === "suspicious_tld") return "Domain TLD mencurigakan ditahan";
  if (reason === "strict_cross_origin") return "Lintas-domain (Mode Strict) ditahan";
  return kind === "popup" ? "Popup/tab iklan ditahan" : "Redirect lintas domain ditahan";
}

(() => {
  "use strict";

  const win = /** @type {any} */ (window);
  if (win.__AEGIS_CONTENT_V3_LOADED__) return;
  win.__AEGIS_CONTENT_V3_LOADED__ = true;

  const storageReady = initStorageSync();

  // P3: Per-minute cap on MAIN world log events to prevent log-flood spoofing
  /** @type {number[]} */
  let mainLogMinuteTimestamps = [];

  // P3: Treat BLOCKED_EVENT from MAIN world as an UNTRUSTED HINT — re-classify independently in isolated world!
  window.addEventListener(BRIDGE_EVENTS.BLOCKED_EVENT, (ev) => {
    if (!isValidOutboundMainEvent(ev)) return;
    const d = /** @type {CustomEvent} */ (ev).detail;
    if (!d || typeof d.url !== "string" || !d.url || d.url.length > 2048) return;

    const absUrl = safeTry("content.validateBlockedUrl", () => {
      const u = new URL(d.url, location.href);
      return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
    }, "");
    if (!absUrl || isUrlInDeniedList(absUrl)) return;

    const now = Date.now();
    const recentLinkClick = now - runtimeState.lastTrustedLinkClickTs < TIMINGS.USER_GESTURE_WINDOW_MS;
    const recentMediaTap = now - runtimeState.lastTrustedMediaTapTs < TIMINGS.MEDIA_TAP_GUARD_MS;
    const mediaTapActive = recentMediaTap && !recentLinkClick;

    const verdict = diagnoseDestinationBlock(absUrl, {
      currentHref: location.href,
      trusted: runtimeState.trustedDomains,
      denied: runtimeState.deniedDomains,
      protectionMode: runtimeState.globalSettings.protectionMode || "balanced",
      strictCrossOrigin:
        runtimeState.globalSettings.protectionMode === "strict" || runtimeState.strictCrossOrigin,
      tempAllowActive: isTempAllowActiveHere(),
      captchaDetected: runtimeState.captchaDetected,
      hasRecentUserGesture: mediaTapActive ? false : recentLinkClick,
      hasRecentMediaTap: mediaTapActive,
      hasRecentAuthGesture: now - runtimeState.lastTrustedAuthTs < TIMINGS.AUTH_GESTURE_WINDOW_MS
    });

    // Drop spoofed or benign events that fail independent isolated-world classification
    if (!verdict.block || verdict.reason === "denied_blacklist") return;

    const kind = d.kind === "popup" ? "popup" : "redirect";
    enqueueManualPrompt({
      blockedUrl: absUrl,
      message: buildTrustedHudMessage(verdict.reason, kind),
      kind
    });
  });

  // P3: Treat VIDEO_DETECTED from MAIN world as an UNTRUSTED HINT (verify extension/hint or real DOM <video>)
  window.addEventListener(BRIDGE_EVENTS.VIDEO_DETECTED, (ev) => {
    if (!isValidOutboundMainEvent(ev)) return;
    const d = /** @type {CustomEvent} */ (ev).detail;
    if (!d || typeof d.url !== "string" || !d.url || d.url.length > 2048) return;
    // Never blindly trust confirmed=true from MAIN world unless a real <video> exists in the DOM
    const allowConfirmed = Boolean(d.confirmed) && Boolean(document.querySelector("video"));
    registerDetectedVideo(d.url, allowConfirmed);
  });

  // P3: Rate-limit untrusted MAIN world log events
  window.addEventListener(BRIDGE_EVENTS.LOG_EVENT, (ev) => {
    if (!isValidOutboundMainEvent(ev)) return;
    const d = /** @type {CustomEvent} */ (ev).detail;
    if (!d) return;
    const now = Date.now();
    mainLogMinuteTimestamps = mainLogMinuteTimestamps.filter((ts) => now - ts < 60000);
    if (mainLogMinuteTimestamps.length >= TIMINGS.MAIN_LOG_MAX_PER_MIN) return;
    mainLogMinuteTimestamps.push(now);
    logAegisEvent(d.level, d.code, d.toUrl, d.detail, "main_world");
  });

  // React to settings/whitelist/blacklist/tempAllow updates live
  onRuntimeStateChange(() => {
    renderTopManualHUD();
    renderFloatingVideoDock();
    applySavedMiniPipPosition();
  });

  // Attach isolated trusted user click, media-tap, auth gesture & AI Smart UGC guard
  attachClickGuardListener();

  // Pull any pending redirect prompts queued before revert (top frame only)
  if (window === window.top) {
    storageReady.then(() => {
      if (checkAndBroadcastCaptchaStatus()) return;
      safeTry("content.getPendingPrompts", () => {
        chrome.runtime.sendMessage({ type: "GET_PENDING_PROMPTS" }, (res) => {
          if (res && Array.isArray(res.prompts)) {
            res.prompts.forEach((p) => enqueueManualPrompt(p));
          }
        });
      });

      tryEarlyDirectShortlinkBypass();
    });
  }

  // =========================================================================
  // UNIFIED DEBOUNCED DOM OBSERVER — TAG-FILTERED & FROZEN WHEN HIDDEN/CAPTCHA
  // =========================================================================
  let domSweepTimer = null;
  let domSweepIdleId = null;
  let observerConnected = false;

  function cancelPendingDomSweeps() {
    if (domSweepTimer !== null) {
      clearTimeout(domSweepTimer);
      domSweepTimer = null;
    }
    if (domSweepIdleId !== null && typeof window.cancelIdleCallback === "function") {
      safeTry("content.cancelIdleCallback", () => window.cancelIdleCallback(domSweepIdleId));
      domSweepIdleId = null;
    }
  }

  function runUnifiedDomSweep() {
    if (document.hidden || runtimeState.captchaDetected) return;
    if (checkAndBroadcastCaptchaStatus()) return;
    if (window !== window.top) return;
    neutralizeMaliciousMetaRefreshAndIframes();
    scanDomForVideos();
    neutralizeEmptyTrapOverlays();
    if (!tryEarlyDirectShortlinkBypass()) {
      runShortlinkDebloatedBypassStep();
    }
  }

  function scheduleUnifiedDomSweep() {
    if (document.hidden || runtimeState.captchaDetected) return;
    cancelPendingDomSweeps();
    domSweepTimer = setTimeout(() => {
      domSweepTimer = null;
      if (document.hidden || runtimeState.captchaDetected) return;
      if (typeof window.requestIdleCallback === "function") {
        domSweepIdleId = window.requestIdleCallback(
          () => {
            domSweepIdleId = null;
            runUnifiedDomSweep();
          },
          { timeout: 400 }
        );
      } else {
        runUnifiedDomSweep();
      }
    }, TIMINGS.OBSERVER_DEBOUNCE_MS);
  }

  const unifiedObserver = new MutationObserver((mutations) => {
    if (document.hidden || runtimeState.captchaDetected) return;
    let hasRelevantElement = false;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) {
          const el = /** @type {HTMLElement} */ (node);
          if (
            el.id === "aegis-top-manual-hud" ||
            el.id === "aegis-video-bottom-dock" ||
            el.id === "aegis-bypass-toast-host" ||
            el.id === "aegis-mini-pip-drag-bar"
          ) {
            continue;
          }
          if (RELEVANT_MUTATION_TAGS.has(el.tagName)) {
            hasRelevantElement = true;
            break;
          }
        }
      }
      if (hasRelevantElement) break;
    }
    if (hasRelevantElement) {
      scheduleUnifiedDomSweep();
    }
  });

  function connectUnifiedObserver() {
    if (observerConnected || document.hidden || runtimeState.captchaDetected) return;
    if (document.documentElement) {
      unifiedObserver.observe(document.documentElement, { childList: true, subtree: true });
      observerConnected = true;
    }
  }

  function freezeAllDomActivity() {
    if (observerConnected) {
      unifiedObserver.disconnect();
      observerConnected = false;
    }
    cancelPendingDomSweeps();
    stopLazyAutoSkip();
  }

  onCaptchaKillSwitch((active) => {
    if (active) {
      freezeAllDomActivity();
    } else if (!document.hidden) {
      connectUnifiedObserver();
      ensureLazyAutoSkipRunning();
      scheduleUnifiedDomSweep();
    }
  });

  function startObserverAndLifecycle() {
    if (checkAndBroadcastCaptchaStatus()) {
      freezeAllDomActivity();
      return;
    }

    if (!document.hidden) {
      connectUnifiedObserver();
    }

    storageReady.then(() => {
      if (document.hidden || runtimeState.captchaDetected) return;
      runUnifiedDomSweep();
      if (window === window.top) {
        setTimeout(() => {
          if (!document.hidden && !runtimeState.captchaDetected) {
            runAiDomAuditFallback();
          }
        }, 2200);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserverAndLifecycle, { once: true });
  } else {
    startObserverAndLifecycle();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      freezeAllDomActivity();
    } else if (!runtimeState.captchaDetected) {
      connectUnifiedObserver();
      ensureLazyAutoSkipRunning();
      scheduleUnifiedDomSweep();
    }
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (document.hidden) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      updateTopManualHudSavedPosition();
      updateFloatingVideoDockPosition();
      applySavedMiniPipPosition();
    }, 120);
  });

  window.addEventListener("pagehide", () => {
    clearTimeout(resizeTimer);
    freezeAllDomActivity();
    cleanupVideoDockLifecycle();
    cleanupShortlinkBypassLifecycle();
  });
})();
