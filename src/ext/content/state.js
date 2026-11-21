// @ts-check
/**
 * AEGIS-AI Shield v3.2.1 — Isolated Content Script State & Hardened Bridge
 * Security boundaries:
 *  - content -> main_world uses INBOUND_BRIDGE_TOKEN swallowed in capture phase at document_start.
 *  - main_world -> content uses OUTBOUND_BRIDGE_TOKEN + rate limiting, AND all main->content payloads
 *    are treated as UNTRUSTED HINTS independently re-validated in content.js (P3).
 *  - P5: Content scripts NEVER read geminiApiKey or access chrome.storage.session.
 */
import {
  BRIDGE_EVENTS,
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_HUD_POSITIONS,
  TIMINGS
} from "../shared/constants.js";
import { safeTry, setDebugEnabled, setDebugSink } from "../shared/debug.js";
import {
  getTemporaryAllowState,
  isDomainInList,
  normalizeDomainEntry,
  pruneExpiredTempAllows
} from "../shared/domain-utils.js";

function generateSecureToken(bytesLen = 16) {
  return safeTry(
    "content.generateToken",
    () => {
      const bytes = new Uint8Array(bytesLen);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    },
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 16)}-${Math.random().toString(36).slice(2, 16)}`
  );
}

export const INBOUND_BRIDGE_TOKEN = generateSecureToken(16);
export const OUTBOUND_BRIDGE_TOKEN = generateSecureToken(16);

export const runtimeState = {
  handshakeCompleted: false,
  trustedDomains: /** @type {string[]} */ ([]),
  deniedDomains: /** @type {string[]} */ ([]),
  strictCrossOrigin: false,
  autoSkipCountdown: false, // P7: opt-in default OFF
  globalSettings: { ...DEFAULT_GLOBAL_SETTINGS },
  hudPositions: { ...DEFAULT_HUD_POSITIONS },
  /** @type {Record<string, number>} */
  tempAllowMap: {},
  captchaDetected: false,
  shortlinkBypassActionTaken: false,
  // Isolated-world genuine user gesture timestamps (cannot be forged by page scripts!)
  lastTrustedLinkClickTs: 0,
  lastTrustedMediaTapTs: 0,
  lastTrustedAuthTs: 0,
  /** @type {Array<{ blockedUrl: string, message: string, kind: string }>} */
  manualPromptQueue: [],
  /** @type {string[]} */
  detectedVideos: [],
  videoDockDimmed: true,
  videoDrawerOpen: false,
  activeMiniVideoEl: /** @type {HTMLVideoElement | null} */ (null),
  miniPlayerActive: false,
  portraitFullscreenActive: false
};

/** @type {Array<() => void>} */
const stateChangeListeners = [];
/** @type {Array<(active: boolean) => void>} */
const captchaStateListeners = [];

// Sliding-window rate limiter against malicious main_world bridge event flooding
let bridgeWindowStart = 0;
let bridgeWindowCount = 0;

export function isValidOutboundMainEvent(ev) {
  if (
    !runtimeState.handshakeCompleted ||
    !ev ||
    !ev.detail ||
    typeof ev.detail.token !== "string" ||
    ev.detail.token !== OUTBOUND_BRIDGE_TOKEN
  ) {
    return false;
  }
  const now = Date.now();
  if (now - bridgeWindowStart > 1000) {
    bridgeWindowStart = now;
    bridgeWindowCount = 0;
  }
  bridgeWindowCount += 1;
  return bridgeWindowCount <= TIMINGS.BRIDGE_MAX_EVENTS_PER_SEC;
}

export function onRuntimeStateChange(cb) {
  if (typeof cb === "function") stateChangeListeners.push(cb);
}

export function onCaptchaKillSwitch(cb) {
  if (typeof cb === "function") captchaStateListeners.push(cb);
}

export function notifyRuntimeStateChange() {
  for (const cb of stateChangeListeners) {
    safeTry("content.stateChangeCb", cb);
  }
}

export function isTempAllowActiveHere() {
  return getTemporaryAllowState(runtimeState.tempAllowMap, location.href).active;
}

export function isUrlInTrustedList(urlStr) {
  return isDomainInList(urlStr, runtimeState.trustedDomains, location.href);
}

export function isUrlInDeniedList(urlStr) {
  return isDomainInList(urlStr, runtimeState.deniedDomains, location.href);
}

export function logAegisEvent(level, code, toUrl = "", detail = "", source = "content") {
  if (level !== "DEBUG" && runtimeState.globalSettings.loggingEnabled === false) return;
  safeTry("content.logAegisEvent", () => {
    chrome.runtime.sendMessage({
      type: "APPEND_AEGIS_LOG",
      entry: {
        level: level || "WARN",
        source,
        code: code || "CONTENT_EVENT",
        fromUrl: location.href,
        toUrl: toUrl ? String(toUrl) : "",
        detail: detail ? String(detail) : ""
      }
    });
  });
}

setDebugSink(({ scope, message }) => {
  logAegisEvent(
    "DEBUG",
    `ERR_${scope.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}`,
    "",
    message,
    "content"
  );
});

// Capture-phase listener for HANDSHAKE_ACK from main_world
window.addEventListener(
  BRIDGE_EVENTS.HANDSHAKE_ACK,
  (ev) => {
    const token =
      ev && /** @type {CustomEvent} */ (ev).detail && /** @type {CustomEvent} */ (ev).detail.token;
    if (token === OUTBOUND_BRIDGE_TOKEN) {
      runtimeState.handshakeCompleted = true;
    }
  },
  true
);

export function initMainWorldHandshake() {
  safeTry("content.initHandshake", () => {
    window.dispatchEvent(
      new CustomEvent(BRIDGE_EVENTS.HANDSHAKE_INIT, {
        detail: {
          inboundToken: INBOUND_BRIDGE_TOKEN,
          outboundToken: OUTBOUND_BRIDGE_TOKEN
        }
      })
    );
  });
}

export function syncMainWorldRules() {
  initMainWorldHandshake();
  if (!runtimeState.handshakeCompleted) return;
  safeTry("content.syncMainWorldRules", () => {
    window.dispatchEvent(
      new CustomEvent(BRIDGE_EVENTS.SYNC_RULES, {
        detail: {
          token: INBOUND_BRIDGE_TOKEN,
          trusted: runtimeState.trustedDomains,
          denied: runtimeState.deniedDomains,
          protectionMode: runtimeState.globalSettings.protectionMode || "balanced",
          strictCrossOrigin:
            runtimeState.globalSettings.protectionMode === "strict" ||
            runtimeState.strictCrossOrigin,
          autoSkipCountdown: runtimeState.autoSkipCountdown === true,
          tempAllowActive: isTempAllowActiveHere(),
          globalSettings: runtimeState.globalSettings
        }
      })
    );
  });
}

export function signalCaptchaToMainWorld(detected = true) {
  initMainWorldHandshake();
  if (!runtimeState.handshakeCompleted) return;
  safeTry("content.signalCaptcha", () => {
    window.dispatchEvent(
      new CustomEvent(BRIDGE_EVENTS.CAPTCHA_SIGNAL, {
        detail: { token: INBOUND_BRIDGE_TOKEN, detected: Boolean(detected) }
      })
    );
  });
}

export function triggerLocalCaptchaKillSwitch() {
  if (runtimeState.globalSettings.captchaKillSwitchEnabled === false) return;
  const changed = !runtimeState.captchaDetected;
  runtimeState.captchaDetected = true;
  signalCaptchaToMainWorld(true);
  if (changed) {
    for (const cb of captchaStateListeners) {
      safeTry("content.captchaKillSwitchCb", () => cb(true));
    }
  }
}

export function clearLocalCaptchaKillSwitch() {
  if (!runtimeState.captchaDetected) return;
  runtimeState.captchaDetected = false;
  signalCaptchaToMainWorld(false);
  for (const cb of captchaStateListeners) {
    safeTry("content.captchaRecoverCb", () => cb(false));
  }
}

export function signalShortlinkCtaToMainWorld() {
  if (runtimeState.captchaDetected) return;
  initMainWorldHandshake();
  if (!runtimeState.handshakeCompleted) return;
  safeTry("content.signalShortlinkCta", () => {
    window.dispatchEvent(
      new CustomEvent(BRIDGE_EVENTS.SHORTLINK_CTA_CLICK, {
        detail: { token: INBOUND_BRIDGE_TOKEN }
      })
    );
  });
}

export function addDomainToBlacklist(urlStr, callback) {
  const dom = normalizeDomainEntry(urlStr);
  if (!dom) return;
  if (!runtimeState.deniedDomains.includes(dom)) {
    runtimeState.deniedDomains = [...runtimeState.deniedDomains, dom];
  }
  runtimeState.trustedDomains = runtimeState.trustedDomains.filter((d) => d !== dom);
  safeTry("content.addBlacklist", () => {
    chrome.storage.local.set(
      {
        deniedDomains: runtimeState.deniedDomains,
        trustedDomains: runtimeState.trustedDomains
      },
      () => {
        syncMainWorldRules();
        if (typeof callback === "function") callback(dom);
      }
    );
  });
}

export function addDomainToWhitelist(urlStr, callback) {
  const dom = normalizeDomainEntry(urlStr);
  if (!dom) return;
  if (!runtimeState.trustedDomains.includes(dom)) {
    runtimeState.trustedDomains = [...runtimeState.trustedDomains, dom];
  }
  runtimeState.deniedDomains = runtimeState.deniedDomains.filter((d) => d !== dom);
  safeTry("content.addWhitelist", () => {
    chrome.storage.local.set(
      {
        trustedDomains: runtimeState.trustedDomains,
        deniedDomains: runtimeState.deniedDomains
      },
      () => {
        syncMainWorldRules();
        if (typeof callback === "function") callback(dom);
      }
    );
  });
}

export function purgeBlacklistedOrTrustedPrompts() {
  runtimeState.manualPromptQueue = runtimeState.manualPromptQueue.filter(
    (item) =>
      item &&
      item.blockedUrl &&
      !isUrlInDeniedList(item.blockedUrl) &&
      !isUrlInTrustedList(item.blockedUrl)
  );
}

/**
 * Hydrate initial storage state asynchronously with race-condition protection against
 * live chrome.storage.onChanged updates, and listen for tab-wide CAPTCHA kill-switch messages.
 * P5 SECURITY INVARIANT: Content scripts NEVER read geminiApiKey or touch chrome.storage.session.
 * @returns {Promise<void>}
 */
export function initStorageSync() {
  initMainWorldHandshake();

  /** @type {Set<string>} */
  const liveChangedKeys = new Set();

  safeTry("content.registerStorageChanged", () => {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      let changed = false;
      if (changes.trustedDomains) {
        liveChangedKeys.add("trustedDomains");
        runtimeState.trustedDomains = Array.isArray(changes.trustedDomains.newValue)
          ? changes.trustedDomains.newValue
          : [];
        changed = true;
      }
      if (changes.deniedDomains) {
        liveChangedKeys.add("deniedDomains");
        runtimeState.deniedDomains = Array.isArray(changes.deniedDomains.newValue)
          ? changes.deniedDomains.newValue
          : [];
        changed = true;
      }
      if (changes.strictCrossOrigin) {
        liveChangedKeys.add("strictCrossOrigin");
        runtimeState.strictCrossOrigin = Boolean(changes.strictCrossOrigin.newValue);
        changed = true;
      }
      if (changes.autoSkipCountdown) {
        liveChangedKeys.add("autoSkipCountdown");
        runtimeState.autoSkipCountdown = changes.autoSkipCountdown.newValue === true;
        changed = true;
      }
      if (changes.globalSettings) {
        liveChangedKeys.add("globalSettings");
        runtimeState.globalSettings = {
          ...DEFAULT_GLOBAL_SETTINGS,
          ...(changes.globalSettings.newValue || {})
        };
        if (typeof runtimeState.globalSettings.autoSkipCountdown === "boolean") {
          runtimeState.autoSkipCountdown = runtimeState.globalSettings.autoSkipCountdown;
        }
        setDebugEnabled(Boolean(runtimeState.globalSettings.debugInternalErrors));
        if (runtimeState.globalSettings.captchaKillSwitchEnabled === false && runtimeState.captchaDetected) {
          clearLocalCaptchaKillSwitch();
        }
        changed = true;
      }
      if (changes.hudPositions) {
        liveChangedKeys.add("hudPositions");
        runtimeState.hudPositions = {
          ...DEFAULT_HUD_POSITIONS,
          ...(changes.hudPositions.newValue || {})
        };
        changed = true;
      }
      if (changes.tempAllowMap) {
        liveChangedKeys.add("tempAllowMap");
        runtimeState.tempAllowMap = pruneExpiredTempAllows(changes.tempAllowMap.newValue || {});
        changed = true;
      }
      if (changed) {
        purgeBlacklistedOrTrustedPrompts();
        syncMainWorldRules();
        notifyRuntimeStateChange();
      }
    });
  });

  safeTry("content.registerRuntimeMessage", () => {
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || typeof msg.type !== "string") return;
      if (msg.type === "CAPTCHA_KILL_SWITCH_TAB") {
        triggerLocalCaptchaKillSwitch();
      } else if (msg.type === "CAPTCHA_CLEAR_TAB") {
        clearLocalCaptchaKillSwitch();
      }
    });
  });

  const readyPromise = new Promise((resolve) => {
    safeTry(
      "content.loadInitialStorage",
      () => {
        // P5: Explicitly NEVER request geminiApiKey from storage in content script
        chrome.storage.local.get(
          [
            "trustedDomains",
            "deniedDomains",
            "strictCrossOrigin",
            "autoSkipCountdown",
            "globalSettings",
            "hudPositions",
            "tempAllowMap"
          ],
          (res) => {
            if (!liveChangedKeys.has("trustedDomains")) {
              runtimeState.trustedDomains = Array.isArray(res.trustedDomains)
                ? res.trustedDomains
                : [];
            }
            if (!liveChangedKeys.has("deniedDomains")) {
              runtimeState.deniedDomains = Array.isArray(res.deniedDomains)
                ? res.deniedDomains
                : [];
            }
            if (!liveChangedKeys.has("strictCrossOrigin")) {
              runtimeState.strictCrossOrigin = Boolean(res.strictCrossOrigin);
            }
            if (!liveChangedKeys.has("globalSettings")) {
              runtimeState.globalSettings = {
                ...DEFAULT_GLOBAL_SETTINGS,
                ...(res.globalSettings && typeof res.globalSettings === "object"
                  ? res.globalSettings
                  : {})
              };
            }
            if (!liveChangedKeys.has("autoSkipCountdown")) {
              runtimeState.autoSkipCountdown =
                typeof res.autoSkipCountdown === "boolean"
                  ? res.autoSkipCountdown
                  : runtimeState.globalSettings.autoSkipCountdown === true;
            }
            if (!liveChangedKeys.has("hudPositions")) {
              runtimeState.hudPositions = {
                ...DEFAULT_HUD_POSITIONS,
                ...(res.hudPositions && typeof res.hudPositions === "object"
                  ? res.hudPositions
                  : {})
              };
            }
            if (!liveChangedKeys.has("tempAllowMap")) {
              runtimeState.tempAllowMap = pruneExpiredTempAllows(res.tempAllowMap || {});
            }
            setDebugEnabled(Boolean(runtimeState.globalSettings.debugInternalErrors));
            purgeBlacklistedOrTrustedPrompts();
            syncMainWorldRules();
            if (runtimeState.captchaDetected) {
              signalCaptchaToMainWorld(true);
            }
            notifyRuntimeStateChange();
            resolve();
          }
        );
      },
      undefined
    );
  });

  window.addEventListener(BRIDGE_EVENTS.REQUEST_RULES, () => {
    syncMainWorldRules();
    if (runtimeState.captchaDetected) {
      signalCaptchaToMainWorld(true);
    }
  });

  return readyPromise;
}
