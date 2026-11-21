// @ts-check
/**
 * AEGIS-AI Shield v3.2.4 — MAIN World Hardened Native API Guard
 * v3.2.1–v3.2.4 upgrades:
 *  - Video-Tap vs Link-Click Gesture Guard: distinguishes <video>/media taps from <a href> clicks
 *    so first-touch video ad hijacks (pointerdown/touchstart/click -> location.href) are blocked
 *    synchronously in-page via Navigation API without page reload or custom-player conflicts.
 *  - P1/P2: Shares unified url-classifier (split gambling regex + OAuth-before-hard precedence).
 *  - P6: Narrowed countdown selectors & word-boundary regex + 500ms TTL cache & non-video/non-shortlink bailout.
 *  - P7: Timer acceleration defaults OFF (opt-in via popup).
 */
import {
  ANTI_ADBLOCK_PROBE_HOST_REGEX,
  BRIDGE_EVENTS,
  NON_VIDEO_ASSET_REGEX,
  TIMINGS,
  VIDEO_EXT_REGEX,
  VIDEO_MIME_REGEX,
  VIDEO_STREAM_HINT_REGEX
} from "../shared/constants.js";
import { isCaptchaChallengeUrl } from "../shared/captcha-guard.js";
import { safeTry } from "../shared/debug.js";
import { getHostname, isDomainInList, isSameSafeEcosystem } from "../shared/domain-utils.js";
import { createHistoryFloodDetector } from "../shared/history-guard.js";
import { diagnoseDestinationBlock, isAuthFlowUrl } from "../shared/url-classifier.js";

(() => {
  "use strict";

  const win = /** @type {any} */ (window);
  const LOCK_SYM = Symbol.for("aegis.mw.v32");
  if (win[LOCK_SYM]) return;
  try {
    Object.defineProperty(win, LOCK_SYM, { value: true, configurable: false, enumerable: false });
  } catch {
    win[LOCK_SYM] = true;
  }

  // Capture primordial DOM event primitives BEFORE any webpage script executes
  const origAddEventListener = window.addEventListener.bind(window);
  const origDispatchEvent = window.dispatchEvent.bind(window);
  const origStopImmediatePropagation = Event.prototype.stopImmediatePropagation;
  const NativeCustomEvent = window.CustomEvent;

  const isInitialChallengeOrOpaque = () =>
    safeTry(
      "main_world.initialCheck",
      () => {
        const proto = location.protocol || "";
        const host = (location.hostname || "").toLowerCase();
        if (proto !== "http:" && proto !== "https:") return true;
        if (!host || window.origin === "null") return true;
        if (win._cf_chl_opt) return true;
        return isCaptchaChallengeUrl(location.href);
      },
      true
    );

  if (isInitialChallengeOrOpaque()) return;

  const initialHost = (location.hostname || "").toLowerCase();
  if (isSameSafeEcosystem(initialHost, initialHost)) return;

  // =========================================================================
  // TOKENIZED BRIDGE (content -> main_world protected by capture-phase swallow;
  // main_world -> content treated as untrusted hints re-validated in content.js)
  // =========================================================================
  let inboundToken = "";
  let outboundToken = "";
  let handshakeLocked = false;
  /** @type {Array<{ eventName: string, payload: Record<string, any> }>} */
  const preHandshakeQueue = [];

  function dispatchAuthenticated(eventName, payload) {
    if (!handshakeLocked || !outboundToken) {
      if (preHandshakeQueue.length < 12) {
        preHandshakeQueue.push({ eventName, payload });
      }
      return;
    }
    safeTry("main_world.dispatchBridge", () => {
      origDispatchEvent(
        new NativeCustomEvent(eventName, {
          detail: { ...payload, token: outboundToken }
        })
      );
    });
  }

  function flushPreHandshakeQueue() {
    if (!handshakeLocked || !outboundToken || preHandshakeQueue.length === 0) return;
    const queued = preHandshakeQueue.splice(0, preHandshakeQueue.length);
    for (const item of queued) {
      dispatchAuthenticated(item.eventName, item.payload);
    }
  }

  // Capture phase ensures our listener executes FIRST (before any webpage script) and swallows inboundToken
  origAddEventListener(
    BRIDGE_EVENTS.HANDSHAKE_INIT,
    (ev) => {
      const detail = ev && /** @type {CustomEvent} */ (ev).detail;
      const inTok = detail && typeof detail.inboundToken === "string" ? detail.inboundToken : "";
      const outTok = detail && typeof detail.outboundToken === "string" ? detail.outboundToken : "";
      if (inTok.length < 24 || outTok.length < 24 || inTok === outTok) return;
      safeTry("main_world.swallowHandshake", () => origStopImmediatePropagation.call(ev));
      if (!handshakeLocked) {
        inboundToken = inTok;
        outboundToken = outTok;
        handshakeLocked = true;
      }
      if (inTok === inboundToken) {
        safeTry("main_world.handshakeAck", () => {
          origDispatchEvent(
            new NativeCustomEvent(BRIDGE_EVENTS.HANDSHAKE_ACK, {
              detail: { token: outboundToken }
            })
          );
        });
        flushPreHandshakeQueue();
      }
    },
    true
  );

  const state = {
    trusted: /** @type {string[]} */ ([]),
    denied: /** @type {string[]} */ ([]),
    protectionMode: "balanced",
    strictCrossOrigin: false,
    autoSkipCountdown: false, // P7: opt-in default OFF
    antiHistoryTrap: true,
    antiAntiAdblock: true,
    captchaKillSwitchEnabled: true,
    loggingEnabled: true,
    tempAllowActive: false,
    captchaDetected: false,
    hooksActive: false,
    lastUserClick: 0,
    lastMediaTap: 0,
    lastAuthClick: 0,
    lastShortlinkCta: 0,
    lastPopState: 0
  };

  function isValidInboundEvent(ev) {
    return Boolean(
      handshakeLocked &&
        inboundToken &&
        ev &&
        ev.detail &&
        typeof ev.detail.token === "string" &&
        ev.detail.token === inboundToken
    );
  }

  function emitAegisLog(level, code, toUrl, detail) {
    if (!state.loggingEnabled) return;
    dispatchAuthenticated(BRIDGE_EVENTS.LOG_EVENT, {
      level: level || "WARN",
      source: "main_world",
      code: code || "MAIN_WORLD_EVENT",
      fromUrl: location.href,
      toUrl: toUrl ? String(toUrl) : "",
      detail: detail ? String(detail) : ""
    });
  }

  function emitBlocked(url, kind, reason = "") {
    if (url && isDomainInList(url, state.denied, location.href)) return;
    dispatchAuthenticated(BRIDGE_EVENTS.BLOCKED_EVENT, {
      url: String(url || ""),
      kind,
      reason: String(reason || "")
    });
  }

  function reportVideoCandidate(rawUrl, isConfirmedMime = false) {
    safeTry("main_world.reportVideo", () => {
      if (!rawUrl) return;
      const rawStr = String(rawUrl).trim();
      if (
        rawStr.startsWith("data:") ||
        rawStr.startsWith("blob:") ||
        rawStr.startsWith("javascript:")
      ) {
        return;
      }
      const absUrl = new URL(rawStr, location.href).href;
      if (!absUrl.startsWith("http") || NON_VIDEO_ASSET_REGEX.test(absUrl)) return;
      if (
        isConfirmedMime ||
        VIDEO_EXT_REGEX.test(absUrl) ||
        VIDEO_STREAM_HINT_REGEX.test(absUrl)
      ) {
        dispatchAuthenticated(BRIDGE_EVENTS.VIDEO_DETECTED, {
          url: absUrl,
          confirmed: isConfirmedMime
        });
      }
    });
  }

  function maskAsNative(wrapperFn, nativeFn) {
    safeTry("main_world.maskAsNative", () => {
      const nativeStr = Function.prototype.toString.call(nativeFn);
      Object.defineProperty(wrapperFn, "toString", {
        value: function () {
          return nativeStr;
        },
        writable: true,
        configurable: true
      });
    });
    return wrapperFn;
  }

  /**
   * Distinguish tapping a <video>/<audio> player or video wrapper from clicking a navigation link/button.
   * Prevents first-touch video ad hijacks (Android pointerdown/touchstart & iOS/Desktop click on #videoArea)
   * without breaking custom video players (Plyr, Video.js, JWPlayer).
   * @param {EventTarget | null} rawTarget
   * @returns {boolean}
   */
  function isMediaPlayerTapTarget(rawTarget) {
    return safeTry(
      "main_world.isMediaTarget",
      () => {
        if (!rawTarget || /** @type {Node} */ (rawTarget).nodeType !== 1) return false;
        const el = /** @type {HTMLElement} */ (rawTarget);
        // Never treat genuine links, form inputs, or submit controls as a media tap
        if (el.closest("a[href], button, input, select, textarea, [role='link']")) {
          // Exception: play/mute/fullscreen buttons inside a custom video player should NOT allow cross-origin redirects either,
          // UNLESS it is an explicit <a href> link. If it's a <button> inside a video player container with no href, treat as media tap!
          if (el.closest("a[href], input, select, textarea, [role='link']")) return false;
          const btnParent = el.parentElement;
          if (btnParent && btnParent.closest(".video-js, .plyr, .jwplayer, .dplayer, .artplayer-app, [class*='video-area'], [id*='videoArea']")) {
            return true;
          }
          return false;
        }
        if (el.tagName === "VIDEO" || el.tagName === "AUDIO" || el.closest("video, audio")) {
          return true;
        }
        // Check immediate video wrapper (e.g. <div class="video-area" id="videoArea"><video ...></div>)
        let cur = el;
        for (let depth = 0; cur && depth < 3; depth++) {
          if (cur.tagName === "BODY" || cur.tagName === "HTML" || cur.tagName === "MAIN") break;
          if (cur.querySelector && cur.querySelector("video") && !cur.querySelector("a[href]")) {
            return true;
          }
          cur = cur.parentElement;
        }
        return false;
      },
      false
    );
  }

  // Record genuine user gestures (ev.isTrusted === true ONLY) and separate Media Taps from Link Clicks
  function recordUserGesture(ev) {
    if (!ev || !ev.isTrusted) return;
    const now = Date.now();
    if (isMediaPlayerTapTarget(ev.target)) {
      state.lastMediaTap = now;
      // Do NOT set lastUserClick so cross-origin ad hijacks on <video> are blocked synchronously!
      // Fallback ONLY for legacy browsers lacking Navigation API on pure native <video controls>:
      if (
        !win.navigation &&
        !state.tempAllowActive &&
        !state.captchaDetected &&
        ev.target &&
        /** @type {HTMLElement} */ (ev.target).tagName === "VIDEO" &&
        /** @type {HTMLElement} */ (ev.target).hasAttribute("controls") &&
        !/** @type {HTMLElement} */ (ev.target).closest("a[href]")
      ) {
        safeTry("main_world.nativeVideoTapShield", () => {
          origStopImmediatePropagation.call(ev);
        });
      }
      return;
    }
    state.lastUserClick = now;
    state.lastMediaTap = 0;
  }

  document.addEventListener("pointerdown", recordUserGesture, true);
  document.addEventListener("touchstart", recordUserGesture, { capture: true, passive: true });
  document.addEventListener("click", recordUserGesture, true);
  document.addEventListener(
    "keydown",
    (ev) => {
      if (!ev || !ev.isTrusted) return;
      state.lastUserClick = Date.now();
      state.lastMediaTap = 0;
      if (ev.key === "Enter" && document.querySelector("input[type='password']")) {
        state.lastAuthClick = Date.now();
      }
    },
    true
  );
  document.addEventListener(
    "submit",
    (ev) => {
      if (!ev || !ev.isTrusted) return;
      const now = Date.now();
      state.lastUserClick = now;
      state.lastMediaTap = 0;
      state.lastAuthClick = now;
    },
    true
  );
  origAddEventListener(
    "popstate",
    () => {
      state.lastPopState = Date.now();
    },
    true
  );

  // =========================================================================
  // NATIVE API REFERENCES & REVERSIBLE HOOK MANAGEMENT (RESTORE & RE-ENGAGE)
  // =========================================================================
  const origFetch = window.fetch;
  const origXhrOpen = XMLHttpRequest.prototype.open;
  const origOpen = window.open;
  const origAnchorClick = HTMLAnchorElement.prototype.click;
  const origPushState = history.pushState;
  const origReplaceState = history.replaceState;
  const origHistoryForward = history.forward;
  const origHistoryGo = history.go;
  const origSetInterval = window.setInterval;
  const origSetTimeout = window.setTimeout;
  const origMediaSrcDesc = safeTry(
    "main_world.captureMediaDesc",
    () => Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src") || null,
    null
  );
  const origAddSB =
    window.MediaSource && MediaSource.prototype.addSourceBuffer
      ? MediaSource.prototype.addSourceBuffer
      : null;

  const historyFloodDetector = createHistoryFloodDetector();

  function getGestureContext(isUserEvent = false) {
    const now = Date.now();
    const recentLinkClick = now - state.lastUserClick < TIMINGS.USER_GESTURE_WINDOW_MS;
    const recentMediaTap = now - state.lastMediaTap < TIMINGS.MEDIA_TAP_GUARD_MS;
    const mediaTapActive = recentMediaTap && !recentLinkClick;
    return {
      hasRecentUserGesture: mediaTapActive ? false : Boolean(isUserEvent || recentLinkClick),
      hasRecentMediaTap: mediaTapActive,
      hasRecentAuthGesture: now - state.lastAuthClick < TIMINGS.AUTH_GESTURE_WINDOW_MS,
      hasRecentShortlinkCta: now - state.lastShortlinkCta < 7000
    };
  }

  function diagnose(urlStr, isUserEvent = false) {
    const gctx = getGestureContext(isUserEvent);
    return diagnoseDestinationBlock(urlStr, {
      currentHref: location.href,
      trusted: state.trusted,
      denied: state.denied,
      strictCrossOrigin: state.strictCrossOrigin,
      protectionMode: state.protectionMode,
      tempAllowActive: state.tempAllowActive,
      captchaDetected:
        state.captchaKillSwitchEnabled &&
        (state.captchaDetected || isCaptchaChallengeUrl(location.href)),
      hasRecentUserGesture: gctx.hasRecentUserGesture,
      hasRecentMediaTap: gctx.hasRecentMediaTap,
      hasRecentAuthGesture: gctx.hasRecentAuthGesture,
      hasRecentShortlinkCta: gctx.hasRecentShortlinkCta
    });
  }

  // =========================================================================
  // HOOK IMPLEMENTATIONS
  // =========================================================================
  function isAntiAdblockFetchProbe(reqUrl, initObj) {
    if (!reqUrl || !state.antiAntiAdblock || state.tempAllowActive || state.captchaDetected) {
      return false;
    }
    return safeTry(
      "main_world.isAdblockProbe",
      () => {
        const u = new URL(reqUrl, location.href);
        const host = u.hostname.toLowerCase();
        if (!ANTI_ADBLOCK_PROBE_HOST_REGEX.test(host) && !isDomainInList(u.href, state.denied)) {
          return false;
        }
        const mode =
          initObj && typeof initObj === "object" ? String(initObj.mode || "").toLowerCase() : "";
        if (mode === "no-cors") return true;
        return (
          ANTI_ADBLOCK_PROBE_HOST_REGEX.test(host) &&
          (u.pathname === "/" || u.search.includes("t="))
        );
      },
      false
    );
  }

  const wrappedFetch = maskAsNative(function (input, init) {
    const reqUrl = typeof input === "string" ? input : input && input.url ? input.url : "";
    reportVideoCandidate(reqUrl, false);
    const isAdblockProbe = isAntiAdblockFetchProbe(reqUrl, init);
    const p = origFetch.apply(this, arguments);
    if (p && typeof p.then === "function") {
      const handled = p.then((res) => {
        safeTry("main_world.fetchMime", () => {
          if (res && res.headers) {
            const ct = res.headers.get("content-type") || "";
            if (VIDEO_MIME_REGEX.test(ct)) reportVideoCandidate(res.url || reqUrl, true);
          }
        });
        return res;
      });
      if (isAdblockProbe) {
        return handled.catch(() => {
          emitAegisLog(
            "BYPASS",
            "BYPASS_ANTI_ADBLOCK_FETCH",
            reqUrl,
            "Probe anti-adblock fetch(no-cors) dinetralkan -> respons 200 OK palsu"
          );
          return safeTry(
            "main_world.fakeResponse",
            () => new Response("", { status: 200, statusText: "OK" }),
            { ok: true, status: 200, type: "opaque", text: async () => "" }
          );
        });
      }
      return handled;
    }
    return p;
  }, origFetch);

  const wrappedXhrOpen = maskAsNative(function (method, url) {
    safeTry("main_world.xhrOpen", () => {
      this.__aegisXhrUrl = url ? String(url) : "";
      reportVideoCandidate(this.__aegisXhrUrl, false);
      this.addEventListener("readystatechange", function () {
        safeTry("main_world.xhrMime", () => {
          if (this.readyState >= 2) {
            const ct = this.getResponseHeader("content-type") || "";
            if (VIDEO_MIME_REGEX.test(ct)) {
              reportVideoCandidate(this.responseURL || this.__aegisXhrUrl, true);
            }
          }
        });
      });
    });
    return origXhrOpen.apply(this, arguments);
  }, origXhrOpen);

  const wrappedOpen = maskAsNative(function (url) {
    const resolved = url
      ? safeTry("main_world.openResolve", () => new URL(url, location.href).href, "")
      : "";

    // Blacklist ALWAYS wins over Temporary Allow & CAPTCHA kill-switch
    if (resolved && isDomainInList(resolved, state.denied, location.href)) {
      emitAegisLog(
        "BLOCK",
        "BLOCK_WINDOW_OPEN_BLACKLIST",
        resolved,
        "window.open diblokir senyap (Blacklist)"
      );
      return null;
    }

    if (state.captchaDetected || state.tempAllowActive) {
      return origOpen.apply(this, arguments);
    }

    const gctx = getGestureContext(false);

    if (resolved) {
      const curHost = location.hostname.toLowerCase();
      const destHost = getHostname(resolved);
      if (isDomainInList(resolved, state.trusted) || isSameSafeEcosystem(curHost, destHost)) {
        return origOpen.apply(this, arguments);
      }
      if (
        (gctx.hasRecentUserGesture || gctx.hasRecentAuthGesture) &&
        (isAuthFlowUrl(resolved) || gctx.hasRecentAuthGesture) &&
        !diagnose(resolved, true).block
      ) {
        return origOpen.apply(this, arguments);
      }
    } else if (gctx.hasRecentUserGesture && gctx.hasRecentAuthGesture) {
      return origOpen.apply(this, arguments);
    }

    const diag = diagnose(resolved, gctx.hasRecentUserGesture);
    if (!resolved || diag.block) {
      emitAegisLog(
        "BLOCK",
        diag.reason === "media_tap_hijack" ? "BLOCK_VIDEO_TAP_POPUP" : "BLOCK_WINDOW_OPEN",
        resolved || location.href,
        `window.open ditahan | mode=${state.protectionMode} | reason=${diag.reason} | userGesture=${gctx.hasRecentUserGesture} | mediaTap=${gctx.hasRecentMediaTap}`
      );
      emitBlocked(resolved || location.href, "popup", diag.reason);
      return null;
    }
    return origOpen.apply(this, arguments);
  }, origOpen);

  const wrappedAnchorClick = maskAsNative(function () {
    const blocked = safeTry(
      "main_world.anchorClick",
      () => {
        const href = this.getAttribute("href") || this.href || "";
        if (!href) return false;
        const abs = safeTry("main_world.anchorHref", () => new URL(href, location.href).href, "");
        if (!abs) return false;

        // Blacklist ALWAYS wins over Temporary Allow & CAPTCHA
        if (isDomainInList(abs, state.denied, location.href)) {
          emitAegisLog(
            "BLOCK",
            "BLOCK_ANCHOR_JS_BLACKLIST",
            abs,
            "HTMLAnchorElement.click() diblokir senyap (Blacklist)"
          );
          return true;
        }

        if (state.captchaDetected || state.tempAllowActive) return false;

        const gctx = getGestureContext(false);
        const diag = diagnose(abs, gctx.hasRecentUserGesture);
        if (diag.block) {
          emitAegisLog(
            "BLOCK",
            "BLOCK_ANCHOR_JS_CLICK",
            abs,
            `HTMLAnchorElement.click() ditahan | reason=${diag.reason} | userGesture=${gctx.hasRecentUserGesture} | mediaTap=${gctx.hasRecentMediaTap}`
          );
          emitBlocked(abs, this.target === "_blank" ? "popup" : "redirect", diag.reason);
          return true;
        }
        return false;
      },
      false
    );
    if (blocked) return;
    return origAnchorClick.apply(this, arguments);
  }, origAnchorClick);

  const wrappedPushState = maskAsNative(function (st, title, url) {
    if (!state.antiHistoryTrap || state.tempAllowActive || state.captchaDetected) {
      return origPushState.apply(this, arguments);
    }
    const shouldDrop = safeTry(
      "main_world.pushState",
      () => {
        if (isDomainInList(location.href, state.trusted)) return false;
        const decision = historyFloodDetector.shouldBlockPush({
          now: Date.now(),
          lastUserGestureTs: state.lastUserClick,
          lastAuthGestureTs: state.lastAuthClick,
          lastPopStateTs: state.lastPopState,
          targetUrl: url,
          currentHref: location.href
        });
        if (decision.block) {
          emitAegisLog(
            "BLOCK",
            "BLOCK_HISTORY_FLOOD",
            url ? String(url) : location.href,
            `history.pushState flooding ditahan (${decision.reason})`
          );
          return true;
        }
        return false;
      },
      false
    );
    if (shouldDrop) return;
    return origPushState.apply(this, arguments);
  }, origPushState);

  const wrappedReplaceState = maskAsNative(function (st, title, url) {
    if (!state.antiHistoryTrap || state.tempAllowActive || state.captchaDetected) {
      return origReplaceState.apply(this, arguments);
    }
    const shouldDrop = safeTry(
      "main_world.replaceState",
      () => {
        if (isDomainInList(location.href, state.trusted)) return false;
        const decision = historyFloodDetector.shouldBlockReplace({
          now: Date.now(),
          lastUserGestureTs: state.lastUserClick,
          lastAuthGestureTs: state.lastAuthClick,
          lastPopStateTs: state.lastPopState,
          targetUrl: url,
          currentHref: location.href
        });
        if (decision.block) {
          emitAegisLog(
            "BLOCK",
            "BLOCK_HISTORY_REPLACE_TRAP",
            url ? String(url) : location.href,
            `history.replaceState trap ditahan (${decision.reason})`
          );
          return true;
        }
        return false;
      },
      false
    );
    if (shouldDrop) return;
    return origReplaceState.apply(this, arguments);
  }, origReplaceState);

  const wrappedHistoryForward = maskAsNative(function () {
    if (state.antiHistoryTrap && !state.tempAllowActive && !state.captchaDetected) {
      const decision = historyFloodDetector.shouldBlockForwardTrap({
        now: Date.now(),
        delta: 1,
        lastUserGestureTs: state.lastUserClick,
        lastPopStateTs: state.lastPopState
      });
      if (decision.block) {
        emitAegisLog(
          "BLOCK",
          "BLOCK_BACK_BUTTON_HIJACK",
          location.href,
          `history.forward() pasca-popstate ditahan (${decision.reason})`
        );
        return;
      }
    }
    return origHistoryForward.apply(this, arguments);
  }, origHistoryForward);

  const wrappedHistoryGo = maskAsNative(function (delta) {
    if (state.antiHistoryTrap && !state.tempAllowActive && !state.captchaDetected) {
      const decision = historyFloodDetector.shouldBlockForwardTrap({
        now: Date.now(),
        delta: delta === undefined ? 0 : delta,
        lastUserGestureTs: state.lastUserClick,
        lastPopStateTs: state.lastPopState
      });
      if (decision.block) {
        emitAegisLog(
          "BLOCK",
          "BLOCK_BACK_BUTTON_HIJACK",
          location.href,
          `history.go(${delta}) pasca-popstate ditahan (${decision.reason})`
        );
        return;
      }
    }
    return origHistoryGo.apply(this, arguments);
  }, origHistoryGo);

  // =========================================================================
  // P6: HARDENED & CACHED TIMER HOOK (ZERO EXCESSIVE querySelectorAll)
  // =========================================================================
  const COUNTDOWN_NARROW_SELECTOR =
    "[id*='countdown' i], [class*='countdown' i], [id='count'], [class~='count'], [id='timer'], [class~='timer'], [id*='timer-' i], [class*='timer-' i], [id*='skip-ad' i], [class*='skip-ad' i], [class*='preroll' i], [class*='ad-countdown' i]";
  const COUNTDOWN_NUM_REGEX = /\b([5-9]|[12][0-9]|30)\b/;
  const COUNTDOWN_WORD_REGEX =
    /(^\s*([5-9]|[12][0-9]|30)\s*s?\s*$|\b(detik|secs?|seconds?|tunggu|wait(ing)?|skip|lewati|iklan|ad\s+ends?|link\s+ready|siap\s+dalam)\b)/i;
  const SHORTLINK_URL_HINT_REGEX =
    /(safelink|shortlink|short\.|ouo\.|exe\.io|shrink|linkvertise|adlink|redirect|download=|getlink|babay|\/go\/|\/links\/)/i;

  let countdownScanCache = { ts: 0, value: false };
  let pageEligibilityCache = { ts: 0, eligible: false };

  function isProtectedFrameworkCallback(fn) {
    if (typeof fn !== "function") return true;
    return safeTry(
      "main_world.checkFrameworkCb",
      () => {
        const src = Function.prototype.toString.call(fn);
        return /(hls|dash|mediaSource|sourceBuffer|fragment|segment|bitrate|bandwidth|plyr|videojs|jwplayer|artplayer|dplayer|levelLoaded|fragLoaded|abort|xhr|ajax|overlay|xenforo|xf\.|fetch|timeout|reject|server|respond|turnstile|recaptcha|hcaptcha|arkose|datadome|perimeterx)/i.test(
          src
        );
      },
      true
    );
  }

  function isPageEligibleForCountdownScan(now) {
    if (now - pageEligibilityCache.ts < 1500) {
      return pageEligibilityCache.eligible;
    }
    const eligible = safeTry(
      "main_world.pageEligible",
      () => {
        // Quick URL hint for shortlink/redirect pages
        if (SHORTLINK_URL_HINT_REGEX.test(location.href)) return true;
        // Fast live HTMLCollection check (O(1), zero querySelectorAll!)
        if (document.getElementsByTagName("video").length > 0) return true;
        // Skip clearly long editorial/news/blog pages that have no video and no shortlink URL hint
        if (document.getElementsByTagName("article").length > 0) return false;
        if (document.getElementsByTagName("p").length >= 8) return false;
        // Only eligible if explicit known shortlink CTA IDs exist (O(1) getElementById)
        if (
          document.getElementById("babay") ||
          document.getElementById("go-link") ||
          document.getElementById("wpsafe-link") ||
          document.getElementById("countdown") ||
          document.getElementById("timer")
        ) {
          return true;
        }
        return false;
      },
      false
    );
    pageEligibilityCache = { ts: now, eligible };
    return eligible;
  }

  function isServerTokenShortlinkPage() {
    return safeTry(
      "main_world.isServerTokenPage",
      () => {
        if (document.getElementsByTagName("video").length > 0) return false;
        if (
          document.getElementById("babay") ||
          document.querySelector(
            "a[href*='download='], a[href*='&t='], a[href*='?t='], a[href*='token='], a[href*='hash='], a.btn-download"
          )
        ) {
          return true;
        }
        const bodyText = document.body ? (document.body.innerText || "").slice(0, 500) : "";
        return /(redirect\s*ready|go\s*to\s*link|link\s*ready|please\s*wait\s*a\s*moment)/i.test(
          bodyText
        );
      },
      false
    );
  }

  function has5to30CountdownOnPage() {
    if (state.captchaDetected || state.tempAllowActive) return false;
    const now = Date.now();
    if (now - countdownScanCache.ts < TIMINGS.TIMER_SCAN_CACHE_TTL_MS) {
      return countdownScanCache.value;
    }

    if (!isPageEligibleForCountdownScan(now)) {
      countdownScanCache = { ts: now, value: false };
      return false;
    }

    if (isServerTokenShortlinkPage()) {
      countdownScanCache = { ts: now, value: false };
      return false;
    }

    const found = safeTry(
      "main_world.countdownScan",
      () => {
        const nodes = document.querySelectorAll(COUNTDOWN_NARROW_SELECTOR);
        const cap = Math.min(nodes.length, 24);
        for (let i = 0; i < cap; i++) {
          const el = /** @type {HTMLElement} */ (nodes[i]);
          if (el.offsetParent === null) continue;
          const idCls = `${el.id || ""} ${typeof el.className === "string" ? el.className : ""}`;
          // Explicitly ignore unrelated commerce/user classes like "discount", "account", "country"
          if (/\b(discount|account|country|counter-cart|item-count)\b/i.test(idCls)) continue;
          const txt = (el.innerText || "").trim();
          if (!txt || txt.length > 64) continue;
          if (COUNTDOWN_NUM_REGEX.test(txt) && COUNTDOWN_WORD_REGEX.test(txt)) {
            return true;
          }
        }
        return false;
      },
      false
    );

    countdownScanCache = { ts: now, value: found };
    return found;
  }

  function canAccelerateTimer(fn) {
    if (
      !state.autoSkipCountdown ||
      state.captchaDetected ||
      state.tempAllowActive ||
      win._cf_chl_opt ||
      isCaptchaChallengeUrl(location.href) ||
      isDomainInList(location.href, state.trusted) ||
      isProtectedFrameworkCallback(fn)
    ) {
      return false;
    }
    return has5to30CountdownOnPage();
  }

  const wrappedSetInterval = maskAsNative(function (fn, delay) {
    let d = Number(delay);
    if (Number.isFinite(d) && d >= 800 && d <= 1250 && canAccelerateTimer(fn)) {
      d = 40;
    }
    return origSetInterval.call(this, fn, d);
  }, origSetInterval);

  const wrappedSetTimeout = maskAsNative(function (fn, delay) {
    let d = Number(delay);
    if (Number.isFinite(d) && ((d >= 5000 && d <= 30500) || (d >= 800 && d <= 1250)) && canAccelerateTimer(fn)) {
      if (d >= 5000 && d <= 30500) d = 300;
      else if (d >= 800 && d <= 1250) d = 40;
    }
    return origSetTimeout.call(this, fn, d);
  }, origSetTimeout);

  function installHooks() {
    if (state.hooksActive) return;
    state.hooksActive = true;
    safeTry("main_world.installHooks", () => {
      window.fetch = wrappedFetch;
      XMLHttpRequest.prototype.open = wrappedXhrOpen;
      window.open = wrappedOpen;
      HTMLAnchorElement.prototype.click = wrappedAnchorClick;
      history.pushState = wrappedPushState;
      history.replaceState = wrappedReplaceState;
      history.forward = wrappedHistoryForward;
      history.go = wrappedHistoryGo;
      window.setInterval = wrappedSetInterval;
      window.setTimeout = wrappedSetTimeout;

      if (origMediaSrcDesc && origMediaSrcDesc.set) {
        Object.defineProperty(HTMLMediaElement.prototype, "src", {
          configurable: true,
          enumerable: true,
          get: origMediaSrcDesc.get,
          set: function (val) {
            safeTry("main_world.mediaSrcSet", () => {
              if (!val) return;
              const s = String(val);
              if (s.startsWith("blob:")) {
                dispatchAuthenticated(BRIDGE_EVENTS.VIDEO_DETECTED, {
                  url: location.href,
                  confirmed: true
                });
              } else {
                reportVideoCandidate(s, false);
              }
            });
            return origMediaSrcDesc.set.call(this, val);
          }
        });
      }

      if (origAddSB && window.MediaSource) {
        MediaSource.prototype.addSourceBuffer = function (mimeType) {
          safeTry("main_world.addSourceBuffer", () => {
            if (mimeType && String(mimeType).toLowerCase().includes("video")) {
              dispatchAuthenticated(BRIDGE_EVENTS.VIDEO_DETECTED, {
                url: location.href,
                confirmed: true
              });
            }
          });
          return origAddSB.apply(this, arguments);
        };
      }
    });
  }

  function restoreNativeApisForChallenge() {
    if (!state.hooksActive) return;
    state.hooksActive = false;
    historyFloodDetector.reset();
    safeTry("main_world.restoreNativeApis", () => {
      window.setTimeout = origSetTimeout;
      window.setInterval = origSetInterval;
      window.fetch = origFetch;
      XMLHttpRequest.prototype.open = origXhrOpen;
      window.open = origOpen;
      history.pushState = origPushState;
      history.replaceState = origReplaceState;
      history.forward = origHistoryForward;
      history.go = origHistoryGo;
      HTMLAnchorElement.prototype.click = origAnchorClick;
      if (origMediaSrcDesc) {
        Object.defineProperty(HTMLMediaElement.prototype, "src", origMediaSrcDesc);
      }
      if (origAddSB && window.MediaSource) {
        MediaSource.prototype.addSourceBuffer = origAddSB;
      }
    });
  }

  installHooks();

  // Navigation API guard (remains active for Blacklist even during CAPTCHA/Temp Allow!)
  if (win.navigation) {
    win.navigation.addEventListener("navigate", (event) => {
      safeTry("main_world.navigation", () => {
        const destUrl = event.destination && event.destination.url ? event.destination.url : "";
        if (!destUrl) return;

        // Blacklist ALWAYS blocks silently even if Temporary Allow or CAPTCHA is active
        const isDenied = isDomainInList(destUrl, state.denied, location.href);
        if (isDenied && event.cancelable) {
          event.preventDefault();
          emitAegisLog(
            "BLOCK",
            "BLOCK_MAIN_NAVIGATE_BLACKLIST",
            destUrl,
            "window.navigation.navigate diblokir senyap (Blacklist)"
          );
          return;
        }

        if (state.captchaDetected || state.tempAllowActive) return;

        const gctx = getGestureContext(Boolean(event.userInitiated));
        const diag = diagnose(destUrl, gctx.hasRecentUserGesture);
        if (diag.block && event.cancelable) {
          event.preventDefault();
          emitAegisLog(
            "BLOCK",
            diag.reason === "media_tap_hijack" ? "BLOCK_VIDEO_TAP_REDIRECT" : "BLOCK_MAIN_NAVIGATE",
            destUrl,
            `window.navigation.navigate ditahan | mode=${state.protectionMode} | reason=${diag.reason} | userGesture=${gctx.hasRecentUserGesture} | mediaTap=${gctx.hasRecentMediaTap}`
          );
          emitBlocked(destUrl, "redirect", diag.reason);
        }
      });
    });
  }

  // Inbound capture-phase bridge listeners (swallow event immediately so page scripts NEVER see inboundToken!)
  origAddEventListener(
    BRIDGE_EVENTS.SYNC_RULES,
    (ev) => {
      if (!isValidInboundEvent(ev)) return;
      safeTry("main_world.swallowSync", () => origStopImmediatePropagation.call(ev));
      const d = /** @type {CustomEvent} */ (ev).detail;
      state.trusted = Array.isArray(d.trusted) ? d.trusted : [];
      state.denied = Array.isArray(d.denied) ? d.denied : [];
      state.protectionMode = d.protectionMode === "strict" ? "strict" : "balanced";
      state.strictCrossOrigin = state.protectionMode === "strict" || Boolean(d.strictCrossOrigin);
      state.autoSkipCountdown = d.autoSkipCountdown === true;
      state.tempAllowActive = Boolean(d.tempAllowActive);
      if (d.globalSettings) {
        state.antiHistoryTrap = d.globalSettings.antiHistoryTrap !== false;
        state.antiAntiAdblock = d.globalSettings.antiAntiAdblock !== false;
        state.captchaKillSwitchEnabled = d.globalSettings.captchaKillSwitchEnabled !== false;
        state.loggingEnabled = d.globalSettings.loggingEnabled !== false;
      }
    },
    true
  );

  origAddEventListener(
    BRIDGE_EVENTS.CAPTCHA_SIGNAL,
    (ev) => {
      if (!isValidInboundEvent(ev)) return;
      safeTry("main_world.swallowCaptcha", () => origStopImmediatePropagation.call(ev));
      const detected = Boolean(/** @type {CustomEvent} */ (ev).detail.detected);
      if (detected && state.captchaKillSwitchEnabled && !state.captchaDetected) {
        state.captchaDetected = true;
        restoreNativeApisForChallenge();
        emitAegisLog(
          "ALLOW",
          "CAPTCHA_KILL_SWITCH",
          location.href,
          "CAPTCHA terdeteksi -> seluruh native API dipulihkan (Blacklist tetap aktif)"
        );
      } else if (!detected && state.captchaDetected) {
        state.captchaDetected = false;
        installHooks();
        emitAegisLog(
          "ALLOW",
          "CAPTCHA_RECOVERED",
          location.href,
          "CAPTCHA selesai/hilang -> proteksi native API diaktifkan kembali"
        );
      }
    },
    true
  );

  origAddEventListener(
    BRIDGE_EVENTS.SHORTLINK_CTA_CLICK,
    (ev) => {
      if (!isValidInboundEvent(ev)) return;
      safeTry("main_world.swallowShortlinkCta", () => origStopImmediatePropagation.call(ev));
      state.lastShortlinkCta = Date.now();
    },
    true
  );

  // Request initial handshake & rules from isolated content script
  origDispatchEvent(new NativeCustomEvent(BRIDGE_EVENTS.REQUEST_RULES));
})();
