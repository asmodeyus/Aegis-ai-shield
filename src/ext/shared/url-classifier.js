// @ts-check
/**
 * AEGIS-AI Shield v3.2.1 — Unified URL Classifier, Search Hijack Guard & Redirect Chain Detector
 * Single source of truth shared between background.js, main_world.js, and content.js.
 *
 * v3.2.1 upgrades:
 *  - P1: Split gambling matching (specific hostname substring vs ambiguous whole-token hostname labels,
 *        whole-word/phrase search query & button text checks).
 *  - P2: Legitimate OAuth/IdP flows evaluated BEFORE generic affiliate/TLD checks (after Blacklist & specific gambling).
 *  - Video-Tap Hijack Guard: Blocks cross-origin navigation triggered immediately after tapping <video>
 *    and detects direct-link ad paths like /4/<32-hex>.
 */
import {
  AUTH_PATH_OR_PARAM_REGEX,
  AUTH_PROVIDER_HOST_REGEX,
  AUTH_SUBDOMAIN_REGEX,
  CHALLENGE_HOST_REGEX,
  COMMERCE_AFFILIATE_REGEX,
  DIRECT_LINK_AD_PATH_REGEX,
  GAMBLING_AMBIGUOUS_TOKEN_REGEX,
  GAMBLING_SEARCH_WORD_REGEX,
  GAMBLING_SPECIFIC_REGEX,
  GAMBLING_TEXT_STRICT_REGEX,
  KNOWN_AD_SHORTENER_REGEX,
  RANDOM_SHORT_DOMAIN_REGEX,
  SAFE_MEDIA_HOST_REGEX,
  SEARCH_ARBITRAGE_PARAMS,
  SEARCH_ENGINE_HOST_REGEX,
  SUSPICIOUS_TLD,
  TIMINGS
} from "./constants.js";
import { safeTry } from "./debug.js";
import { getBaseDomain, getHostname, isDomainInList, isSameSafeEcosystem } from "./domain-utils.js";

/**
 * P1: Match specific unambiguous gambling keywords on hostname (substring) ONLY.
 * @param {string | URL} urlOrObj
 * @returns {boolean}
 */
export function hasSpecificGamblingHostname(urlOrObj) {
  if (!urlOrObj) return false;
  return safeTry(
    "urlClassifier.hasSpecificGamblingHost",
    () => {
      const u = urlOrObj instanceof URL ? urlOrObj : new URL(String(urlOrObj));
      const host = u.hostname.toLowerCase();
      return GAMBLING_SPECIFIC_REGEX.test(host);
    },
    false
  );
}

/**
 * P1: Match gambling signals on a URL cleanly:
 *  - Specific keywords (gacor, maxwin, togel, judol, sbobet, slot88, ...) match as hostname substring.
 *  - Ambiguous keywords (rtp, wd, judi, bandar, deposit, pragmatic, zeus, scatter, poker, slot, casino, betting, bonus)
 *    ONLY match as whole delimited tokens (split on ".", "-", "_") inside hostname labels (excluding final TLD),
 *    NEVER on arbitrary path or query substrings.
 * @param {string | URL} urlOrObj
 * @returns {boolean}
 */
export function hasGamblingSignalInUrl(urlOrObj) {
  if (!urlOrObj) return false;
  return safeTry(
    "urlClassifier.hasGamblingUrl",
    () => {
      const u = urlOrObj instanceof URL ? urlOrObj : new URL(String(urlOrObj));
      const host = u.hostname.toLowerCase();
      if (!host) return false;

      if (GAMBLING_SPECIFIC_REGEX.test(host)) return true;

      const labels = host.split(".");
      // Exclude final TLD label (e.g., ".com", ".org", ".id") when checking ambiguous hostname tokens
      const checkLabels = labels.length > 1 ? labels.slice(0, -1) : labels;
      for (const label of checkLabels) {
        if (!label) continue;
        const tokens = label.split(/[-_]+/);
        for (const tok of tokens) {
          if (tok && GAMBLING_AMBIGUOUS_TOKEN_REGEX.test(tok)) {
            return true;
          }
        }
      }
      return false;
    },
    false
  );
}

/**
 * P1: Match gambling terms inside a search engine query using whole words/phrases ONLY (no substring matching).
 * @param {string} queryText
 * @returns {boolean}
 */
export function hasGamblingSignalInSearchQuery(queryText) {
  if (!queryText) return false;
  return GAMBLING_SEARCH_WORD_REGEX.test(String(queryText));
}

/**
 * P1: Match gambling terms inside button/CTA text using strict whole-word/phrase matching only.
 * @param {string} text
 * @returns {boolean}
 */
export function hasGamblingSignalInText(text) {
  if (!text) return false;
  return GAMBLING_TEXT_STRICT_REGEX.test(String(text));
}

/**
 * Determine whether a URL is part of an authentication / OAuth / SSO / SAML flow.
 * For multi-purpose hosts like github.com / discord.com, checks auth path/params as well.
 * @param {string} urlStr
 * @returns {boolean}
 */
export function isAuthFlowUrl(urlStr) {
  if (!urlStr) return false;
  return safeTry(
    "urlClassifier.isAuthFlowUrl",
    () => {
      const u = new URL(urlStr);
      const host = u.hostname.toLowerCase();
      const pathAndSearch = u.pathname + u.search;

      // Multi-purpose hosts (github.com, discord.com) are auth flows when hitting login/oauth/session routes
      if (/(^|\.)(github\.com|discord\.com)$/i.test(host)) {
        return AUTH_PATH_OR_PARAM_REGEX.test(pathAndSearch);
      }

      return (
        AUTH_SUBDOMAIN_REGEX.test(host) ||
        AUTH_PROVIDER_HOST_REGEX.test(host) ||
        AUTH_PATH_OR_PARAM_REGEX.test(pathAndSearch)
      );
    },
    false
  );
}

/**
 * Detect whether a destination URL is a Search Engine redirect hijack (Google/Bing/DDG/Yahoo/Yandex search page).
 * @param {string} urlStr
 * @param {string} [sourceUrl]
 * @returns {boolean}
 */
export function isSearchEngineHijackUrl(urlStr, sourceUrl = "") {
  if (!urlStr) return false;
  return safeTry(
    "urlClassifier.isSearchHijack",
    () => {
      const u = new URL(urlStr);
      const host = u.hostname.toLowerCase();
      const isSearchPage =
        (host.includes("google.") && (u.pathname === "/search" || u.pathname === "/url")) ||
        (host.includes("bing.com") && u.pathname === "/search") ||
        (host.includes("duckduckgo.com") && u.pathname === "/" && u.searchParams.has("q")) ||
        (host.includes("search.yahoo.com") && u.pathname.startsWith("/search")) ||
        (host.includes("yandex.") && u.pathname.startsWith("/search"));

      if (!isSearchPage) return false;

      const q = u.searchParams.get("q") || u.searchParams.get("p") || u.searchParams.get("text") || "";
      if (SEARCH_ARBITRAGE_PARAMS.test(u.href) || hasGamblingSignalInSearchQuery(q)) return true;

      if (sourceUrl) {
        const srcHost = getHostname(sourceUrl);
        if (srcHost && !SEARCH_ENGINE_HOST_REGEX.test(srcHost)) {
          return true;
        }
      }
      return false;
    },
    false
  );
}

/**
 * Detect high-confidence malicious/gambling/affiliate/shortener/direct-link/blacklisted destinations.
 * @param {string} urlStr
 * @param {string[]} [deniedList]
 * @param {string} [baseHref]
 * @returns {boolean}
 */
export function isHardMaliciousUrl(urlStr, deniedList = [], baseHref) {
  if (!urlStr) return false;
  return safeTry(
    "urlClassifier.isHardMaliciousUrl",
    () => {
      const u = baseHref ? new URL(urlStr, baseHref) : new URL(urlStr);
      const host = u.hostname.toLowerCase();
      const baseHost = getBaseDomain(host);
      if (isDomainInList(u.href, deniedList)) return true;
      return (
        hasGamblingSignalInUrl(u) ||
        COMMERCE_AFFILIATE_REGEX.test(u.href) ||
        RANDOM_SHORT_DOMAIN_REGEX.test(baseHost) ||
        SEARCH_ARBITRAGE_PARAMS.test(u.href) ||
        KNOWN_AD_SHORTENER_REGEX.test(host) ||
        DIRECT_LINK_AD_PATH_REGEX.test(u.pathname)
      );
    },
    false
  );
}

/**
 * Evaluate whether a URL should be treated as suspicious in background/content checks.
 * Precedence:
 *  1. Blacklist (rules.denied) ALWAYS wins
 *  2. Search-engine hijack from non-search page
 *  3. Whitelist / recentlyAllowed / CAPTCHA / same ecosystem
 *  4. P2: Legitimate OAuth/Auth flows (unless specific gambling hostname)
 *  5. Hard ad/gambling/affiliate/direct-link signals
 *  6. Safe media hosts & Suspicious TLDs
 * @param {string} urlStr
 * @param {{ trusted?: string[], denied?: string[], strictCrossOrigin?: boolean, protectionMode?: string }} [rules]
 * @param {string} [sourceUrl]
 * @param {(url: string) => boolean} [isRecentlyAllowedFn]
 * @returns {boolean}
 */
export function isSuspiciousUrl(
  urlStr,
  rules = { trusted: [], denied: [], strictCrossOrigin: true, protectionMode: "balanced" },
  sourceUrl = "",
  isRecentlyAllowedFn
) {
  return safeTry(
    "urlClassifier.isSuspiciousUrl",
    () => {
      const u = new URL(urlStr);
      const host = u.hostname.toLowerCase();
      const baseHost = getBaseDomain(host);

      // 1. Blacklist ALWAYS wins
      if (isDomainInList(urlStr, rules.denied || [])) return true;

      // 2. Search-engine hijack from non-search page is suspicious even if google.com is in trusted
      if (isSearchEngineHijackUrl(urlStr, sourceUrl)) return true;

      // 3. Whitelist (after Blacklist & Search Hijack checks)
      if (isDomainInList(urlStr, rules.trusted || [])) return false;
      if (typeof isRecentlyAllowedFn === "function" && isRecentlyAllowedFn(urlStr)) return false;
      if (CHALLENGE_HOST_REGEX.test(host)) return false;

      if (sourceUrl) {
        const srcHost = getHostname(sourceUrl);
        if (srcHost && isSameSafeEcosystem(srcHost, host)) return false;
      }

      // 4. P2: Legitimate Auth/OAuth flows exempt before generic hard/TLD checks (except specific gambling hosts)
      if (isAuthFlowUrl(urlStr) && !hasSpecificGamblingHostname(u)) {
        return false;
      }

      const hasHardAdSignals =
        hasGamblingSignalInUrl(u) ||
        COMMERCE_AFFILIATE_REGEX.test(u.href) ||
        RANDOM_SHORT_DOMAIN_REGEX.test(baseHost) ||
        SEARCH_ARBITRAGE_PARAMS.test(u.href) ||
        KNOWN_AD_SHORTENER_REGEX.test(host) ||
        DIRECT_LINK_AD_PATH_REGEX.test(u.pathname);

      if (hasHardAdSignals) return true;

      if (SAFE_MEDIA_HOST_REGEX.test(host)) return false;
      if (SUSPICIOUS_TLD.test(host)) return true;

      return false;
    },
    false
  );
}

/**
 * Evaluate multi-hop / chained cross-origin redirects within a sliding time window.
 * @param {Array<{ host: string, base: string, ts: number }>} chain
 * @param {string} nextUrl
 * @param {number} [now]
 * @param {number} [windowMs]
 * @param {number} [maxHops]
 * @returns {{ isChainTrap: boolean, hopCount: number, nextChain: Array<{ host: string, base: string, ts: number }> }}
 */
export function evaluateRedirectChain(
  chain = [],
  nextUrl,
  now = Date.now(),
  windowMs = TIMINGS.REDIRECT_CHAIN_WINDOW_MS,
  maxHops = TIMINGS.REDIRECT_CHAIN_MAX_HOPS
) {
  const fresh = (Array.isArray(chain) ? chain : []).filter(
    (item) => item && typeof item.ts === "number" && now - item.ts <= windowMs
  );
  const host = getHostname(nextUrl);
  if (!host) {
    return { isChainTrap: false, hopCount: fresh.length, nextChain: fresh };
  }
  const base = getBaseDomain(host);
  const last = fresh[fresh.length - 1];

  if (last && (last.base === base || isSameSafeEcosystem(last.host, host))) {
    return { isChainTrap: false, hopCount: fresh.length, nextChain: fresh };
  }

  const nextChain = [...fresh, { host, base, ts: now }].slice(-8);
  const distinctBases = new Set(nextChain.map((h) => h.base));
  const isChainTrap = distinctBases.size >= maxHops;

  return {
    isChainTrap,
    hopCount: distinctBases.size,
    nextChain
  };
}

/**
 * Diagnose whether a destination navigation/popup should be blocked and provide a machine-readable reason.
 * Used by BOTH MAIN world native API hooks AND isolated content script re-validation (P3).
 * @param {string} urlStr
 * @param {object} ctx
 * @param {string} ctx.currentHref
 * @param {string[]} [ctx.trusted]
 * @param {string[]} [ctx.denied]
 * @param {boolean} [ctx.strictCrossOrigin]
 * @param {string} [ctx.protectionMode] "balanced" | "strict"
 * @param {boolean} [ctx.tempAllowActive]
 * @param {boolean} [ctx.captchaDetected]
 * @param {boolean} [ctx.hasRecentUserGesture]
 * @param {boolean} [ctx.hasRecentMediaTap]
 * @param {boolean} [ctx.hasRecentAuthGesture]
 * @param {boolean} [ctx.hasRecentShortlinkCta]
 * @returns {{ block: boolean, reason: string }}
 */
export function diagnoseDestinationBlock(urlStr, ctx) {
  if (!urlStr) return { block: true, reason: "empty_url" };
  const raw = String(urlStr).trim();
  if (/^(intent|shopeeid|tokopedia|lazada|market|javascript|vbscript):/i.test(raw)) {
    return { block: true, reason: "deep_link_or_script_scheme" };
  }

  return safeTry(
    "urlClassifier.diagnoseDestinationBlock",
    () => {
      const dest = new URL(raw, ctx.currentHref);
      if (dest.protocol !== "http:" && dest.protocol !== "https:") {
        return { block: false, reason: "non_http" };
      }

      const curObj = new URL(ctx.currentHref);
      const curHost = curObj.hostname.toLowerCase();
      const destHost = dest.hostname.toLowerCase();
      const destBase = getBaseDomain(destHost);
      const curBase = getBaseDomain(curHost);

      // 1. Explicit user Blacklist ALWAYS wins even under Temp Allow or CAPTCHA
      if (isDomainInList(dest.href, ctx.denied || [])) {
        return { block: true, reason: "denied_blacklist" };
      }

      // 2. Safe Mode / Temporary Allow bypasses non-blacklisted blocks for the active site
      if (ctx.tempAllowActive) {
        return { block: false, reason: "temporary_allow_active" };
      }

      // 3. CAPTCHA / Anti-Bot challenge pages must never be interfered with
      if (ctx.captchaDetected || CHALLENGE_HOST_REGEX.test(destHost)) {
        return { block: false, reason: "captcha_challenge" };
      }

      if (destBase === curBase) return { block: false, reason: "same_base_domain" };
      if (isSameSafeEcosystem(curHost, destHost)) return { block: false, reason: "safe_ecosystem" };

      // 4. Search engine hijack is blocked even before generic whitelist
      if (isSearchEngineHijackUrl(dest.href, ctx.currentHref)) {
        return { block: true, reason: "search_hijack" };
      }

      if (isDomainInList(dest.href, ctx.trusted || [])) {
        return { block: false, reason: "trusted_whitelist" };
      }

      // 5. P2: Legitimate Auth/OAuth flow with user or auth gesture evaluated BEFORE generic hard patterns
      //    (Still blocked if blacklisted above or matches specific gambling hostname)
      if (
        (ctx.hasRecentUserGesture || ctx.hasRecentAuthGesture) &&
        (isAuthFlowUrl(dest.href) || ctx.hasRecentAuthGesture) &&
        !hasSpecificGamblingHostname(dest)
      ) {
        return { block: false, reason: "auth_flow" };
      }

      // 6. Hard ad/gambling/affiliate/shortener/direct-link patterns
      const isHardBadPattern =
        hasGamblingSignalInUrl(dest) ||
        COMMERCE_AFFILIATE_REGEX.test(dest.href) ||
        RANDOM_SHORT_DOMAIN_REGEX.test(destBase) ||
        SEARCH_ARBITRAGE_PARAMS.test(dest.href) ||
        KNOWN_AD_SHORTENER_REGEX.test(destHost) ||
        DIRECT_LINK_AD_PATH_REGEX.test(dest.pathname);

      if (isHardBadPattern) return { block: true, reason: "hard_ad_or_gambling_pattern" };

      // 7. Media-tap hijack guard: tapping <video> MUST NOT trigger cross-origin navigation!
      if (ctx.hasRecentMediaTap && !ctx.hasRecentUserGesture) {
        return { block: true, reason: "media_tap_hijack" };
      }

      if (ctx.hasRecentUserGesture && SAFE_MEDIA_HOST_REGEX.test(destHost)) {
        return { block: false, reason: "safe_media_host" };
      }

      if (ctx.hasRecentShortlinkCta) {
        return { block: false, reason: "shortlink_cta_grace" };
      }

      if (SUSPICIOUS_TLD.test(destHost)) {
        return { block: true, reason: "suspicious_tld" };
      }

      if (!ctx.hasRecentUserGesture) {
        return { block: true, reason: "no_recent_user_gesture" };
      }

      const isStrictMode =
        ctx.protectionMode === "strict" ||
        (ctx.protectionMode !== "balanced" && ctx.strictCrossOrigin !== false);

      if (isStrictMode) {
        return { block: true, reason: "strict_cross_origin" };
      }

      return { block: false, reason: "balanced_user_click_allowed" };
    },
    { block: false, reason: "parse_error" }
  );
}
