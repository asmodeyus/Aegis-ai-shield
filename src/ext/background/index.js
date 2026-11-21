// @ts-check
/**
 * AEGIS-AI Shield v3.2.1 — Hardened MV3 Background Service Worker (Single Source of Truth)
 * Key Security, Stability & Reliability Guarantees:
 *  - Restricts chrome.storage.session to TRUSTED_CONTEXTS only (isolates session API key & worker state).
 *  - Persists & rehydrates tabHistory + recentlyAllowedTargets in chrome.storage.session across MV3 worker restarts.
 *  - Enforces sender.id === chrome.runtime.id & Popup-only privilege boundaries for sensitive config/log/tempAllow actions.
 *  - Redacts all secrets/tokens/API keys BEFORE writing any diagnostic log entry.
 *  - P2: Evaluates legitimate OAuth/IdP flows before generic affiliate/TLD checks (after Blacklist & specific gambling).
 *  - P5: Enforces opt-in geminiAuditEnabled === true before any external Gemini API call.
 *  - Detects multi-hop cross-origin redirect chains, subframe CAPTCHA challenges, and prevents revert throwbacks.
 */
import {
  DEFAULT_STATS,
  GEMINI_MODEL,
  MESSENGER_OR_SOCIAL_ENTRY_REGEX,
  SAFE_MEDIA_HOST_REGEX,
  SEARCH_ENGINE_HOST_REGEX,
  TIMINGS
} from "../shared/constants.js";
import { isCaptchaChallengeUrl } from "../shared/captcha-guard.js";
import {
  logInternalError,
  redactSensitiveText,
  safeTry,
  sanitizeUrlForReport,
  setDebugEnabled,
  setDebugSink
} from "../shared/debug.js";
import {
  getBaseDomain,
  getHostname,
  getTemporaryAllowState,
  isDomainInList,
  isSameSafeEcosystem,
  normalizeDomainEntry,
  pruneExpiredTempAllows
} from "../shared/domain-utils.js";
import { buildConsolidatedDnrRules } from "../shared/dnr-builder.js";
import {
  buildSafeGeminiAuditRequest,
  computeAiAuditCacheKey,
  parseGeminiAuditResponse,
  pickLocalFallbackAudit,
  validateAndFallbackAiAudit
} from "../shared/gemini-audit.js";
import { migrateExtensionStorage } from "../shared/migration.js";
import {
  evaluateRedirectChain,
  hasSpecificGamblingHostname,
  isAuthFlowUrl,
  isHardMaliciousUrl,
  isSearchEngineHijackUrl,
  isSuspiciousUrl
} from "../shared/url-classifier.js";

const WORKER_SESSION_STATE_KEY = "__aegisWorkerSessionState";

const tabHistory = new Map();
const recentlyAllowedTargets = new Map();
let workerStateHydrated = false;
/** @type {Promise<void> | null} */
let workerHydrationPromise = null;
let workerStateFlushTimer = null;
let lastTabHistoryCleanup = 0;

// Lock down chrome.storage.session so content scripts can NEVER access session API keys or worker state
function enforceTrustedSessionAccess() {
  safeTry("background.sessionAccessLevel", () => {
    if (chrome.storage.session && typeof chrome.storage.session.setAccessLevel === "function") {
      chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }).catch(() => {});
    }
  });
}
enforceTrustedSessionAccess();

// =========================================================================
// MV3 SERVICE WORKER SESSION PERSISTENCE (SURVIVES IDLE TERMINATION)
// =========================================================================
function scheduleWorkerSessionFlush() {
  if (!chrome.storage.session) return;
  clearTimeout(workerStateFlushTimer);
  workerStateFlushTimer = setTimeout(() => {
    safeTry("background.flushWorkerSession", () => {
      const now = Date.now();
      const serializedTabs = [];
      for (const [tabId, entry] of tabHistory.entries()) {
        if (entry && now - (entry.lastTimestamp || 0) <= TIMINGS.TAB_HISTORY_TTL_MS) {
          serializedTabs.push([
            tabId,
            {
              stack: Array.isArray(entry.stack) ? entry.stack.slice(-12) : [],
              redirectChain: Array.isArray(entry.redirectChain) ? entry.redirectChain.slice(-6) : [],
              lastTimestamp: entry.lastTimestamp || now,
              lastRevertTime: entry.lastRevertTime || 0,
              revertCount: entry.revertCount || 0,
              lockedUntil: entry.lockedUntil || 0,
              manualAllowedUrl: entry.manualAllowedUrl || "",
              manualAllowedUntil: entry.manualAllowedUntil || 0,
              authGraceUntil: entry.authGraceUntil || 0,
              firstPageGraceUntil: entry.firstPageGraceUntil || 0,
              shortlinkCtaGraceUntil: entry.shortlinkCtaGraceUntil || 0,
              shortlinkCtaSourceHost: entry.shortlinkCtaSourceHost || "",
              captchaActiveUntil: entry.captchaActiveUntil || 0,
              failedRevertUrls: Array.isArray(entry.failedRevertUrls) ? entry.failedRevertUrls.slice(-4) : [],
              pendingPrompts: Array.isArray(entry.pendingPrompts) ? entry.pendingPrompts.slice(-8) : []
            }
          ]);
        }
      }
      // Cap serialized tabs at 40 most recent to keep session storage lightweight
      serializedTabs.sort((a, b) => (b[1].lastTimestamp || 0) - (a[1].lastTimestamp || 0));
      const trimmedTabs = serializedTabs.slice(0, 40);

      const activeAllowed = [];
      for (const [k, exp] of recentlyAllowedTargets.entries()) {
        if (exp > now) activeAllowed.push([k, exp]);
      }

      chrome.storage.session
        .set({
          [WORKER_SESSION_STATE_KEY]: {
            tabs: trimmedTabs,
            allowed: activeAllowed.slice(-60)
          }
        })
        .catch(() => {});
    });
  }, TIMINGS.WORKER_STATE_FLUSH_MS);
}

async function ensureWorkerStateHydrated() {
  if (workerStateHydrated) return;
  if (workerHydrationPromise) return workerHydrationPromise;

  workerHydrationPromise = (async () => {
    try {
      if (!chrome.storage.session) {
        workerStateHydrated = true;
        return;
      }
      const res = await chrome.storage.session.get([WORKER_SESSION_STATE_KEY]);
      const snap = res && res[WORKER_SESSION_STATE_KEY];
      const now = Date.now();
      if (snap && typeof snap === "object") {
        if (Array.isArray(snap.tabs)) {
          for (const pair of snap.tabs) {
            if (!Array.isArray(pair) || pair.length !== 2) continue;
            const [tabId, entry] = pair;
            if (typeof tabId === "number" && entry && typeof entry === "object" && !tabHistory.has(tabId)) {
              tabHistory.set(tabId, {
                stack: Array.isArray(entry.stack) ? entry.stack : [],
                redirectChain: Array.isArray(entry.redirectChain) ? entry.redirectChain : [],
                lastTimestamp: Number(entry.lastTimestamp) || now,
                lastRevertTime: Number(entry.lastRevertTime) || 0,
                revertCount: Number(entry.revertCount) || 0,
                lockedUntil: Number(entry.lockedUntil) || 0,
                manualAllowedUrl: String(entry.manualAllowedUrl || ""),
                manualAllowedUntil: Number(entry.manualAllowedUntil) || 0,
                authGraceUntil: Number(entry.authGraceUntil) || 0,
                firstPageGraceUntil: Number(entry.firstPageGraceUntil) || 0,
                shortlinkCtaGraceUntil: Number(entry.shortlinkCtaGraceUntil) || 0,
                shortlinkCtaSourceHost: String(entry.shortlinkCtaSourceHost || ""),
                captchaActiveUntil: Number(entry.captchaActiveUntil) || 0,
                failedRevertUrls: Array.isArray(entry.failedRevertUrls) ? entry.failedRevertUrls : [],
                pendingPrompts: Array.isArray(entry.pendingPrompts) ? entry.pendingPrompts : []
              });
            }
          }
        }
        if (Array.isArray(snap.allowed)) {
          for (const pair of snap.allowed) {
            if (Array.isArray(pair) && typeof pair[0] === "string" && Number(pair[1]) > now) {
              recentlyAllowedTargets.set(pair[0], Number(pair[1]));
            }
          }
        }
      }
    } catch (err) {
      logInternalError("background.hydrateWorkerSession", err);
    } finally {
      workerStateHydrated = true;
      workerHydrationPromise = null;
    }
  })();

  return workerHydrationPromise;
}

// =========================================================================
// DIAGNOSTIC LOG RING BUFFER (SECRET-REDACTED) & LOCAL STATS (ZERO TELEMETRY)
// =========================================================================
let aegisLogsCache = [];
let aegisLogsLoaded = false;
let aegisLogFlushTimer = null;
let aegisLoggingEnabled = true;

let aegisStatsCache = { ...DEFAULT_STATS };
let aegisStatsLoaded = false;
let aegisStatsFlushTimer = null;

/** @type {Record<string, number>} */
let tempAllowCache = {};
let tempAllowLoaded = false;

// =========================================================================
// RACE-SAFE IN-MEMORY DOMAIN RULES CACHE (STORAGE CHANGE VS FAST NAVIGATION)
// =========================================================================
let rulesRevision = 0;
/** @type {any | null} */
let cachedRulesSnapshot = null;
/** @type {Promise<any> | null} */
let inFlightRulesPromise = null;

function invalidateRulesCache() {
  rulesRevision += 1;
  cachedRulesSnapshot = null;
}

async function ensureLogsLoaded() {
  if (aegisLogsLoaded) return aegisLogsCache;
  try {
    const res = await chrome.storage.local.get(["aegisLogs", "globalSettings"]);
    aegisLogsCache = Array.isArray(res.aegisLogs) ? res.aegisLogs.slice(0, TIMINGS.MAX_LOGS) : [];
    const g = res.globalSettings && typeof res.globalSettings === "object" ? res.globalSettings : {};
    aegisLoggingEnabled = g.loggingEnabled !== false;
    setDebugEnabled(Boolean(g.debugInternalErrors));
    aegisLogsLoaded = true;
  } catch (err) {
    logInternalError("background.ensureLogsLoaded", err);
    aegisLogsLoaded = true;
  }
  return aegisLogsCache;
}

function scheduleLogFlush() {
  clearTimeout(aegisLogFlushTimer);
  aegisLogFlushTimer = setTimeout(() => {
    safeTry("background.flushLogs", () => {
      chrome.storage.local.set({ aegisLogs: aegisLogsCache.slice(0, TIMINGS.MAX_LOGS) });
    });
  }, TIMINGS.LOG_FLUSH_DEBOUNCE_MS);
}

async function ensureStatsLoaded() {
  if (aegisStatsLoaded) return aegisStatsCache;
  try {
    const res = await chrome.storage.local.get(["aegisStats"]);
    const s = res.aegisStats && typeof res.aegisStats === "object" ? res.aegisStats : {};
    aegisStatsCache = {
      blocked: Number(s.blocked) || 0,
      bypassed: Number(s.bypassed) || 0,
      allowed: Number(s.allowed) || 0
    };
    aegisStatsLoaded = true;
  } catch (err) {
    logInternalError("background.ensureStatsLoaded", err);
    aegisStatsLoaded = true;
  }
  return aegisStatsCache;
}

async function incrementLocalStat(kind) {
  await ensureStatsLoaded();
  if (kind === "BLOCK") aegisStatsCache.blocked += 1;
  else if (kind === "BYPASS") aegisStatsCache.bypassed += 1;
  else if (kind === "ALLOW") aegisStatsCache.allowed += 1;
  else return;

  clearTimeout(aegisStatsFlushTimer);
  aegisStatsFlushTimer = setTimeout(() => {
    safeTry("background.flushStats", () => {
      chrome.storage.local.set({ aegisStats: { ...aegisStatsCache } });
    });
  }, 300);
}

async function ensureTempAllowLoaded() {
  if (tempAllowLoaded) {
    tempAllowCache = pruneExpiredTempAllows(tempAllowCache);
    return tempAllowCache;
  }
  try {
    const storageArea = chrome.storage.session || chrome.storage.local;
    const res = await storageArea.get(["tempAllowMap"]);
    let map = res && res.tempAllowMap ? res.tempAllowMap : null;
    if (!map && chrome.storage.session) {
      const localRes = await chrome.storage.local.get(["tempAllowMap"]);
      map = localRes.tempAllowMap || {};
    }
    tempAllowCache = pruneExpiredTempAllows(map || {});
    tempAllowLoaded = true;
  } catch (err) {
    logInternalError("background.ensureTempAllowLoaded", err);
    tempAllowLoaded = true;
  }
  return tempAllowCache;
}

async function saveTempAllowMap(nextMap) {
  tempAllowCache = pruneExpiredTempAllows(nextMap);
  tempAllowLoaded = true;
  invalidateRulesCache();
  try {
    if (chrome.storage.session) {
      await chrome.storage.session.set({ tempAllowMap: tempAllowCache });
    }
    await chrome.storage.local.set({ tempAllowMap: tempAllowCache });
  } catch (err) {
    logInternalError("background.saveTempAllowMap", err);
  }
}

async function appendAegisLog(entry) {
  await ensureLogsLoaded();
  const level = String(entry.level || "WARN").toUpperCase();
  if (level === "BLOCK" || level === "BYPASS" || level === "ALLOW") {
    incrementLocalStat(level);
  }
  if (!aegisLoggingEnabled && level !== "DEBUG") return;

  // Always redact API keys, Bearer tokens, JWTs, and sensitive query parameters before persisting
  const safeFrom = entry.fromUrl ? sanitizeUrlForReport(String(entry.fromUrl)).slice(0, 220) : "";
  const safeTo = entry.toUrl ? sanitizeUrlForReport(String(entry.toUrl)).slice(0, 220) : "";
  const safeDetail = redactSensitiveText(String(entry.detail || ""), 320);

  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    level: ["BLOCK", "BYPASS", "ALLOW", "WARN", "DEBUG"].includes(level) ? level : "WARN",
    source: String(entry.source || "background").slice(0, 24),
    code: String(entry.code || "EVENT").replace(/[^A-Z0-9_]/gi, "_").slice(0, 48),
    fromUrl: safeFrom,
    toUrl: safeTo,
    detail: safeDetail
  };
  aegisLogsCache.unshift(item);
  if (aegisLogsCache.length > TIMINGS.MAX_LOGS) {
    aegisLogsCache = aegisLogsCache.slice(0, TIMINGS.MAX_LOGS);
  }
  scheduleLogFlush();
}

setDebugSink(({ scope, message }) => {
  appendAegisLog({
    level: "DEBUG",
    source: "background",
    code: `ERR_${scope.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}`,
    fromUrl: "chrome://service-worker",
    detail: message
  });
});

// =========================================================================
// TAB HISTORY LIFECYCLE & MEMORY HYGIENE
// =========================================================================
async function cleanupStaleTabHistory(verifyOpenTabs = true) {
  await ensureWorkerStateHydrated();
  const now = Date.now();
  lastTabHistoryCleanup = now;
  let activeTabIds = null;

  if (verifyOpenTabs && chrome.tabs && typeof chrome.tabs.query === "function") {
    try {
      const openTabs = await chrome.tabs.query({});
      activeTabIds = new Set(
        openTabs.map((t) => t && t.id).filter((id) => typeof id === "number")
      );
    } catch (err) {
      logInternalError("background.cleanupTabsQuery", err);
      activeTabIds = null;
    }
  }

  let mutated = false;
  for (const [tabId, entry] of tabHistory.entries()) {
    const isClosedTab = activeTabIds !== null && !activeTabIds.has(tabId);
    const isExpired = Boolean(
      entry && entry.lastTimestamp > 0 && now - entry.lastTimestamp > TIMINGS.TAB_HISTORY_TTL_MS
    );
    if (isClosedTab || isExpired) {
      tabHistory.delete(tabId);
      mutated = true;
    }
  }
  if (mutated) scheduleWorkerSessionFlush();
}

function isSafeHttpUrl(urlStr) {
  return safeTry(
    "background.isSafeHttpUrl",
    () => {
      if (!urlStr || typeof urlStr !== "string" || urlStr.length > 4096) return false;
      const u = new URL(urlStr);
      return u.protocol === "http:" || u.protocol === "https:";
    },
    false
  );
}

function isExtensionPageSender(sender) {
  if (!sender || sender.id !== chrome.runtime.id) return false;
  if (sender.tab) return false;
  const extOrigin = chrome.runtime.getURL("");
  return typeof sender.url === "string" && sender.url.startsWith(extOrigin);
}

function allowManualTarget(urlStr, durationMs = 25000) {
  if (!urlStr || !isSafeHttpUrl(urlStr)) return;
  const exp = Date.now() + durationMs;
  recentlyAllowedTargets.set(urlStr, exp);
  safeTry("background.allowManualTarget", () => {
    const host = getHostname(urlStr);
    const base = getBaseDomain(host);
    if (host) recentlyAllowedTargets.set(`host:${host}`, exp);
    if (base) recentlyAllowedTargets.set(`host:${base}`, exp);
  });
  scheduleWorkerSessionFlush();
}

function isTargetRecentlyAllowed(urlStr) {
  if (!urlStr) return false;
  const now = Date.now();
  for (const [k, exp] of recentlyAllowedTargets.entries()) {
    if (now > exp) recentlyAllowedTargets.delete(k);
  }
  const directExp = recentlyAllowedTargets.get(urlStr);
  if (directExp && now <= directExp) return true;
  const host = getHostname(urlStr);
  const base = getBaseDomain(host);
  const hostExp = recentlyAllowedTargets.get(`host:${host}`);
  const baseExp = recentlyAllowedTargets.get(`host:${base}`);
  return Boolean((hostExp && now <= hostExp) || (baseExp && now <= baseExp));
}

async function getDomainRules() {
  if (cachedRulesSnapshot) {
    cachedRulesSnapshot.tempAllowMap = pruneExpiredTempAllows(tempAllowCache);
    return cachedRulesSnapshot;
  }
  if (inFlightRulesPromise) {
    return inFlightRulesPromise;
  }

  const startRevision = rulesRevision;
  inFlightRulesPromise = (async () => {
    try {
      const [data, tempAllowMap] = await Promise.all([
        chrome.storage.local.get([
          "trustedDomains",
          "deniedDomains",
          "strictCrossOrigin",
          "globalSettings"
        ]),
        ensureTempAllowLoaded()
      ]);

      const g =
        data.globalSettings && typeof data.globalSettings === "object" ? data.globalSettings : {};
      const winSec = Number(g.redirectWindowSec);
      const protectionMode =
        g.protectionMode === "strict" || g.protectionMode === "balanced"
          ? g.protectionMode
          : data.strictCrossOrigin === true
          ? "strict"
          : "balanced";
      const strictCrossOrigin =
        protectionMode === "strict" ||
        (g.protectionMode === undefined && data.strictCrossOrigin === true);

      aegisLoggingEnabled = g.loggingEnabled !== false;
      setDebugEnabled(Boolean(g.debugInternalErrors));

      const snapshot = {
        trusted: Array.isArray(data.trustedDomains) ? data.trustedDomains : [],
        denied: Array.isArray(data.deniedDomains) ? data.deniedDomains : [],
        protectionMode,
        strictCrossOrigin,
        tempAllowMap,
        captchaKillSwitchEnabled: g.captchaKillSwitchEnabled !== false,
        geminiAuditEnabled: g.geminiAuditEnabled === true,
        smartUgcSense: g.smartUgcSense !== false,
        shortlinkBypassEnabled: g.shortlinkBypassEnabled !== false,
        shortlinkAutoClick: g.shortlinkAutoClick === true,
        loggingEnabled: g.loggingEnabled !== false,
        redirectWindowMs: Number.isFinite(winSec) && winSec >= 1 ? winSec * 1000 : 3500,
        dnrEnabled: g.dnrEnabled !== false
      };

      if (rulesRevision === startRevision) {
        cachedRulesSnapshot = snapshot;
      }
      return snapshot;
    } finally {
      inFlightRulesPromise = null;
    }
  })();

  return inFlightRulesPromise;
}

/**
 * Find the safest ancestor URL in tab history while avoiding infinite revert loops.
 */
function getSafeReturnUrl(tabId, currentMaliciousUrl, rules) {
  const entry = tabHistory.get(tabId);
  if (!entry || !entry.stack || entry.stack.length === 0) return null;
  const failedSet = new Set(Array.isArray(entry.failedRevertUrls) ? entry.failedRevertUrls : []);

  // Pass 1: prefer clean ancestor not in failedRevertUrls
  for (let i = entry.stack.length - 1; i >= 0; i--) {
    const candidate = entry.stack[i];
    if (
      candidate &&
      candidate !== currentMaliciousUrl &&
      !failedSet.has(candidate) &&
      !isDomainInList(candidate, rules.denied) &&
      !isHardMaliciousUrl(candidate, rules.denied)
    ) {
      return candidate;
    }
  }
  // Pass 2: fallback to any non-blacklisted ancestor different from current
  for (let i = entry.stack.length - 1; i >= 0; i--) {
    const candidate = entry.stack[i];
    if (candidate && candidate !== currentMaliciousUrl && !isDomainInList(candidate, rules.denied)) {
      return candidate;
    }
  }
  return null;
}

function ensureTabEntry(tabId) {
  const now = Date.now();
  if (
    tabHistory.size > 35 &&
    now - lastTabHistoryCleanup > TIMINGS.TAB_HISTORY_CLEANUP_INTERVAL_MS
  ) {
    cleanupStaleTabHistory(true);
  }
  if (!tabHistory.has(tabId)) {
    tabHistory.set(tabId, {
      stack: [],
      redirectChain: [],
      lastTimestamp: now,
      lastRevertTime: 0,
      revertCount: 0,
      lockedUntil: 0,
      manualAllowedUrl: "",
      manualAllowedUntil: 0,
      authGraceUntil: 0,
      firstPageGraceUntil: 0,
      shortlinkCtaGraceUntil: 0,
      shortlinkCtaSourceHost: "",
      captchaActiveUntil: 0,
      failedRevertUrls: [],
      pendingPrompts: []
    });
  }
  return tabHistory.get(tabId);
}

function isManuallyAllowed(entry, targetUrl) {
  if (isTargetRecentlyAllowed(targetUrl)) return true;
  if (!entry) return false;
  const now = Date.now();
  if (entry.authGraceUntil && now < entry.authGraceUntil) return true;
  if (!entry.manualAllowedUrl) return false;
  if (now > entry.manualAllowedUntil) {
    entry.manualAllowedUrl = "";
    return false;
  }
  const allowedHost = getHostname(entry.manualAllowedUrl);
  const targetHost = getHostname(targetUrl);
  return (
    entry.manualAllowedUrl === targetUrl ||
    (Boolean(allowedHost) && allowedHost === targetHost)
  );
}

function forceRevertTab(
  tabId,
  fallbackUrl,
  blockedUrl,
  reasonMsg,
  silentBlacklist = false,
  deniedList = []
) {
  const now = Date.now();
  const entry = ensureTabEntry(tabId);

  if (now - entry.lastRevertTime < TIMINGS.REVERT_COOLDOWN_MS) return;

  if (now - entry.lastRevertTime < 10000) {
    entry.revertCount += 1;
    // Only mark fallbackUrl as failed if it causes an immediate automatic loop (< 4s after revert, 3+ times)
    // so tapping a video twice does NOT throw the user back to an older referring site!
    if (fallbackUrl && entry.revertCount >= 3 && now - entry.lastRevertTime < 4000) {
      if (!Array.isArray(entry.failedRevertUrls)) entry.failedRevertUrls = [];
      if (!entry.failedRevertUrls.includes(fallbackUrl)) {
        entry.failedRevertUrls.push(fallbackUrl);
        if (entry.failedRevertUrls.length > 4) entry.failedRevertUrls.shift();
      }
    }
  } else {
    entry.revertCount = 1;
    entry.failedRevertUrls = [];
  }

  entry.lastRevertTime = now;
  if (entry.revertCount > 2) {
    entry.lockedUntil = now + TIMINGS.LOOP_LOCK_MS;
  }

  const isDenied = silentBlacklist || isDomainInList(blockedUrl, deniedList);

  if (!isDenied && blockedUrl && blockedUrl.startsWith("http")) {
    const exists = entry.pendingPrompts.some((p) => p.blockedUrl === blockedUrl);
    if (!exists) {
      entry.pendingPrompts.push({
        blockedUrl,
        message: entry.revertCount > 2 ? "Loop diputus (jeda 15d)" : reasonMsg,
        kind: "redirect"
      });
      if (entry.pendingPrompts.length > 10) entry.pendingPrompts.shift();
    }
  } else if (isDenied && Array.isArray(entry.pendingPrompts) && entry.pendingPrompts.length > 0) {
    entry.pendingPrompts = entry.pendingPrompts.filter(
      (p) => !isDomainInList(p.blockedUrl, deniedList)
    );
  }

  tabHistory.set(tabId, entry);
  scheduleWorkerSessionFlush();

  if (fallbackUrl && isSafeHttpUrl(fallbackUrl)) {
    safeTry("background.forceRevertUpdate", () => {
      chrome.tabs.update(tabId, { url: fallbackUrl });
    });
  }
}

/**
 * Broadcast CAPTCHA kill-switch or recovery to ALL frames (top frame + iframes) of a tab.
 * @param {number} tabId
 * @param {boolean} [active]
 */
function broadcastCaptchaStateToTab(tabId, active = true) {
  if (typeof tabId !== "number" || tabId < 0) return;
  const entry = ensureTabEntry(tabId);
  entry.captchaActiveUntil = active ? Date.now() + 90000 : 0;
  tabHistory.set(tabId, entry);
  scheduleWorkerSessionFlush();

  const msgType = active ? "CAPTCHA_KILL_SWITCH_TAB" : "CAPTCHA_CLEAR_TAB";
  safeTry("background.broadcastCaptchaState", () => {
    chrome.tabs.sendMessage(tabId, { type: msgType }).catch(() => {});
  });
}

// =========================================================================
// WEB NAVIGATION GUARDS (MAIN FRAME + SUBFRAME CAPTCHA + MULTI-HOP CHAINS)
// =========================================================================
chrome.webNavigation.onCommitted.addListener(async (details) => {
  const url = details.url;
  if (!url || !url.startsWith("http")) return;

  await ensureWorkerStateHydrated();
  const rules = await getDomainRules();

  // Subframe CAPTCHA detection -> activate tab-wide kill-switch immediately
  if (details.frameId !== 0) {
    if (
      rules.captchaKillSwitchEnabled &&
      !isDomainInList(url, rules.denied) &&
      isCaptchaChallengeUrl(url)
    ) {
      broadcastCaptchaStateToTab(details.tabId, true);
    }
    return;
  }

  const entry = ensureTabEntry(details.tabId);
  const now = Date.now();
  const qualifiers = details.transitionQualifiers || [];
  const isForwardBack = qualifiers.includes("forward_back");
  const isBlacklisted = isDomainInList(url, rules.denied);

  // 1. Blacklist ALWAYS blocks silently (even during Temp Allow or CAPTCHA)
  if (isBlacklisted) {
    const safeUrl = getSafeReturnUrl(details.tabId, url, rules);
    appendAegisLog({
      level: "BLOCK",
      source: "background",
      code: "BLACKLIST_SILENT_REVERT",
      fromUrl: safeUrl || entry.stack[entry.stack.length - 1] || url,
      toUrl: url,
      detail: `Domain Blacklist diblokir senyap (transition=${details.transitionType}, qualifiers=${qualifiers.join(",") || "none"})`
    });
    if (safeUrl) {
      forceRevertTab(
        details.tabId,
        safeUrl,
        url,
        "Domain Blacklist diblokir senyap",
        true,
        rules.denied
      );
    }
    return;
  }

  // 2. CAPTCHA challenge URL -> activate tab-wide kill-switch (if user enabled)
  if (rules.captchaKillSwitchEnabled && isCaptchaChallengeUrl(url)) {
    broadcastCaptchaStateToTab(details.tabId, true);
    entry.lastTimestamp = now;
    tabHistory.set(details.tabId, entry);
    scheduleWorkerSessionFlush();
    return;
  }

  const prevUrl = entry.stack[entry.stack.length - 1] || "";
  const tempState =
    getTemporaryAllowState(rules.tempAllowMap, prevUrl || url, now).active ||
    getTemporaryAllowState(rules.tempAllowMap, url, now).active;

  if (tempState || (entry.captchaActiveUntil && now < entry.captchaActiveUntil)) {
    if (entry.stack[entry.stack.length - 1] !== url) {
      entry.stack.push(url);
      if (entry.stack.length > 15) entry.stack.shift();
    }
    entry.lastTimestamp = now;
    tabHistory.set(details.tabId, entry);
    scheduleWorkerSessionFlush();
    return;
  }

  // 3. Normal Back / Forward browser button navigation is always preserved
  if (isForwardBack) {
    const idxInStack = entry.stack.lastIndexOf(url);
    if (idxInStack !== -1) {
      entry.stack = entry.stack.slice(0, idxInStack + 1);
    } else {
      entry.stack.push(url);
      if (entry.stack.length > 15) entry.stack.shift();
    }
    entry.redirectChain = [];
    entry.lockedUntil = now + 6000;
    entry.lastRevertTime = now;
    entry.revertCount = 0;
    entry.lastTimestamp = now;
    tabHistory.set(details.tabId, entry);
    scheduleWorkerSessionFlush();
    return;
  }

  if (
    isAuthFlowUrl(url) &&
    !isDomainInList(url, rules.denied) &&
    !hasSpecificGamblingHostname(url)
  ) {
    entry.authGraceUntil = now + TIMINGS.AUTH_GRACE_MS;
  }

  if (isManuallyAllowed(entry, url)) {
    if (entry.stack[entry.stack.length - 1] !== url) {
      entry.stack.push(url);
      if (entry.stack.length > 15) entry.stack.shift();
    }
    entry.redirectChain = [];
    entry.lastTimestamp = now;
    tabHistory.set(details.tabId, entry);
    scheduleWorkerSessionFlush();
    return;
  }

  if (now < entry.lockedUntil) return;

  const isExternalOrFirstPageTransition =
    entry.stack.length === 0 ||
    details.transitionType === "auto_toplevel" ||
    details.transitionType === "typed" ||
    details.transitionType === "auto_bookmark" ||
    details.transitionType === "generated" ||
    details.transitionType === "start_page" ||
    details.transitionType === "keyword" ||
    qualifiers.includes("from_address_bar") ||
    qualifiers.includes("from_api");

  if (isExternalOrFirstPageTransition) {
    entry.stack = [url];
    entry.redirectChain = [];
    entry.revertCount = 0;
    entry.failedRevertUrls = [];
    entry.lastTimestamp = now;
    entry.firstPageGraceUntil = now + TIMINGS.FIRST_PAGE_GRACE_MS;
    allowManualTarget(url, 15000);
    tabHistory.set(details.tabId, entry);
    scheduleWorkerSessionFlush();
    appendAegisLog({
      level: "ALLOW",
      source: "background",
      code: "ALLOW_FIRST_PAGE",
      fromUrl: url,
      detail: `Halaman awal/eksternal diizinkan (transition=${details.transitionType}, qualifiers=${qualifiers.join(",") || "none"})`
    });
    return;
  }

  if (prevUrl && prevUrl !== url) {
    safeTry("background.onCommittedCrossCheck", () => {
      const prevHost = getHostname(prevUrl);
      const currHost = getHostname(url);
      const prevBase = getBaseDomain(prevHost);
      const currBase = getBaseDomain(currHost);

      const isFromSearchEngine = SEARCH_ENGINE_HOST_REGEX.test(prevHost);
      const isFromMessengerOrSocial = MESSENGER_OR_SOCIAL_ENTRY_REGEX.test(prevHost);
      const isWithinFirstPageCanonicalRedirect =
        entry.firstPageGraceUntil &&
        now < entry.firstPageGraceUntil &&
        (prevBase === currBase || qualifiers.includes("server_redirect"));

      if (isFromSearchEngine || isFromMessengerOrSocial || isWithinFirstPageCanonicalRedirect) {
        entry.stack.push(url);
        if (entry.stack.length > 15) entry.stack.shift();
        entry.lastTimestamp = now;
        entry.firstPageGraceUntil = now + 4500;
        allowManualTarget(url, 15000);
        tabHistory.set(details.tabId, entry);
        scheduleWorkerSessionFlush();
        return;
      }

      if (prevBase !== currBase && !isSameSafeEcosystem(prevHost, currHost)) {
        const isHardMalicious =
          isHardMaliciousUrl(url, rules.denied) || isSearchEngineHijackUrl(url, prevUrl);
        const isWithinShortlinkCtaGrace = Boolean(
          entry.shortlinkCtaGraceUntil && now < entry.shortlinkCtaGraceUntil
        );

        if (isWithinShortlinkCtaGrace && !isHardMalicious) {
          entry.stack.push(url);
          if (entry.stack.length > 15) entry.stack.shift();
          entry.redirectChain = [];
          entry.lastTimestamp = now;
          entry.shortlinkCtaGraceUntil = 0;
          allowManualTarget(url, 18000);
          tabHistory.set(details.tabId, entry);
          scheduleWorkerSessionFlush();
          appendAegisLog({
            level: "ALLOW",
            source: "background",
            code: "ALLOW_SHORTLINK_302",
            fromUrl: prevUrl,
            toUrl: url,
            detail: `HTTP 302 CTA shortlink diizinkan (transition=${details.transitionType}, qualifiers=${qualifiers.join(",") || "none"})`
          });
          return;
        }

        if (SAFE_MEDIA_HOST_REGEX.test(currHost) && !isHardMalicious) {
          entry.stack.push(url);
          if (entry.stack.length > 15) entry.stack.shift();
          entry.lastTimestamp = now;
          tabHistory.set(details.tabId, entry);
          scheduleWorkerSessionFlush();
          return;
        }

        const isIntentionalUserNav =
          (details.transitionType === "link" || details.transitionType === "form_submit") &&
          !qualifiers.includes("server_redirect") &&
          !qualifiers.includes("client_redirect");
        const isAuthJump = isAuthFlowUrl(url) || isAuthFlowUrl(prevUrl);
        const elapsedMs = now - entry.lastTimestamp;

        // Multi-hop / chained redirect detection (3+ distinct cross-origin hops in 6s without auth/trusted)
        const chainEval = evaluateRedirectChain(
          entry.redirectChain,
          url,
          now,
          TIMINGS.REDIRECT_CHAIN_WINDOW_MS,
          TIMINGS.REDIRECT_CHAIN_MAX_HOPS
        );
        entry.redirectChain = chainEval.nextChain;

        const isChainedRedirectTrap =
          chainEval.isChainTrap &&
          !isAuthJump &&
          !isDomainInList(url, rules.trusted) &&
          (!isIntentionalUserNav || qualifiers.includes("server_redirect") || qualifiers.includes("client_redirect"));

        const isSuspicious = isSuspiciousUrl(url, rules, prevUrl, isTargetRecentlyAllowed);

        const isRapidAutoRedirect =
          rules.strictCrossOrigin &&
          !isIntentionalUserNav &&
          !isAuthJump &&
          (elapsedMs < rules.redirectWindowMs ||
            qualifiers.includes("client_redirect") ||
            qualifiers.includes("server_redirect"));

        if (isSuspicious || isChainedRedirectTrap || isRapidAutoRedirect) {
          const safeUrl = getSafeReturnUrl(details.tabId, url, rules) || prevUrl;
          const code = isChainedRedirectTrap
            ? "BLOCK_CHAINED_REDIRECT_REVERT"
            : isSuspicious
            ? "BLOCK_SUSPICIOUS_COMMIT"
            : "BLOCK_RAPID_REDIRECT_REVERT";
          const hudReason = isChainedRedirectTrap
            ? `Redirect berantai (${chainEval.hopCount} hop) ditahan`
            : isSuspicious
            ? "Redirect iklan/affiliate/search-hijack ditahan"
            : "Auto-redirect lintas domain ditahan";

          appendAegisLog({
            level: "BLOCK",
            source: "background",
            code,
            fromUrl: prevUrl,
            toUrl: url,
            detail: `Revert -> ${safeUrl} | mode=${rules.protectionMode} | hops=${chainEval.hopCount} | transition=${details.transitionType} | qualifiers=${qualifiers.join(",") || "none"} | elapsed=${elapsedMs}ms`
          });
          forceRevertTab(details.tabId, safeUrl, url, hudReason, false, rules.denied);
          return;
        }
      }
    });
  }

  if (!isSuspiciousUrl(url, rules, prevUrl, isTargetRecentlyAllowed) || entry.stack.length === 0) {
    if (entry.stack[entry.stack.length - 1] !== url) {
      entry.stack.push(url);
      if (entry.stack.length > 15) entry.stack.shift();
      if (now - entry.lastRevertTime > 4000) entry.revertCount = 0;
    }
    entry.lastTimestamp = now;
    tabHistory.set(details.tabId, entry);
    scheduleWorkerSessionFlush();
  }
});

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  const targetUrl = details.url;
  if (!targetUrl || !targetUrl.startsWith("http")) return;

  await ensureWorkerStateHydrated();
  const rules = await getDomainRules();
  const isTargetBlacklisted = isDomainInList(targetUrl, rules.denied);

  // Subframe CAPTCHA detection
  if (details.frameId !== 0) {
    if (rules.captchaKillSwitchEnabled && !isTargetBlacklisted && isCaptchaChallengeUrl(targetUrl)) {
      broadcastCaptchaStateToTab(details.tabId, true);
    }
    return;
  }

  const entry = ensureTabEntry(details.tabId);
  const now = Date.now();

  if (rules.captchaKillSwitchEnabled && !isTargetBlacklisted && isCaptchaChallengeUrl(targetUrl)) {
    broadcastCaptchaStateToTab(details.tabId, true);
    return;
  }

  if (
    isAuthFlowUrl(targetUrl) &&
    !isTargetBlacklisted &&
    !hasSpecificGamblingHostname(targetUrl)
  ) {
    entry.authGraceUntil = now + TIMINGS.AUTH_GRACE_MS;
    scheduleWorkerSessionFlush();
    return;
  }

  if (!isTargetBlacklisted && isManuallyAllowed(entry, targetUrl)) return;
  if (entry.stack.length === 0) return;

  const currentUrl = entry.stack[entry.stack.length - 1];
  if (!currentUrl || currentUrl === targetUrl) return;

  if (
    !isTargetBlacklisted &&
    ((entry.captchaActiveUntil && now < entry.captchaActiveUntil) ||
      getTemporaryAllowState(rules.tempAllowMap, currentUrl, now).active ||
      getTemporaryAllowState(rules.tempAllowMap, targetUrl, now).active)
  ) {
    return;
  }

  if (!isTargetBlacklisted && entry.firstPageGraceUntil && now < entry.firstPageGraceUntil) return;
  if (now < entry.lockedUntil || now - entry.lastRevertTime < TIMINGS.REVERT_COOLDOWN_MS) return;

  safeTry("background.onBeforeNavigate", () => {
    const prevHost = getHostname(currentUrl);
    const targetHost = getHostname(targetUrl);
    const prevBase = getBaseDomain(prevHost);
    const targetBase = getBaseDomain(targetHost);

    const isCurrentSearchOrMessenger =
      SEARCH_ENGINE_HOST_REGEX.test(prevHost) || MESSENGER_OR_SOCIAL_ENTRY_REGEX.test(prevHost);

    if (prevBase !== targetBase && !isSameSafeEcosystem(prevHost, targetHost)) {
      if (isCurrentSearchOrMessenger && !isTargetBlacklisted) {
        allowManualTarget(targetUrl, 15000);
        return;
      }
      const isHardMaliciousTarget =
        isHardMaliciousUrl(targetUrl, rules.denied) || isSearchEngineHijackUrl(targetUrl, currentUrl);
      if (
        entry.shortlinkCtaGraceUntil &&
        now < entry.shortlinkCtaGraceUntil &&
        !isHardMaliciousTarget
      ) {
        allowManualTarget(targetUrl, 18000);
        return;
      }
      if (SAFE_MEDIA_HOST_REGEX.test(targetHost) && !isHardMaliciousTarget) return;

      if (
        isTargetBlacklisted ||
        isSuspiciousUrl(targetUrl, rules, currentUrl, isTargetRecentlyAllowed)
      ) {
        const safeUrl = getSafeReturnUrl(details.tabId, targetUrl, rules) || currentUrl;
        appendAegisLog({
          level: "BLOCK",
          source: "background",
          code: isTargetBlacklisted ? "BLOCK_BEFORE_NAV_BLACKLIST" : "BLOCK_BEFORE_NAV_SUSPICIOUS",
          fromUrl: currentUrl,
          toUrl: targetUrl,
          detail: `onBeforeNavigate ditahan -> kembali ke ${safeUrl} | blacklisted=${isTargetBlacklisted} | hardMalicious=${isHardMaliciousTarget}`
        });
        forceRevertTab(
          details.tabId,
          safeUrl,
          targetUrl,
          "Redirect iklan/affiliate/search-hijack ditahan",
          isTargetBlacklisted,
          rules.denied
        );
      }
    }
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabHistory.delete(tabId);
  scheduleWorkerSessionFlush();
});

// =========================================================================
// RUNTIME MESSAGE HANDLERS — STRICT SENDER & PRIVILEGE BOUNDARY VALIDATION
// =========================================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Reject any message not originating from this extension ID or with malformed shape
  if (!sender || sender.id !== chrome.runtime.id) return;
  if (!request || typeof request.type !== "string" || request.type.length > 64) return;

  const fromPopup = isExtensionPageSender(sender);

  // --- PRIVILEGED POPUP-ONLY CONTROLS (NEVER CALLABLE FROM CONTENT SCRIPTS) ---
  if (request.type === "SET_TEMP_ALLOW") {
    if (!fromPopup || typeof request.domain !== "string") {
      sendResponse({ ok: false, reason: "unauthorized_sender" });
      return true;
    }
    const clean = normalizeDomainEntry(request.domain);
    const minutes = Math.max(1, Math.min(240, Number(request.minutes) || 15));
    Promise.all([ensureTempAllowLoaded(), getDomainRules()]).then(async ([map, rules]) => {
      if (!clean) {
        sendResponse({ ok: false });
        return;
      }
      const isDenied = isDomainInList(`https://${clean}`, rules.denied);
      const expiresAt = Date.now() + minutes * 60 * 1000;
      const nextMap = { ...map, [clean]: expiresAt };
      await saveTempAllowMap(nextMap);
      appendAegisLog({
        level: "ALLOW",
        source: "background",
        code: "TEMP_ALLOW_ENABLED",
        fromUrl: `https://${clean}`,
        detail: isDenied
          ? `Safe Mode aktif ${minutes}m untuk ${clean} (domain ini tetap diblokir Blacklist)`
          : `Safe Mode / Temporary Allow aktif untuk ${clean} selama ${minutes} menit`
      });
      sendResponse({ ok: true, domain: clean, expiresAt, tempAllowMap: nextMap, blacklisted: isDenied });
    });
    return true;
  }

  if (request.type === "CLEAR_TEMP_ALLOW") {
    if (!fromPopup) {
      sendResponse({ ok: false, reason: "unauthorized_sender" });
      return true;
    }
    ensureTempAllowLoaded().then(async (map) => {
      const nextMap = { ...map };
      if (typeof request.domain === "string" && request.domain) {
        const clean = normalizeDomainEntry(request.domain);
        const base = getBaseDomain(clean);
        delete nextMap[clean];
        delete nextMap[base];
      } else {
        Object.keys(nextMap).forEach((k) => delete nextMap[k]);
      }
      await saveTempAllowMap(nextMap);
      sendResponse({ ok: true, tempAllowMap: nextMap });
    });
    return true;
  }

  if (request.type === "RESET_AEGIS_STATS") {
    if (!fromPopup) {
      sendResponse({ ok: false, reason: "unauthorized_sender" });
      return true;
    }
    aegisStatsCache = { ...DEFAULT_STATS };
    aegisStatsLoaded = true;
    chrome.storage.local.set({ aegisStats: { ...DEFAULT_STATS } }, () =>
      sendResponse({ ok: true, stats: aegisStatsCache })
    );
    return true;
  }

  if (request.type === "GET_AEGIS_LOGS") {
    if (!fromPopup) {
      sendResponse({ logs: [] });
      return true;
    }
    ensureLogsLoaded().then((logs) => sendResponse({ logs }));
    return true;
  }

  if (request.type === "CLEAR_AEGIS_LOGS") {
    if (!fromPopup) {
      sendResponse({ ok: false, reason: "unauthorized_sender" });
      return true;
    }
    aegisLogsCache = [];
    aegisLogsLoaded = true;
    chrome.storage.local.set({ aegisLogs: [] }, () => sendResponse({ ok: true }));
    return true;
  }

  if (request.type === "GET_AEGIS_STATS") {
    ensureStatsLoaded().then((stats) => sendResponse({ stats }));
    return true;
  }

  if (request.type === "GET_TEMP_ALLOW_STATUS") {
    ensureTempAllowLoaded().then((map) => {
      const state =
        typeof request.url === "string" && isSafeHttpUrl(request.url)
          ? getTemporaryAllowState(map, request.url)
          : { active: false, domain: "", remainingMs: 0 };
      sendResponse({ tempAllowMap: map, state });
    });
    return true;
  }

  // --- ALL-FRAMES CAPTCHA KILL-SWITCH & RECOVERY RELAY ---
  if (request.type === "CAPTCHA_DETECTED_IN_FRAME" && sender.tab && typeof sender.tab.id === "number") {
    Promise.all([ensureWorkerStateHydrated(), getDomainRules()]).then(([, rules]) => {
      if (rules.captchaKillSwitchEnabled) {
        broadcastCaptchaStateToTab(sender.tab.id, true);
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  if (request.type === "CAPTCHA_CLEARED_IN_FRAME" && sender.tab && typeof sender.tab.id === "number") {
    ensureWorkerStateHydrated().then(() => {
      broadcastCaptchaStateToTab(sender.tab.id, false);
      sendResponse({ ok: true });
    });
    return true;
  }

  // --- AUTH FLOW GRACE (ONLY FROM TRUSTED ISOLATED CONTENT SCRIPT GESTURE) ---
  if (request.type === "AUTH_FLOW_STARTED" && sender.tab && typeof sender.tab.id === "number") {
    Promise.all([ensureWorkerStateHydrated(), getDomainRules()]).then(([, rules]) => {
      const tabUrl = sender.tab && sender.tab.url ? sender.tab.url : "";
      if (tabUrl && isDomainInList(tabUrl, rules.denied)) {
        sendResponse({ ok: false, reason: "blacklisted_origin" });
        return;
      }
      const entry = ensureTabEntry(sender.tab.id);
      entry.authGraceUntil = Date.now() + TIMINGS.AUTH_GRACE_MS;
      entry.lockedUntil = Date.now() + 10000;
      tabHistory.set(sender.tab.id, entry);
      scheduleWorkerSessionFlush();
      sendResponse({ ok: true });
    });
    return true;
  }

  // --- INDEPENDENT BACKGROUND VALIDATION FOR USER-CLICKED NAVIGATION ---
  if (request.type === "ALLOW_USER_CONTENT_NAVIGATION" && typeof request.url === "string") {
    Promise.all([ensureWorkerStateHydrated(), getDomainRules()]).then(([, rules]) => {
      const srcUrl = (sender.tab && sender.tab.url) || "";
      if (
        !isSafeHttpUrl(request.url) ||
        isDomainInList(request.url, rules.denied) ||
        isSearchEngineHijackUrl(request.url, srcUrl)
      ) {
        appendAegisLog({
          level: "BLOCK",
          source: "background",
          code: "REJECT_BLACKLIST_USER_NAV",
          fromUrl: srcUrl,
          toUrl: request.url,
          detail: "Permintaan ALLOW_USER_CONTENT_NAVIGATION ditolak (Blacklist/Search-Hijack/URL tidak valid)"
        });
        sendResponse({ ok: false, reason: "denied_blacklist" });
        return;
      }
      if (isHardMaliciousUrl(request.url, rules.denied) && !isDomainInList(request.url, rules.trusted)) {
        sendResponse({ ok: false, reason: "hard_malicious" });
        return;
      }
      allowManualTarget(request.url, 25000);
      if (sender.tab && typeof sender.tab.id === "number") {
        const entry = ensureTabEntry(sender.tab.id);
        entry.manualAllowedUrl = request.url;
        entry.manualAllowedUntil = Date.now() + 20000;
        tabHistory.set(sender.tab.id, entry);
        scheduleWorkerSessionFlush();
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  if (request.type === "USER_CLICKED_SHORTLINK_CTA" && sender.tab && typeof sender.tab.id === "number") {
    Promise.all([ensureWorkerStateHydrated(), getDomainRules()]).then(([, rules]) => {
      const targetHref = typeof request.href === "string" ? request.href : "";
      if (targetHref && isDomainInList(targetHref, rules.denied)) {
        sendResponse({ ok: false, reason: "denied_blacklist" });
        return;
      }
      const entry = ensureTabEntry(sender.tab.id);
      entry.shortlinkCtaGraceUntil = Date.now() + TIMINGS.SHORTLINK_CTA_GRACE_MS;
      entry.shortlinkCtaSourceHost = getHostname(request.sourceUrl || sender.tab.url || "");
      tabHistory.set(sender.tab.id, entry);
      scheduleWorkerSessionFlush();
      appendAegisLog({
        level: "ALLOW",
        source: "background",
        code: "GRANT_SHORTLINK_CTA_GRACE",
        fromUrl: request.sourceUrl || sender.tab.url || "",
        toUrl: targetHref,
        detail: "Grace window 9d diaktifkan untuk tombol CTA shortlink (izinkan HTTP 302 tujuan bersih)"
      });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (request.type === "ALLOW_SHORTLINK_BYPASS_NAV" && typeof request.url === "string") {
    Promise.all([ensureWorkerStateHydrated(), getDomainRules()]).then(([, rules]) => {
      const srcUrl = request.sourceUrl || (sender.tab && sender.tab.url) || "";
      if (
        !isSafeHttpUrl(request.url) ||
        isHardMaliciousUrl(request.url, rules.denied) ||
        isSearchEngineHijackUrl(request.url, srcUrl)
      ) {
        appendAegisLog({
          level: "BLOCK",
          source: "background",
          code: "REJECT_UNSAFE_BYPASS_NAV",
          fromUrl: srcUrl,
          toUrl: request.url,
          detail: "Permintaan ALLOW_SHORTLINK_BYPASS_NAV ditolak karena target Blacklist/iklan/search-hijack"
        });
        sendResponse({ ok: false, reason: "unsafe_target" });
        return;
      }
      allowManualTarget(request.url, 25000);
      if (sender.tab && typeof sender.tab.id === "number") {
        const entry = ensureTabEntry(sender.tab.id);
        entry.manualAllowedUrl = request.url;
        entry.manualAllowedUntil = Date.now() + 25000;
        entry.shortlinkCtaGraceUntil = Date.now() + TIMINGS.SHORTLINK_CTA_GRACE_MS;
        tabHistory.set(sender.tab.id, entry);
        scheduleWorkerSessionFlush();
      }
      appendAegisLog({
        level: "BYPASS",
        source: "background",
        code: "ALLOW_SHORTLINK_BYPASS",
        fromUrl: srcUrl,
        toUrl: request.url,
        detail: `Bypass Shortlink Debloated diizinkan (${String(request.method || "DIRECT").slice(0, 36)})`
      });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (request.type === "APPEND_AEGIS_LOG" && request.entry && typeof request.entry === "object") {
    appendAegisLog({
      level: request.entry.level,
      source: request.entry.source || "content",
      code: request.entry.code,
      fromUrl: request.entry.fromUrl || (sender.tab && sender.tab.url) || "",
      toUrl: request.entry.toUrl || "",
      detail: request.entry.detail || ""
    });
    return;
  }

  if (request.type === "GET_PENDING_PROMPTS" && sender.tab && typeof sender.tab.id === "number") {
    Promise.all([ensureWorkerStateHydrated(), getDomainRules()]).then(([, rules]) => {
      const entry = tabHistory.get(sender.tab.id);
      const rawItems = entry && Array.isArray(entry.pendingPrompts) ? [...entry.pendingPrompts] : [];
      const filteredItems = rawItems.filter(
        (item) =>
          item &&
          item.blockedUrl &&
          !isDomainInList(item.blockedUrl, rules.denied) &&
          !isDomainInList(item.blockedUrl, rules.trusted)
      );
      if (entry) {
        entry.pendingPrompts = [];
        tabHistory.set(sender.tab.id, entry);
        scheduleWorkerSessionFlush();
      }
      sendResponse({ prompts: filteredItems });
    });
    return true;
  }

  if (request.type === "OPEN_GROUP_TAB" && typeof request.url === "string" && sender.tab) {
    Promise.all([ensureWorkerStateHydrated(), getDomainRules()]).then(([, rules]) => {
      if (!isSafeHttpUrl(request.url) || isDomainInList(request.url, rules.denied)) {
        sendResponse({ ok: false, reason: "denied_blacklist" });
        return;
      }
      allowManualTarget(request.url, 30000);
      const createOpts = {
        url: request.url,
        active: false,
        openerTabId: sender.tab.id
      };
      if (typeof sender.tab.index === "number") createOpts.index = sender.tab.index + 1;
      if (typeof sender.tab.windowId === "number") createOpts.windowId = sender.tab.windowId;
      chrome.tabs.create(createOpts, async (newTab) => {
        if (newTab && typeof newTab.id === "number") {
          const newEntry = ensureTabEntry(newTab.id);
          newEntry.manualAllowedUrl = request.url;
          newEntry.manualAllowedUntil = Date.now() + 30000;
          newEntry.lockedUntil = Date.now() + 15000;
          newEntry.stack = [request.url];
          tabHistory.set(newTab.id, newEntry);
          scheduleWorkerSessionFlush();
        }
        if (!newTab || typeof newTab.id !== "number" || !chrome.tabs.group) return;
        try {
          const latestSender = await chrome.tabs.get(sender.tab.id).catch(() => sender.tab);
          const noneId =
            chrome.tabGroups && typeof chrome.tabGroups.TAB_GROUP_ID_NONE === "number"
              ? chrome.tabGroups.TAB_GROUP_ID_NONE
              : -1;
          const existingGroupId =
            typeof latestSender.groupId === "number" ? latestSender.groupId : noneId;

          if (existingGroupId !== noneId && existingGroupId >= 0) {
            await chrome.tabs.group({ tabIds: [newTab.id], groupId: existingGroupId });
          } else {
            const groupOpts = { tabIds: [sender.tab.id, newTab.id] };
            if (typeof latestSender.windowId === "number") {
              groupOpts.createProperties = { windowId: latestSender.windowId };
            }
            await chrome.tabs.group(groupOpts);
          }
        } catch (err) {
          logInternalError("background.openGroupTab", err);
        }
      });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (request.type === "NAVIGATE_CURRENT_TAB" && typeof request.url === "string" && sender.tab && typeof sender.tab.id === "number") {
    Promise.all([ensureWorkerStateHydrated(), getDomainRules()]).then(([, rules]) => {
      if (!isSafeHttpUrl(request.url) || isDomainInList(request.url, rules.denied)) {
        sendResponse({ ok: false, reason: "denied_blacklist" });
        return;
      }
      allowManualTarget(request.url, 30000);
      const entry = ensureTabEntry(sender.tab.id);
      entry.manualAllowedUrl = request.url;
      entry.manualAllowedUntil = Date.now() + 25000;
      entry.lockedUntil = Date.now() + 12000;
      entry.lastRevertTime = Date.now();
      tabHistory.set(sender.tab.id, entry);
      scheduleWorkerSessionFlush();
      chrome.tabs.update(sender.tab.id, { url: request.url });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (request.type === "ANALYZE_CANDIDATES" && request.payload && typeof request.payload === "object") {
    analyzeWithGemini(request.payload)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((err) => {
        logInternalError("background.analyzeWithGemini", err);
        sendResponse({ success: false, error: redactSensitiveText(err?.message || "AI Error", 120) });
      });
    return true;
  }
});

// =========================================================================
// HARDENED GEMINI AI CLIENT (TIMEOUT, RETRY, CACHE, PROMPT ISOLATION & FALLBACK)
// =========================================================================
/** @type {Map<string, Promise<any>>} */
const inFlightAiRequests = new Map();

async function recordAiStatus(status, message) {
  safeTry("background.recordAiStatus", () => {
    chrome.storage.local.set({
      aiLastStatus: {
        status,
        message: redactSensitiveText(message || "", 120),
        ts: Date.now()
      }
    });
  });
}

async function resolveGeminiApiKey() {
  if (chrome.storage.session) {
    try {
      const sess = await chrome.storage.session.get(["geminiApiKey"]);
      if (sess && typeof sess.geminiApiKey === "string" && sess.geminiApiKey.trim()) {
        return sess.geminiApiKey.trim();
      }
    } catch (err) {
      logInternalError("background.readSessionApiKey", err);
    }
  }
  const local = await chrome.storage.local.get(["geminiApiKey"]);
  return typeof local.geminiApiKey === "string" ? local.geminiApiKey.trim() : "";
}

async function readAiCache(cacheKey) {
  try {
    const res = await chrome.storage.local.get(["aiAuditCache"]);
    const cache = res.aiAuditCache && typeof res.aiAuditCache === "object" ? res.aiAuditCache : {};
    const hit = cache[cacheKey];
    if (hit && typeof hit === "object" && Number(hit.exp) > Date.now()) {
      return hit.result || null;
    }
  } catch (err) {
    logInternalError("background.readAiCache", err);
  }
  return null;
}

async function writeAiCache(cacheKey, result) {
  try {
    const res = await chrome.storage.local.get(["aiAuditCache"]);
    const rawCache = res.aiAuditCache && typeof res.aiAuditCache === "object" ? res.aiAuditCache : {};
    const now = Date.now();
    /** @type {Record<string, { result: any, exp: number }>} */
    const nextCache = {};
    const entries = Object.entries(rawCache)
      .filter(([, v]) => v && typeof v === "object" && Number(v.exp) > now)
      .sort((a, b) => Number(b[1].exp) - Number(a[1].exp))
      .slice(0, TIMINGS.AI_CACHE_MAX_ENTRIES - 1);

    for (const [k, v] of entries) {
      nextCache[k] = v;
    }
    nextCache[cacheKey] = {
      result,
      exp: now + TIMINGS.AI_CACHE_TTL_MS
    };
    await chrome.storage.local.set({ aiAuditCache: nextCache });
  } catch (err) {
    logInternalError("background.writeAiCache", err);
  }
}

async function fetchGeminiWithTimeoutAndRetry(apiKey, bodyObj) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const maxAttempts = TIMINGS.GEMINI_MAX_RETRIES + 1;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMINGS.GEMINI_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(bodyObj)
      });
      clearTimeout(timer);

      if (response.ok) {
        return await response.json();
      }

      const retryable = response.status === 429 || response.status >= 500;
      lastError = new Error(
        response.status === 429
          ? "Kuota Gemini API terbatas (HTTP 429)"
          : response.status === 401 || response.status === 403
          ? `API Key Gemini ditolak (HTTP ${response.status})`
          : `Gemini API HTTP ${response.status}`
      );
      if (!retryable || attempt === maxAttempts) {
        throw lastError;
      }
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err && err.name === "AbortError";
      lastError = isTimeout
        ? new Error(`Gemini API timeout (> ${TIMINGS.GEMINI_TIMEOUT_MS}ms)`)
        : err instanceof Error
        ? err
        : new Error("Gemini network error");
      const isNonRetryableAuth = /HTTP 40[0134]/.test(lastError.message);
      if (isNonRetryableAuth || attempt === maxAttempts) {
        throw lastError;
      }
    }

    // Bounded exponential backoff before retry
    await new Promise((r) => setTimeout(r, attempt * 650));
  }
  throw lastError || new Error("Gemini request failed");
}

async function analyzeWithGemini(payload) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates.slice(0, 18) : [];
  const pageUrl = typeof payload?.pageUrl === "string" ? payload.pageUrl : "";
  const rules = await getDomainRules();

  if (candidates.length === 0) {
    return { realIndex: -1, blockedIndices: [], source: "local_fallback" };
  }

  const cacheKey = computeAiAuditCacheKey(pageUrl, candidates);
  if (inFlightAiRequests.has(cacheKey)) {
    return inFlightAiRequests.get(cacheKey);
  }

  const promise = (async () => {
    // 1. Check persistent TTL cache first to avoid duplicate API requests
    const cached = await readAiCache(cacheKey);
    if (cached) {
      const validatedCached = validateAndFallbackAiAudit(cached, candidates, rules.denied, pageUrl);
      await recordAiStatus("ok", "Menggunakan hasil cache AI tervalidasi");
      return { ...validatedCached, fromCache: true };
    }

    // 2. P5: Gemini Audit is strictly opt-in (default OFF). Never send data to Google unless explicitly enabled!
    if (!rules.geminiAuditEnabled) {
      const localRes = pickLocalFallbackAudit(candidates, rules.denied, pageUrl);
      await recordAiStatus("fallback_local", "Audit Gemini nonaktif (opt-in) · Aturan lokal aktif");
      return localRes;
    }

    // 3. If API Key is not configured, seamlessly run deterministic local heuristic fallback
    const geminiApiKey = await resolveGeminiApiKey();
    if (!geminiApiKey) {
      const localRes = pickLocalFallbackAudit(candidates, rules.denied, pageUrl);
      await recordAiStatus("fallback_local", "API Key kosong · Aturan lokal aktif");
      return localRes;
    }

    // 3. Call Gemini with isolated systemInstruction, timeout, and bounded retry
    try {
      const requestBody = buildSafeGeminiAuditRequest(payload);
      const data = await fetchGeminiWithTimeoutAndRetry(geminiApiKey, requestBody);
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const parsed = parseGeminiAuditResponse(rawText);
      const verified = validateAndFallbackAiAudit(parsed, candidates, rules.denied, pageUrl);

      if (verified.rejectedAiReason) {
        appendAegisLog({
          level: "WARN",
          source: "background",
          code: "AI_OUTPUT_REJECTED_LOCAL_GUARD",
          fromUrl: pageUrl,
          detail: `Saran AI ditolak validasi lokal (${verified.rejectedAiReason}) -> dialihkan ke aturan lokal`
        });
      }

      await writeAiCache(cacheKey, {
        realIndex: verified.realIndex,
        blockedIndices: verified.blockedIndices
      });
      await recordAiStatus("ok", "Analisis Gemini tervalidasi & tersimpan di cache");
      return verified;
    } catch (err) {
      const errMsg = redactSensitiveText(err?.message || "Gemini gagal merespons", 120);
      const localFallback = pickLocalFallbackAudit(candidates, rules.denied, pageUrl);
      await recordAiStatus("error", `${errMsg} · Fallback lokal aktif`);
      appendAegisLog({
        level: "WARN",
        source: "background",
        code: "AI_GEMINI_FALLBACK",
        fromUrl: pageUrl,
        detail: `${errMsg} -> menggunakan fallback aturan lokal (realIndex=${localFallback.realIndex})`
      });
      return { ...localFallback, aiError: errMsg };
    }
  })();

  inFlightAiRequests.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlightAiRequests.delete(cacheKey);
  }
}

// =========================================================================
// SERIALIZED CONSOLIDATED DNR SYNC (WILDCARDS + SUBDOMAIN DEDUP + ZERO RACE)
// =========================================================================
let dnrSyncQueue = Promise.resolve();

function syncBlacklistToDnr(deniedList = []) {
  if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.updateDynamicRules) {
    return Promise.resolve();
  }
  const task = async () => {
    try {
      const { globalSettings } = await chrome.storage.local.get(["globalSettings"]);
      const dnrActive = !globalSettings || globalSettings.dnrEnabled !== false;
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const removeRuleIds = existingRules.map((r) => r.id);

      const maxDynamicRules =
        Number(chrome.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES) ||
        TIMINGS.DNR_FALLBACK_MAX_RULES;

      if (!dnrActive) {
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: [] });
        await chrome.storage.local.set({
          dnrStats: { totalDomains: 0, ruleCount: 0, truncatedCount: 0, maxRules: maxDynamicRules }
        });
        return;
      }

      const built = buildConsolidatedDnrRules(deniedList, maxDynamicRules, TIMINGS.DNR_BATCH_SIZE);
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds,
        addRules: built.rules
      });

      await chrome.storage.local.set({
        dnrStats: {
          totalDomains: built.totalDomains,
          ruleCount: built.ruleCount,
          truncatedCount: built.truncatedCount,
          maxRules: built.maxRules
        }
      });
    } catch (err) {
      logInternalError("background.syncBlacklistToDnr", err);
    }
  };
  dnrSyncQueue = dnrSyncQueue.then(task, task);
  return dnrSyncQueue;
}

let dnrSyncDebounceTimer = null;

function scheduleSyncBlacklistToDnr(delayMs = TIMINGS.DNR_DEBOUNCE_MS) {
  clearTimeout(dnrSyncDebounceTimer);
  dnrSyncDebounceTimer = setTimeout(async () => {
    try {
      const { deniedDomains } = await chrome.storage.local.get(["deniedDomains"]);
      await syncBlacklistToDnr(deniedDomains || []);
    } catch (err) {
      logInternalError("background.scheduleDnr", err);
    }
  }, delayMs);
}

// =========================================================================
// INSTALL (SMOOTH MIGRATION v2.2.7 -> v3.2.1), STARTUP & STORAGE SYNC
// =========================================================================
chrome.runtime.onInstalled.addListener(async () => {
  enforceTrustedSessionAccess();
  const existing = await chrome.storage.local.get([
    "schemaVersion",
    "deniedDomains",
    "trustedDomains",
    "strictCrossOrigin",
    "autoSkipCountdown",
    "globalSettings",
    "hudPositions",
    "aegisStats"
  ]);
  const migrated = migrateExtensionStorage(existing);
  await chrome.storage.local.set(migrated);
  invalidateRulesCache();
  await syncBlacklistToDnr(migrated.deniedDomains);
  await cleanupStaleTabHistory(true);
});

chrome.runtime.onStartup.addListener(async () => {
  enforceTrustedSessionAccess();
  invalidateRulesCache();
  const { deniedDomains } = await chrome.storage.local.get(["deniedDomains"]);
  await syncBlacklistToDnr(deniedDomains || []);
  await cleanupStaleTabHistory(true);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    if (
      changes.trustedDomains ||
      changes.deniedDomains ||
      changes.strictCrossOrigin ||
      changes.globalSettings ||
      changes.tempAllowMap
    ) {
      invalidateRulesCache();
    }
    if (changes.globalSettings && changes.globalSettings.newValue) {
      aegisLoggingEnabled = changes.globalSettings.newValue.loggingEnabled !== false;
      setDebugEnabled(Boolean(changes.globalSettings.newValue.debugInternalErrors));
    }
    if (changes.deniedDomains || changes.globalSettings) {
      scheduleSyncBlacklistToDnr(TIMINGS.DNR_DEBOUNCE_MS);
    }
  }
  if ((areaName === "session" || areaName === "local") && changes.tempAllowMap) {
    tempAllowCache = pruneExpiredTempAllows(changes.tempAllowMap.newValue || {});
    tempAllowLoaded = true;
    invalidateRulesCache();
  }
});
