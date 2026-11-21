// @ts-check
/**
 * AEGIS-AI Shield v3.2.1 — Smart Shortlink Decoder, Nested Multi-Layer Unwrapper & Anti-Ad Trap Scorer
 * Supports nested shortlinks (depth up to 4), single/double Base64, URL-safe Base64, reversed strings,
 * hidden WP Safelink JSON, meta-refresh targets, Google Search hijack rejection, and fake-vs-real CTA scoring.
 */
import {
  COMMERCE_AFFILIATE_REGEX,
  DIRECT_LINK_AD_PATH_REGEX,
  DISGUISED_AD_CLASS_REGEX,
  KNOWN_AD_SHORTENER_REGEX,
  SAFE_MEDIA_HOST_REGEX,
  SEARCH_ARBITRAGE_PARAMS,
  SEARCH_ENGINE_HOST_REGEX,
  SUSPICIOUS_TLD
} from "./constants.js";
import { safeTry } from "./debug.js";
import { getBaseDomain, getHostname, isDomainInList } from "./domain-utils.js";
import {
  hasGamblingSignalInText,
  hasGamblingSignalInUrl,
  isSearchEngineHijackUrl
} from "./url-classifier.js";

const SHORTLINK_QUERY_KEYS = [
  "url",
  "u",
  "go",
  "to",
  "target",
  "dest",
  "destination",
  "link",
  "r",
  "redir",
  "redirect",
  "o",
  "site",
  "next",
  "out",
  "a",
  "b",
  "data",
  "safelink",
  "id"
];

const FAKE_AD_BUTTON_TEXT_REGEX =
  /(download\s*(now|fast|hd|free|manager|apk|vpn)|install\s*(now|extension|app|vpn)|play\s*now|claim\s*bonus|daftar\s*sekarang|spin|jackpot|register\s*free|watch\s*free\s*hd|high\s*speed\s*download|direct\s*download\s*ad|sponsored|advertisement)/i;

/**
 * Safely decode standard or URL-safe Base64 strings.
 * @param {string} raw
 * @returns {string}
 */
export function safeShortlinkBase64Decode(raw) {
  return safeTry(
    "shortlinkDecoder.base64",
    () => {
      let normalized = String(raw || "").trim().replace(/-/g, "+").replace(/_/g, "/");
      if (!normalized || normalized.length < 8) return "";
      if (!/^[A-Za-z0-9+/=]+$/.test(normalized)) return "";
      while (normalized.length % 4 !== 0) normalized += "=";
      return atob(normalized);
    },
    ""
  );
}

/**
 * Extract an HTTP(S) URL directly or from embedded JSON payloads (e.g. newwpsafelink).
 * @param {string} raw
 * @returns {string}
 */
export function extractHttpUrlFromDecodedStr(raw) {
  if (!raw || typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (/^https?:\/\/[^\s"'<>]+$/i.test(trimmed)) return trimmed;
  const fromJson = safeTry(
    "shortlinkDecoder.jsonExtract",
    () => {
      if (!trimmed.startsWith("{")) return "";
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        for (const key of ["linkr", "url", "link", "target", "go", "dest", "redirect"]) {
          const val = parsed[key];
          if (typeof val === "string" && /^https?:\/\/[^\s"'<>]+/i.test(val.trim())) {
            return val.trim();
          }
        }
      }
      return "";
    },
    ""
  );
  if (fromJson) return fromJson;
  const m = trimmed.match(/https?:\/\/[^\s"'<>\\]+/i);
  return m ? m[0] : "";
}

/**
 * Attempt to decode a shortlink query/hash/input candidate via direct, reversed, single/double Base64.
 * @param {string} rawValue
 * @returns {{ url: string, method: string } | null}
 */
export function decodeShortlinkCandidateValue(rawValue) {
  if (!rawValue || typeof rawValue !== "string") return null;
  let val = rawValue.trim();
  if (val.length < 8 || val.length > 2400) return null;

  val = safeTry(
    "shortlinkDecoder.decodeURI",
    () => {
      const dec = decodeURIComponent(val);
      return dec ? dec.trim() : val;
    },
    val
  );

  if (/^https?:\/\//i.test(val)) {
    return { url: val, method: "QUERY_PLAIN" };
  }

  const revPlain = val.split("").reverse().join("");
  if (/^https?:\/\//i.test(revPlain)) {
    return { url: revPlain, method: "QUERY_REVERSED" };
  }

  const b1 = safeShortlinkBase64Decode(val);
  if (b1) {
    const u1 = extractHttpUrlFromDecodedStr(b1);
    if (u1) return { url: u1, method: "QUERY_BASE64" };
    const b2 = safeShortlinkBase64Decode(b1);
    if (b2) {
      const u2 = extractHttpUrlFromDecodedStr(b2);
      if (u2) return { url: u2, method: "QUERY_DOUBLE_BASE64" };
    }
  }

  const revB1 = safeShortlinkBase64Decode(revPlain);
  if (revB1) {
    const ru1 = extractHttpUrlFromDecodedStr(revB1);
    if (ru1) return { url: ru1, method: "QUERY_REVERSED_BASE64" };
  }

  return null;
}

/**
 * Recursively unwrap nested shortlink/redirect URLs (e.g., safelink1 -> ?go=b64(safelink2?url=b64(realUrl)))
 * up to maxDepth layers while preventing circular loops.
 * @param {string} candidateUrl
 * @param {number} [maxDepth]
 * @returns {{ url: string, layers: number }}
 */
export function unwrapNestedShortlinkUrl(candidateUrl, maxDepth = 4) {
  let current = candidateUrl;
  let layers = 0;
  const visited = new Set([candidateUrl]);

  for (let depth = 0; depth < maxDepth; depth++) {
    const nextUrl = safeTry(
      "shortlinkDecoder.unwrapLayer",
      () => {
        const u = new URL(current);
        for (const key of SHORTLINK_QUERY_KEYS) {
          const val = u.searchParams.get(key);
          if (!val) continue;
          const decoded = decodeShortlinkCandidateValue(val);
          if (decoded && decoded.url && !visited.has(decoded.url)) {
            return decoded.url;
          }
        }
        if (u.hash && u.hash.length > 10) {
          const hashRaw = u.hash.replace(/^#!?\/?/, "");
          const decodedHash = decodeShortlinkCandidateValue(hashRaw);
          if (decodedHash && decodedHash.url && !visited.has(decodedHash.url)) {
            return decodedHash.url;
          }
        }
        return "";
      },
      ""
    );

    if (!nextUrl) break;
    visited.add(nextUrl);
    current = nextUrl;
    layers += 1;
  }

  return { url: current, layers };
}

/**
 * Verify that a decoded shortlink bypass target is safe:
 * rejects same-origin loops, blacklisted hosts, gambling/affiliate traps, Google/Bing/Yahoo search hijacks,
 * and dead-end known ad shorteners.
 * @param {string} candidateUrl
 * @param {string} pageUrl
 * @param {string[]} [deniedList]
 * @returns {boolean}
 */
export function isShortlinkBypassTargetSafe(candidateUrl, pageUrl, deniedList = []) {
  if (!candidateUrl) return false;
  return safeTry(
    "shortlinkDecoder.isTargetSafe",
    () => {
      const target = new URL(candidateUrl);
      if (target.protocol !== "http:" && target.protocol !== "https:") return false;
      const cur = new URL(pageUrl);
      if (target.href === cur.href) return false;
      const targetHost = target.hostname.toLowerCase();
      const curHost = cur.hostname.toLowerCase();
      if (getBaseDomain(targetHost) === getBaseDomain(curHost)) return false;
      if (isDomainInList(target.href, deniedList)) return false;
      // Never redirect users to Google/Bing/Yahoo/DDG search pages as a "shortlink destination"
      if (isSearchEngineHijackUrl(target.href, pageUrl)) return false;
      if (SEARCH_ENGINE_HOST_REGEX.test(targetHost) && (target.pathname === "/" || target.pathname === "/search")) {
        return false;
      }
      if (
        hasGamblingSignalInUrl(target) ||
        COMMERCE_AFFILIATE_REGEX.test(target.href) ||
        SEARCH_ARBITRAGE_PARAMS.test(target.href) ||
        KNOWN_AD_SHORTENER_REGEX.test(targetHost) ||
        DIRECT_LINK_AD_PATH_REGEX.test(target.pathname)
      ) {
        return false;
      }
      return true;
    },
    false
  );
}

/**
 * Pure extractor for direct (and nested multi-layer) shortlink destinations from URL query/hash,
 * hidden inputs, or meta-refresh.
 * @param {object} input
 * @param {string} input.pageUrl
 * @param {string[]} [input.hiddenValues]
 * @param {string} [input.metaRefreshContent]
 * @param {string[]} [input.deniedList]
 * @returns {{ found: boolean, url: string, method: string, layers?: number }}
 */
export function extractDirectShortlinkFromInputs({
  pageUrl,
  hiddenValues = [],
  metaRefreshContent = "",
  deniedList = []
}) {
  return safeTry(
    "shortlinkDecoder.extractDirect",
    () => {
      const u = new URL(pageUrl);

      /** @param {string} rawUrl @param {string} baseMethod */
      const tryFinalize = (rawUrl, baseMethod) => {
        const unwrapped = unwrapNestedShortlinkUrl(rawUrl, 4);
        if (isShortlinkBypassTargetSafe(unwrapped.url, pageUrl, deniedList)) {
          return {
            found: true,
            url: unwrapped.url,
            method: unwrapped.layers > 0 ? `${baseMethod}_NESTED_${unwrapped.layers + 1}L` : baseMethod,
            layers: unwrapped.layers + 1
          };
        }
        return null;
      };

      for (const key of SHORTLINK_QUERY_KEYS) {
        const val = u.searchParams.get(key);
        if (!val) continue;
        const decoded = decodeShortlinkCandidateValue(val);
        if (decoded) {
          const hit = tryFinalize(decoded.url, decoded.method);
          if (hit) return hit;
        }
      }

      if (u.hash && u.hash.length > 10) {
        const hashRaw = u.hash.replace(/^#!?\/?/, "");
        const decodedHash = decodeShortlinkCandidateValue(hashRaw);
        if (decodedHash) {
          const hit = tryFinalize(decodedHash.url, "HASH_DECODED");
          if (hit) return hit;
        }
      }

      for (const rawVal of hiddenValues) {
        if (!rawVal) continue;
        const decoded = decodeShortlinkCandidateValue(rawVal);
        if (decoded) {
          const hit = tryFinalize(decoded.url, "HIDDEN_INPUT_SAFELINK");
          if (hit) return hit;
        }
      }

      if (metaRefreshContent) {
        const m = metaRefreshContent.match(/url\s*=\s*['"]?(https?:\/\/[^'";\s]+)/i);
        if (m && m[1]) {
          const hit = tryFinalize(m[1], "META_REFRESH");
          if (hit) return hit;
        }
      }
      return { found: false, url: "", method: "NONE" };
    },
    { found: false, url: "", method: "NONE" }
  );
}

/**
 * Score a button/link candidate on a shortlink page to distinguish genuine Continue/Get Link CTAs
 * from fake ad/affiliate/gambling/VPN/Google-Search trap buttons.
 * Positive score >= 3 indicates a strong genuine CTA; negative score indicates likely fake ad trap.
 * @param {{ rawHref?: string, text?: string, id?: string, className?: string, cardText?: string, pageUrl?: string, deniedList?: string[] }} info
 * @returns {{ score: number, isFakeAd: boolean, reason: string }}
 */
export function scoreShortlinkButtonCandidate(info) {
  const rawHref = String(info.rawHref || "").trim();
  const text = String(info.text || "").trim().toLowerCase();
  const idCls = `${info.id || ""} ${info.className || ""}`.toLowerCase();
  const cardText = String(info.cardText || "").toLowerCase();
  const pageUrl = info.pageUrl || "https://shortlink.local/";
  const deniedList = info.deniedList || [];

  // Immediate disqualification: fake ad class, gambling/affiliate URL, blacklisted host, or Google Search hijack
  if (DISGUISED_AD_CLASS_REGEX.test(idCls)) {
    return { score: -10, isFakeAd: true, reason: "disguised_ad_class" };
  }
  if (FAKE_AD_BUTTON_TEXT_REGEX.test(text) || hasGamblingSignalInText(text)) {
    return { score: -8, isFakeAd: true, reason: "fake_ad_cta_text" };
  }
  if (rawHref && !rawHref.startsWith("#") && !rawHref.startsWith("javascript:")) {
    const abs = safeTry("shortlinkDecoder.scoreHref", () => new URL(rawHref, pageUrl).href, "");
    if (abs) {
      const host = getHostname(abs);
      const absPathname = safeTry("shortlinkDecoder.scorePath", () => new URL(abs).pathname, "");
      if (
        isDomainInList(abs, deniedList) ||
        hasGamblingSignalInUrl(abs) ||
        COMMERCE_AFFILIATE_REGEX.test(abs) ||
        SEARCH_ARBITRAGE_PARAMS.test(abs) ||
        DIRECT_LINK_AD_PATH_REGEX.test(absPathname) ||
        isSearchEngineHijackUrl(abs, pageUrl)
      ) {
        return { score: -10, isFakeAd: true, reason: "malicious_or_search_hijack_href" };
      }
      if (SAFE_MEDIA_HOST_REGEX.test(host)) {
        return { score: 8, isFakeAd: false, reason: "safe_media_destination" };
      }
    }
  }

  let score = 0;
  const hasTokenQuery = /[?&](download|dl|go|token|t|hash|key|id|redirect|link)=/i.test(rawHref);
  const hasCtaText =
    /(go\s*to\s*link|get\s*link|lanjut(kan)?|visit\s*link|open\s*link|download|unduh|buka\s*link|continue|proceed|skip\s*ad|menuju\s*link)/i.test(
      text
    );
  const hasCtaIdOrClass =
    /(babay|get-?link|go-?link|wpsafe|btn-?download|btn-?continue|redirect-?btn|skip-?btn)/i.test(idCls);
  const hasRedirectCardHint =
    /(redirect\s*ready|please\s*wait|link\s*ready|your\s*link\s*is\s*almost\s*ready|tunggu\s*sebentar)/i.test(
      cardText
    );

  if (hasTokenQuery) score += 3;
  if (hasCtaText) score += 3;
  if (hasCtaIdOrClass) score += 3;
  if (hasRedirectCardHint) score += 1;

  // Penalize suspicious external TLDs unless same-origin token query
  if (rawHref.startsWith("http")) {
    const h = getHostname(rawHref);
    const pageHost = getHostname(pageUrl);
    if (h && pageHost && getBaseDomain(h) !== getBaseDomain(pageHost) && SUSPICIOUS_TLD.test(h)) {
      score -= 4;
    }
  }

  return {
    score,
    isFakeAd: score < 0,
    reason: score >= 4 ? "verified_cta" : "ambiguous_candidate"
  };
}

/**
 * Determine if an anchor/button represents a legitimate shortlink CTA (e.g. "Go To Link", "?download=1&t=...").
 * Rejects fake ad/gambling/affiliate/Google-Search trap buttons automatically.
 * @param {{ rawHref?: string, text?: string, id?: string, className?: string, cardText?: string, pageUrl?: string, deniedList?: string[] }} info
 * @returns {boolean}
 */
export function isShortlinkCtaCandidate(info) {
  const scored = scoreShortlinkButtonCandidate(info);
  if (scored.isFakeAd) return false;
  return scored.score >= 4;
}
