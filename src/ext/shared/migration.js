// @ts-check
/**
 * AEGIS-AI Shield v3.2.1 — Backward-Compatible & Hardened Storage Migration / Restore Helper
 * P8 Hardening:
 *  - Filters globalSettings strictly to known keys from DEFAULT_GLOBAL_SETTINGS.
 *  - Validates types, enums, and numeric ranges for all sliders & options.
 *  - Sanitizes hudPositions and caps domain list sizes (denied <= 5000, trusted <= 2000).
 *  - Preserves backward compatibility with v2.2.7 / v3.0.0 / v3.1.0 / v3.2.0 backups.
 */
import {
  AEGIS_VERSION,
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_HUD_POSITIONS,
  DEFAULT_TRUSTED_DOMAINS,
  TIMINGS
} from "./constants.js";
import { extractExactHostFromRule, matchHostnameAgainstRule, normalizeDomainEntry } from "./domain-utils.js";

const ALLOWED_ENUMS = Object.freeze({
  protectionMode: new Set(["balanced", "strict"]),
  popupTheme: new Set(["dark", "light"]),
  hudPosition: new Set(["top-center", "top-left", "top-right", "bottom-center"]),
  videoDockExpandDir: new Set(["auto", "ltr", "rtl"]),
  pipSize: new Set(["small", "medium", "large"]),
  adSkipSpeed: new Set(["8", "16", "instant"])
});

const NUMBER_RANGES = Object.freeze({
  hudDurationSec: [0, 15],
  hudOpacity: [0.5, 1.0],
  hudScale: [0.75, 1.3],
  videoDockDimSec: [0, 10],
  videoPillScale: [0.75, 1.35],
  videoPillOpacity: [0.5, 1.0],
  pipOpacity: [0.5, 1.0],
  redirectWindowSec: [1, 10]
});

/**
 * Normalize, deduplicate, and cap a list of domain/wildcard strings.
 * @param {unknown} rawList
 * @param {string[]} fallback
 * @param {number} maxEntries
 * @returns {string[]}
 */
function sanitizeDomainList(rawList, fallback, maxEntries) {
  if (!Array.isArray(rawList)) return [...fallback];
  const seen = new Set();
  /** @type {string[]} */
  const out = [];
  for (const item of rawList) {
    if (out.length >= maxEntries) break;
    const clean = normalizeDomainEntry(String(item || ""));
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

/**
 * Strictly validate and clamp globalSettings to known keys, types, enums, and numeric ranges.
 * @param {unknown} rawGlobal
 * @param {boolean} [legacyStrictCrossOrigin]
 * @param {boolean} [legacyAutoSkip]
 * @returns {Record<string, any>}
 */
export function sanitizeGlobalSettings(rawGlobal, legacyStrictCrossOrigin, legacyAutoSkip) {
  const input =
    rawGlobal && typeof rawGlobal === "object" && !Array.isArray(rawGlobal)
      ? /** @type {Record<string, any>} */ (rawGlobal)
      : {};
  /** @type {Record<string, any>} */
  const out = {};

  for (const [key, defaultVal] of Object.entries(DEFAULT_GLOBAL_SETTINGS)) {
    const hasProp = Object.prototype.hasOwnProperty.call(input, key);
    const val = hasProp ? input[key] : undefined;

    if (typeof defaultVal === "boolean") {
      out[key] = typeof val === "boolean" ? val : defaultVal;
    } else if (typeof defaultVal === "number") {
      const range = NUMBER_RANGES[/** @type {keyof typeof NUMBER_RANGES} */ (key)];
      const num = typeof val === "number" ? val : typeof val === "string" && val.trim() !== "" ? Number(val) : NaN;
      if (Number.isFinite(num)) {
        out[key] = range ? Math.max(range[0], Math.min(range[1], num)) : num;
      } else {
        out[key] = defaultVal;
      }
    } else if (typeof defaultVal === "string") {
      const allowedSet = ALLOWED_ENUMS[/** @type {keyof typeof ALLOWED_ENUMS} */ (key)];
      const strVal = typeof val === "string" ? val : typeof val === "number" ? String(val) : "";
      if (allowedSet && allowedSet.has(strVal)) {
        out[key] = strVal;
      } else {
        out[key] = defaultVal;
      }
    }
  }

  // Backward compatibility: respect legacy top-level strictCrossOrigin when protectionMode wasn't explicitly valid
  if (input.protectionMode !== "strict" && input.protectionMode !== "balanced") {
    out.protectionMode = legacyStrictCrossOrigin === true ? "strict" : "balanced";
  }

  // Backward compatibility: sync legacy top-level autoSkipCountdown if not explicitly set inside globalSettings
  if (typeof input.autoSkipCountdown !== "boolean" && typeof legacyAutoSkip === "boolean") {
    out.autoSkipCountdown = legacyAutoSkip;
  }

  return out;
}

/**
 * Sanitize a single saved HUD coordinate object (supports both v2 left/top and v3 ratio/anchor coords).
 * @param {unknown} rawCoord
 * @returns {Record<string, any> | null}
 */
function sanitizeHudCoord(rawCoord) {
  if (!rawCoord || typeof rawCoord !== "object" || Array.isArray(rawCoord)) return null;
  const c = /** @type {Record<string, any>} */ (rawCoord);
  /** @type {Record<string, any>} */
  const clean = {};

  if (typeof c.xRatio === "number" && Number.isFinite(c.xRatio)) {
    clean.xRatio = Math.max(0, Math.min(1, c.xRatio));
  }
  if (typeof c.yRatio === "number" && Number.isFinite(c.yRatio)) {
    clean.yRatio = Math.max(0, Math.min(1, c.yRatio));
  }
  if (c.anchorX === "left" || c.anchorX === "right") {
    clean.anchorX = c.anchorX;
  }
  if (typeof c.left === "number" && Number.isFinite(c.left)) {
    clean.left = Math.max(0, Math.min(10000, c.left));
  }
  if (typeof c.top === "number" && Number.isFinite(c.top)) {
    clean.top = Math.max(0, Math.min(10000, c.top));
  }
  if (c.anchorSide === "left" || c.anchorSide === "right") {
    clean.anchorSide = c.anchorSide;
  }
  if (typeof c.leftRatio === "number" && Number.isFinite(c.leftRatio)) {
    clean.leftRatio = Math.max(0, Math.min(1, c.leftRatio));
  }
  if (typeof c.topRatio === "number" && Number.isFinite(c.topRatio)) {
    clean.topRatio = Math.max(0, Math.min(1, c.topRatio));
  }
  if (typeof c.rightOffset === "number" && Number.isFinite(c.rightOffset)) {
    clean.rightOffset = Math.max(0, Math.min(10000, c.rightOffset));
  }

  return Object.keys(clean).length > 0 ? clean : null;
}

/**
 * Compute a safe, migrated storage payload from existing chrome.storage.local keys or a JSON backup.
 * Preserves all valid user customizations while enforcing Blacklist > Whitelist precedence,
 * strict globalSettings schema validation, and domain count limits.
 * @param {Record<string, any>} existing
 * @returns {{
 *   schemaVersion: string,
 *   strictCrossOrigin: boolean,
 *   autoSkipCountdown: boolean,
 *   deniedDomains: string[],
 *   trustedDomains: string[],
 *   globalSettings: Record<string, any>,
 *   hudPositions: Record<string, any>,
 *   aegisStats: { blocked: number, bypassed: number, allowed: number }
 * }}
 */
export function migrateExtensionStorage(existing = {}) {
  const src = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};

  // 1. Preserve, normalize, and cap Blacklist and Whitelist (Blacklist always wins on exact & wildcard conflict)
  const deniedDomains = sanitizeDomainList(src.deniedDomains, [], TIMINGS.MAX_DENIED_DOMAINS);
  const exactDeniedSet = new Set();
  /** @type {string[]} */
  const wildcardDeniedRules = [];
  for (const rule of deniedDomains) {
    if (rule.includes("*")) {
      wildcardDeniedRules.push(rule);
    } else {
      exactDeniedSet.add(rule);
    }
  }

  const rawTrusted = sanitizeDomainList(
    src.trustedDomains,
    DEFAULT_TRUSTED_DOMAINS,
    TIMINGS.MAX_TRUSTED_DOMAINS
  );
  const trustedDomains = rawTrusted.filter((trustedRule) => {
    if (exactDeniedSet.has(trustedRule)) return false;
    const exactTrustedHost = extractExactHostFromRule(trustedRule);
    if (!exactTrustedHost) return true;
    // Fast O(labels) check against exactDeniedSet (handles exact host & parent domain rules)
    const parts = exactTrustedHost.split(".");
    for (let i = 0; i < parts.length; i++) {
      if (exactDeniedSet.has(parts.slice(i).join("."))) return false;
    }
    if (wildcardDeniedRules.length === 0) return true;
    return !wildcardDeniedRules.some((deniedRule) => matchHostnameAgainstRule(exactTrustedHost, deniedRule));
  });

  // 2. Strictly filter & validate globalSettings (P8)
  const rawGlobal =
    src.globalSettings && typeof src.globalSettings === "object" && !Array.isArray(src.globalSettings)
      ? /** @type {Record<string, any>} */ (src.globalSettings)
      : {};
  const hasExistingPersistentApiKey =
    typeof src.geminiApiKey === "string" && src.geminiApiKey.trim().length > 0;

  const globalSettings = sanitizeGlobalSettings(
    src.globalSettings,
    typeof src.strictCrossOrigin === "boolean" ? src.strictCrossOrigin : undefined,
    typeof src.autoSkipCountdown === "boolean" ? src.autoSkipCountdown : undefined
  );

  // Carry over legacy persistent Gemini API key usage from v2.x-v3.2.0 updates instead of hiding/wiping it
  if (hasExistingPersistentApiKey) {
    if (typeof rawGlobal.sessionOnlyApiKey !== "boolean") {
      globalSettings.sessionOnlyApiKey = false;
    }
    if (typeof rawGlobal.geminiAuditEnabled !== "boolean") {
      globalSettings.geminiAuditEnabled = true;
    }
  }

  const strictCrossOrigin = globalSettings.protectionMode === "strict";
  const autoSkipCountdown = Boolean(globalSettings.autoSkipCountdown);

  // 3. Sanitize hudPositions to known keys only
  const rawPos =
    src.hudPositions && typeof src.hudPositions === "object" && !Array.isArray(src.hudPositions)
      ? src.hudPositions
      : {};
  const hudPositions = {
    topHud: sanitizeHudCoord(rawPos.topHud),
    videoDock: sanitizeHudCoord(rawPos.videoDock),
    miniPip: sanitizeHudCoord(rawPos.miniPip)
  };

  // 4. Preserve local stats counters with safe non-negative integer clamping
  const rawStats =
    src.aegisStats && typeof src.aegisStats === "object" && !Array.isArray(src.aegisStats)
      ? src.aegisStats
      : {};
  const aegisStats = {
    blocked: Math.max(0, Math.floor(Number(rawStats.blocked) || 0)),
    bypassed: Math.max(0, Math.floor(Number(rawStats.bypassed) || 0)),
    allowed: Math.max(0, Math.floor(Number(rawStats.allowed) || 0))
  };

  return {
    schemaVersion: AEGIS_VERSION,
    strictCrossOrigin,
    autoSkipCountdown,
    deniedDomains,
    trustedDomains,
    globalSettings,
    hudPositions,
    aegisStats
  };
}
