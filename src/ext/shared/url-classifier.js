// @ts-check
/**
 * AEGIS-AI Shield v3.2.4 — Unified URL Classifier, Search Hijack Guard & Redirect Chain Detector
 * Single source of truth shared between background.js, main_world.js, and content.js.
 *
 * v3.2.1–v3.2.4 upgrades:
 *  - P1: Split gambling matching (specific hostname substring vs ambiguous whole-token hostname labels,
 *        whole-word/phrase search query & button text checks).
 *  - P2: Legitimate OAuth/IdP flows evaluated BEFORE generic affiliate/TLD checks (after Blacklist & specific gambling).
 *  - Video-Tap Hijack Guard: Blocks cross-origin navigation triggered immediately after tapping <video>
 *    and detects direct-link ad paths like /4/<32-hex>.
 *  - v3.2.4: Defers ambiguous navigations (clean search engine URLs, TLDs, commerce) in onBeforeNavigate
 *    to onCommitted so Chrome Omnibox / Back-Forward transitions are never falsely reverted.
 */
import {
  AUTH_PATH_OR_PARAM_REGEX,
  AUTH_PROVIDER_HOST_REGEX,
  AUTH_SUBDOMAIN_REGEX,
  CHALLENGE_HOST_REGEX,
  COMMERCE_AFFILIATE_REGEX,
  DIRECT_LINK_AD_PATH_REGEX,
  EXPLICIT_AD_NETWORK_HOST_REGEX,
  GAMBLING_AMBIGUOUS_TOKEN_REGEX,
  GAMBLING_SEARCH_WORD_REGEX,
  GAMBLING_SPECIFIC_REGEX,
  GAMBLING_TEXT_STRICT_REGEX,
  KNOWN_AD_SHORTENER_REGEX,
  MESSENGER_OR_SOCIAL_ENTRY_REGEX,
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
    "uc.sg",
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
    "uc.gu",
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
 * Extract explicit HTTP(S) destination wrapped inside Google's /url referrer-wrapper
 * (e.g., https://www.google.com/url?sa=t&url=https://tech8s.net/article/).
 * @param {string | URL} urlOrObj
 * @returns {string}
 */
export function extractGoogleRedirectTarget(urlOrObj) {
  if (!urlOrObj) return "";
  return safeTry(
    "uc.gr",
    () => {
      const u = urlOrObj instanceof URL ? urlOrObj : new URL(String(urlOrObj));
      if (!u.hostname.toLowerCase().includes("google.") || u.pathname !== "/url") return "";
      const raw = (u.searchParams.get("url") || u.searchParams.get("q") || "").trim();
      if (!raw || !/^https?:\/\//i.test(raw)) return "";
      const target = new URL(raw);
      return target.protocol === "http:" || target.protocol === "https:" ? target.href : "";
    },
    ""
  );
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
    "uc.ia",
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
 * Google /url with an explicit clean HTTP(S) target parameter is treated as a referrer wrapper rather than SERP hijack.
 * @param {string} urlStr
 * @param {string} [sourceUrl]
 * @returns {boolean}
 */
export function isSearchEngineHijackUrl(urlStr, sourceUrl = "") {
  if (!urlStr) return false;
  return safeTry(
    "uc.sh",
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

      if (SEARCH_ARBITRAGE_PARAMS.test(u.href)) return true;

      if (host.includes("google.") && u.pathname === "/url") {
        const target = extractGoogleRedirectTarget(u);
        if (target) {
          return isSearchEngineHijackUrl(target, sourceUrl) || hasGamblingSignalInUrl(target);
        }
      }

      const q = u.searchParams.get("q") || u.searchParams.get("p") || u.searchParams.get("text") || "";
      if (hasGamblingSignalInSearchQuery(q)) return true;

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
    "uc.hm",
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
 *  1. Blacklist (rules.denied) ALWAYS wins (including wrapped Google /url targets)
 *  2. Search-engine hijack from non-search page
 *  3. Hard ad/gambling/affiliate/direct-link/TLD signals on wrapped Google /url targets
 *  4. Whitelist / recentlyAllowed / CAPTCHA / same ecosystem
 *  5. P2: Legitimate OAuth/Auth flows (unless specific gambling hostname)
 *  6. Hard ad/gambling/affiliate/direct-link signals & Suspicious TLDs
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
    "uc.su",
    () => {
      const u = new URL(urlStr);
      const host = u.hostname.toLowerCase();
      const baseHost = getBaseDomain(host);
      const denied = rules.denied || [];
      const googleTarget = extractGoogleRedirectTarget(u);

      // 1. Blacklist ALWAYS wins (including wrapped target inside google.com/url)
      if (isDomainInList(urlStr, denied) || (googleTarget && isDomainInList(googleTarget, denied))) {
        return true;
      }

      // 2. Search-engine hijack from non-search page is suspicious even if google.com is in trusted
      if (isSearchEngineHijackUrl(urlStr, sourceUrl)) return true;

      // Never allow google.com/url wrapper to smuggle a hard-malicious or suspicious-TLD destination
      if (googleTarget) {
        if (isHardMaliciousUrl(googleTarget, denied)) return true;
        const targetHost = getHostname(googleTarget);
        if (targetHost && SUSPICIOUS_TLD.test(targetHost)) return true;
      }

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

      if (isHardMaliciousUrl(u.href, denied)) return true;

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
    "uc.db",
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
      const wrappedTarget = extractGoogleRedirectTarget(dest);
      const wrappedHost = wrappedTarget ? getHostname(wrappedTarget) : "";

      // 1. Explicit user Blacklist ALWAYS wins (including wrapped Google /url targets)
      if (
        isDomainInList(dest.href, ctx.denied || []) ||
        (wrappedTarget && isDomainInList(wrappedTarget, ctx.denied || []))
      ) {
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

      // Google /url referrer-wrapper targeting a clean same-base or trusted host (non-media-tap)
      if (wrappedTarget) {
        if (isHardMaliciousUrl(wrappedTarget, ctx.denied || [])) {
          return { block: true, reason: "hard_ad_or_gambling_pattern" };
        }
        if (wrappedHost && SUSPICIOUS_TLD.test(wrappedHost)) {
          return { block: true, reason: "suspicious_tld" };
        }
        if (ctx.hasRecentMediaTap && !ctx.hasRecentUserGesture) {
          return { block: true, reason: "media_tap_hijack" };
        }
        if (
          !ctx.hasRecentMediaTap &&
          (getBaseDomain(wrappedHost) === curBase ||
            isDomainInList(wrappedTarget, ctx.trusted || []))
        ) {
          return { block: false, reason: "same_base_domain_referrer_bounce" };
        }
      }

      if (isDomainInList(dest.href, ctx.trusted || [])) {
        return { block: false, reason: "trusted_whitelist" };
      }

      // 5. P2: Legitimate Auth/OAuth flow with user or auth gesture evaluated BEFORE generic hard patterns
      if (
        (ctx.hasRecentUserGesture || ctx.hasRecentAuthGesture) &&
        (isAuthFlowUrl(dest.href) || ctx.hasRecentAuthGesture) &&
        !hasSpecificGamblingHostname(dest)
      ) {
        return { block: false, reason: "auth_flow" };
      }

      // 6. Hard ad/gambling/affiliate/shortener/direct-link patterns
      if (isHardMaliciousUrl(dest.href, [])) return { block: true, reason: "hard_ad_or_gambling_pattern" };

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

/**
 * Detect threats that are unambiguous even BEFORE Chrome exposes transitionType/transitionQualifiers
 * (Blacklist, gambling hostnames, explicit ad-network hosts, search-arbitrage params, /4/<hex> direct-link ads, random short domains).
 * Excludes clean search engine pages, generic TLDs, and mainstream commerce hosts so omnibox & Back/Forward
 * navigations can be accurately evaluated in onCommitted.
 * @param {string} urlStr
 * @param {string[]} [deniedList]
 * @returns {boolean}
 */
export function isUnambiguousBeforeNavThreat(urlStr, deniedList = []) {
  if (!urlStr) return false;
  return safeTry(
    "uc.ubn",
    () => {
      const u = new URL(urlStr);
      const host = u.hostname.toLowerCase();
      const baseHost = getBaseDomain(host);
      if (isDomainInList(u.href, deniedList)) return true;
      return (
        hasGamblingSignalInUrl(u) ||
        EXPLICIT_AD_NETWORK_HOST_REGEX.test(host) ||
        RANDOM_SHORT_DOMAIN_REGEX.test(baseHost) ||
        SEARCH_ARBITRAGE_PARAMS.test(u.href) ||
        DIRECT_LINK_AD_PATH_REGEX.test(u.pathname)
      );
    },
    false
  );
}

/**
 * Evaluate chrome.webNavigation.onBeforeNavigate without falsely blocking browser-UI navigations
 * (Chrome Omnibox search, typed URL, bookmark, or Back/Forward) whose transitionType/qualifiers
 * are only available later in onCommitted.
 * @param {string} targetUrl
 * @param {object} [ctx]
 * @param {string} [ctx.currentUrl]
 * @param {number} [ctx.stackLength]
 * @param {string[]} [ctx.denied]
 * @param {string[]} [ctx.trusted]
 * @param {boolean} [ctx.isManuallyAllowed]
 * @param {boolean} [ctx.tempAllowActive]
 * @param {boolean} [ctx.captchaActive]
 * @param {boolean} [ctx.firstPageGraceActive]
 * @param {boolean} [ctx.shortlinkCtaGraceActive]
 * @param {boolean} [ctx.isLockedOrCoolingDown]
 * @returns {{ action: "allow" | "allow_manual" | "block" | "defer_to_committed", code?: string, durationMs?: number, isTargetBlacklisted: boolean, isHardMalicious: boolean, reason: string }}
 */
export function evaluateBeforeNavigateGuard(targetUrl, ctx = {}) {
  return safeTry(
    "uc.bn",
    () => {
      if (!targetUrl || !String(targetUrl).startsWith("http")) {
        return {
          action: "allow",
          isTargetBlacklisted: false,
          isHardMalicious: false,
          reason: "non_http"
        };
      }

      const denied = Array.isArray(ctx.denied) ? ctx.denied : [];
      const trusted = Array.isArray(ctx.trusted) ? ctx.trusted : [];
      const wrappedGoogleTarget = extractGoogleRedirectTarget(targetUrl);
      const isTargetBlacklisted = Boolean(
        isDomainInList(targetUrl, denied) ||
          (wrappedGoogleTarget && isDomainInList(wrappedGoogleTarget, denied))
      );

      // 1. Explicit Blacklist ALWAYS blocks immediately (even during omnibox/grace/temp-allow)
      if (isTargetBlacklisted) {
        return {
          action: "block",
          code: "BLOCK_BEFORE_NAV_BLACKLIST",
          isTargetBlacklisted: true,
          isHardMalicious: true,
          reason: "denied_blacklist"
        };
      }

      if (ctx.isManuallyAllowed) {
        return {
          action: "allow",
          isTargetBlacklisted: false,
          isHardMalicious: false,
          reason: "manual_allowed"
        };
      }
      if (!ctx.stackLength || !ctx.currentUrl || ctx.currentUrl === targetUrl) {
        return {
          action: "allow",
          isTargetBlacklisted: false,
          isHardMalicious: false,
          reason: "empty_or_same_stack"
        };
      }
      if (ctx.captchaActive || ctx.tempAllowActive) {
        return {
          action: "allow",
          isTargetBlacklisted: false,
          isHardMalicious: false,
          reason: "captcha_or_temp_allow"
        };
      }
      if (ctx.firstPageGraceActive) {
        return {
          action: "allow",
          isTargetBlacklisted: false,
          isHardMalicious: false,
          reason: "first_page_grace"
        };
      }
      if (ctx.isLockedOrCoolingDown) {
        return {
          action: "allow",
          isTargetBlacklisted: false,
          isHardMalicious: false,
          reason: "locked_or_cooldown"
        };
      }

      const prevHost = getHostname(ctx.currentUrl);
      const targetHost = getHostname(targetUrl);
      const prevBase = getBaseDomain(prevHost);
      const targetBase = getBaseDomain(targetHost);

      const isCleanWrappedSameBaseBounce = Boolean(
        wrappedGoogleTarget &&
          getBaseDomain(getHostname(wrappedGoogleTarget)) === prevBase &&
          !isHardMaliciousUrl(wrappedGoogleTarget, denied)
      );

      if (
        prevBase === targetBase ||
        isSameSafeEcosystem(prevHost, targetHost) ||
        isCleanWrappedSameBaseBounce
      ) {
        return {
          action: "allow",
          isTargetBlacklisted: false,
          isHardMalicious: false,
          reason: "same_base_or_ecosystem"
        };
      }

      const isCurrentSearchOrMessenger =
        SEARCH_ENGINE_HOST_REGEX.test(prevHost) || MESSENGER_OR_SOCIAL_ENTRY_REGEX.test(prevHost);
      if (isCurrentSearchOrMessenger) {
        return {
          action: "allow_manual",
          durationMs: 15000,
          isTargetBlacklisted: false,
          isHardMalicious: false,
          reason: "from_search_or_messenger"
        };
      }

      const isHardMaliciousTarget =
        isHardMaliciousUrl(targetUrl, denied) || isSearchEngineHijackUrl(targetUrl, ctx.currentUrl);

      if (ctx.shortlinkCtaGraceActive && !isHardMaliciousTarget) {
        return {
          action: "allow_manual",
          durationMs: 18000,
          isTargetBlacklisted: false,
          isHardMalicious: false,
          reason: "shortlink_cta_grace"
        };
      }

      if (SAFE_MEDIA_HOST_REGEX.test(targetHost) && !isHardMaliciousTarget) {
        return {
          action: "allow",
          isTargetBlacklisted: false,
          isHardMalicious: false,
          reason: "safe_media_host"
        };
      }

      if (isDomainInList(targetUrl, trusted)) {
        return {
          action: "allow",
          isTargetBlacklisted: false,
          isHardMalicious: false,
          reason: "trusted_whitelist"
        };
      }

      if (wrappedGoogleTarget && isHardMaliciousUrl(wrappedGoogleTarget, denied)) {
        return {
          action: "block",
          code: "BLOCK_BEFORE_NAV_SUSPICIOUS",
          isTargetBlacklisted: false,
          isHardMalicious: true,
          reason: "wrapped_google_hard_malicious"
        };
      }

      if (isUnambiguousBeforeNavThreat(targetUrl, denied)) {
        return {
          action: "block",
          code: "BLOCK_BEFORE_NAV_SUSPICIOUS",
          isTargetBlacklisted: false,
          isHardMalicious: true,
          reason: "unambiguous_before_nav_threat"
        };
      }

      return {
        action: "defer_to_committed",
        isTargetBlacklisted: false,
        isHardMalicious: false,
        reason: "defer_to_committed"
      };
    },
    {
      action: "allow",
      isTargetBlacklisted: false,
      isHardMalicious: false,
      reason: "guard_error"
    }
  );
}

/**
 * Determine whether a webNavigation.onCommitted event originated from trusted browser UI
 * (Omnibox search/URL, bookmark, start page, external API/intent, initial tab entry, or non-redirect manual reload).
 * @param {string} [transitionType]
 * @param {string[]} [qualifiers]
 * @param {number} [stackLength]
 * @returns {boolean}
 */
export function isBrowserInitiatedTransition(transitionType = "", qualifiers = [], stackLength = 0) {
  if (!stackLength) return true;
  const q = Array.isArray(qualifiers) ? qualifiers : [];
  if (
    transitionType === "auto_toplevel" ||
    transitionType === "typed" ||
    transitionType === "auto_bookmark" ||
    transitionType === "generated" ||
    transitionType === "keyword" ||
    transitionType === "keyword_generated" ||
    transitionType === "start_page" ||
    q.includes("from_address_bar") ||
    q.includes("from_api")
  ) {
    return true;
  }
  if (
    transitionType === "reload" &&
    !q.includes("server_redirect") &&
    !q.includes("client_redirect")
  ) {
    return true;
  }
  return false;
}

