// @ts-check
/**
 * AEGIS-AI Shield v3.2.3 — Isolated Content Script State & Hardened Bridge
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
    "st.gt",
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
    safeTry("st.cb", cb);
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

export function isSiteShieldBypassed() {
  return Boolean(
    runtimeState.captchaDetected || isTempAllowActiveHere() || isUrlInTrustedList(location.href)
  );
}

export function logAegisEvent(level, code, toUrl = "", detail = "", source = "content") {
  if (level !== "DEBUG" && runtimeState.globalSettings.loggingEnabled === false) return;
  safeTry("st.lg", () => {
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
  safeTry("st.hs", () => {
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

function emitMainWorld(scope, eventName, detail = {}) {
  initMainWorldHandshake();
  if (!runtimeState.handshakeCompleted) return;
  safeTry(scope, () => {
    window.dispatchEvent(
      new CustomEvent(eventName, { detail: { token: INBOUND_BRIDGE_TOKEN, ...detail } })
    );
  });
}

export function syncMainWorldRules() {
  emitMainWorld("st.sr", BRIDGE_EVENTS.SYNC_RULES, {
    trusted: runtimeState.trustedDomains,
    denied: runtimeState.deniedDomains,
    protectionMode: runtimeState.globalSettings.protectionMode || "balanced",
    strictCrossOrigin:
      runtimeState.globalSettings.protectionMode === "strict" || runtimeState.strictCrossOrigin,
    autoSkipCountdown: runtimeState.autoSkipCountdown === true,
    tempAllowActive: isTempAllowActiveHere(),
    globalSettings: runtimeState.globalSettings
  });
}

export function signalCaptchaToMainWorld(detected = true) {
  emitMainWorld("st.sc", BRIDGE_EVENTS.CAPTCHA_SIGNAL, {
    detected: Boolean(detected)
  });
}

export function triggerLocalCaptchaKillSwitch() {
  if (runtimeState.globalSettings.captchaKillSwitchEnabled === false) return;
  const changed = !runtimeState.captchaDetected;
  runtimeState.captchaDetected = true;
  signalCaptchaToMainWorld(true);
  if (changed) {
    for (const cb of captchaStateListeners) {
      safeTry("st.ck", () => cb(true));
    }
  }
}

export function clearLocalCaptchaKillSwitch() {
  if (!runtimeState.captchaDetected) return;
  runtimeState.captchaDetected = false;
  signalCaptchaToMainWorld(false);
  for (const cb of captchaStateListeners) {
    safeTry("st.cr", () => cb(false));
  }
}

export function signalShortlinkCtaToMainWorld() {
  if (!runtimeState.captchaDetected) {
    emitMainWorld("st.ct", BRIDGE_EVENTS.SHORTLINK_CTA_CLICK);
  }
}

function updateDomainRuleList(urlStr, isAllow, callback) {
  const dom = normalizeDomainEntry(urlStr);
  if (!dom) return;
  const addKey = isAllow ? "trustedDomains" : "deniedDomains";
  const remKey = isAllow ? "deniedDomains" : "trustedDomains";
  if (!runtimeState[addKey].includes(dom)) {
    runtimeState[addKey] = [...runtimeState[addKey], dom];
  }
  runtimeState[remKey] = runtimeState[remKey].filter((d) => d !== dom);
  safeTry(isAllow ? "st.uw" : "st.ub", () => {
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

export function addDomainToBlacklist(urlStr, callback) {
  updateDomainRuleList(urlStr, false, callback);
}

export function addDomainToWhitelist(urlStr, callback) {
  updateDomainRuleList(urlStr, true, callback);
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

  const STORAGE_KEYS = [
    "trustedDomains",
    "deniedDomains",
    "strictCrossOrigin",
    "autoSkipCountdown",
    "globalSettings",
    "hudPositions",
    "tempAllowMap"
  ];

  const applyStoragePatch = (src, isLive) => {
    let changed = false;
    const setKey = (k, apply) => {
      if (isLive) liveChangedKeys.add(k);
      else if (liveChangedKeys.has(k)) return;
      apply(src[k]);
      changed = true;
    };
    if ("trustedDomains" in src) setKey("trustedDomains", (v) => { runtimeState.trustedDomains = Array.isArray(v) ? v : []; });
    if ("deniedDomains" in src) setKey("deniedDomains", (v) => { runtimeState.deniedDomains = Array.isArray(v) ? v : []; });
    if ("strictCrossOrigin" in src) setKey("strictCrossOrigin", (v) => { runtimeState.strictCrossOrigin = Boolean(v); });
    if ("globalSettings" in src) {
      setKey("globalSettings", (v) => {
        runtimeState.globalSettings = { ...DEFAULT_GLOBAL_SETTINGS, ...(v && typeof v === "object" ? v : {}) };
        if (typeof runtimeState.globalSettings.autoSkipCountdown === "boolean") {
          runtimeState.autoSkipCountdown = runtimeState.globalSettings.autoSkipCountdown;
        }
        setDebugEnabled(Boolean(runtimeState.globalSettings.debugInternalErrors));
        if (runtimeState.globalSettings.captchaKillSwitchEnabled === false && runtimeState.captchaDetected) {
          clearLocalCaptchaKillSwitch();
        }
      });
    }
    if ("autoSkipCountdown" in src) {
      setKey("autoSkipCountdown", (v) => {
        runtimeState.autoSkipCountdown = typeof v === "boolean" ? v : runtimeState.globalSettings.autoSkipCountdown === true;
      });
    }
    if ("hudPositions" in src) {
      setKey("hudPositions", (v) => {
        runtimeState.hudPositions = { ...DEFAULT_HUD_POSITIONS, ...(v && typeof v === "object" ? v : {}) };
      });
    }
    if ("tempAllowMap" in src) {
      setKey("tempAllowMap", (v) => { runtimeState.tempAllowMap = pruneExpiredTempAllows(v || {}); });
    }
    return changed;
  };

  safeTry("st.ch", () => {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      const patch = {};
      for (const k of STORAGE_KEYS) {
        if (changes[k]) patch[k] = changes[k].newValue;
      }
      if (applyStoragePatch(patch, true)) {
        purgeBlacklistedOrTrustedPrompts();
        syncMainWorldRules();
        notifyRuntimeStateChange();
      }
    });
  });

  safeTry("st.rm", () => {
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
      "st.ls",
      () => {
        // P5: Explicitly NEVER request geminiApiKey from storage in content script
        chrome.storage.local.get(STORAGE_KEYS, (res) => {
          applyStoragePatch(res || {}, false);
          if (runtimeState.captchaDetected) signalCaptchaToMainWorld(true);
          purgeBlacklistedOrTrustedPrompts();
          syncMainWorldRules();
          notifyRuntimeStateChange();
          resolve();
        });
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
