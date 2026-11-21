// @ts-check
/**
 * AEGIS-AI Shield v3.2.0 — Domain Utilities, Wildcard Matcher, Hostlist Parser/Exporter & Temp Allow
 * Fixes subdomain over-matching: blocking "ads.example.com" blocks ONLY ads.example.com & *.ads.example.com,
 * never "www.example.com". Supports consistent wildcard patterns ("*.example.com", "*slot*.xyz").
 */
import { SAFE_ECOSYSTEM_GROUPS } from "./constants.js";
import { safeTry } from "./debug.js";

const SECOND_LEVEL_PUBLIC_SUFFIXES = new Set([
  "co",
  "com",
  "net",
  "org",
  "ac",
  "go",
  "or",
  "web",
  "sch"
]);

const VALID_DOMAIN_REGEX =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

// Safe wildcard host pattern (must contain at least one dot and only hostname chars + '*')
const VALID_WILDCARD_DOMAIN_REGEX =
  /^(?:\*|[a-z0-9*-]{1,63})(?:\.(?:\*|[a-z0-9*-]{1,63}))+$/i;

/**
 * Extract lowercase hostname from a URL string safely.
 * @param {string} urlStr
 * @param {string} [baseHref]
 * @returns {string}
 */
export function getHostname(urlStr, baseHref) {
  if (!urlStr) return "";
  return safeTry(
    "domainUtils.getHostname",
    () => {
      const u = baseHref ? new URL(urlStr, baseHref) : new URL(urlStr);
      return (u.hostname || "").toLowerCase();
    },
    ""
  );
}

/**
 * Compute base/registrable domain (e.g., sub.example.co.id -> example.co.id).
 * @param {string} hostname
 * @returns {string}
 */
export function getBaseDomain(hostname) {
  const clean = String(hostname || "").trim().toLowerCase().replace(/^www\./, "");
  const parts = clean.split(".").filter(Boolean);
  if (parts.length <= 2) return clean;
  const sld = parts[parts.length - 2];
  if (SECOND_LEVEL_PUBLIC_SUFFIXES.has(sld) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

/**
 * Normalize a user-supplied domain, URL, or wildcard pattern into a clean rule string.
 * Supports plain domains ("example.com"), AdBlock ("||example.com^"), URLs, and wildcards ("*.ads.example.com", "*slot*.xyz").
 * @param {string} raw
 * @returns {string}
 */
export function normalizeDomainEntry(raw) {
  if (!raw) return "";
  let val = String(raw).trim().toLowerCase();
  if (!val) return "";
  val = safeTry(
    "domainUtils.normalizeDomainEntry",
    () => {
      if (val.includes("://")) {
        return new URL(val).hostname.toLowerCase();
      }
      return val
        .replace(/^\|\|/, "")
        .replace(/\^.*$/, "")
        .split("/")[0]
        .split("?")[0]
        .split("#")[0]
        .split(":")[0];
    },
    val.split("/")[0].split("?")[0].split("#")[0]
  );

  // Strip leading "*." ONLY if remaining is a valid standard domain -> keep consistent subdomain matching
  if (val.startsWith("*.")) {
    const rest = val.slice(2).replace(/^www\./, "").trim();
    if (VALID_DOMAIN_REGEX.test(rest)) return `*.${rest}`;
    if (VALID_WILDCARD_DOMAIN_REGEX.test(val) && !/^\*(\.\*)+$/.test(val)) return val;
    return "";
  }

  val = val.replace(/^www\./, "").trim();
  if (!val) return "";
  if (VALID_DOMAIN_REGEX.test(val)) return val;
  if (val.includes("*") && VALID_WILDCARD_DOMAIN_REGEX.test(val) && !/^\*(\.\*)+$/.test(val)) {
    // Reject overly broad wildcards like "*.com" or "*.*"
    const nonStarLabels = val.split(".").filter((lbl) => lbl && !/^\*+$/.test(lbl));
    if (nonStarLabels.length < 1 || val.split(".").length < 2) return "";
    if (/^\*\.[a-z]{2,6}$/i.test(val)) return "";
    return val;
  }
  return "";
}

/**
 * Strip leading "*." from a normalized rule to get a concrete hostname when possible (for DNR requestDomains).
 * Returns "" if the rule contains internal glob wildcards (e.g., "*slot*.xyz").
 * @param {string} rule
 * @returns {string}
 */
export function extractExactHostFromRule(rule) {
  const norm = normalizeDomainEntry(rule);
  if (!norm) return "";
  const stripped = norm.startsWith("*.") ? norm.slice(2) : norm;
  if (stripped.includes("*")) return "";
  return VALID_DOMAIN_REGEX.test(stripped) ? stripped : "";
}

/**
 * Match a concrete lowercase hostname against a single normalized rule (exact, subdomain, or wildcard glob).
 * Exact subdomain rules ("ads.example.com") match ONLY "ads.example.com" and "*.ads.example.com",
 * NEVER sibling subdomains ("www.example.com") or the parent apex ("example.com").
 * @param {string} host
 * @param {string} rule
 * @returns {boolean}
 */
export function matchHostnameAgainstRule(host, rule) {
  if (!host || !rule) return false;
  const cleanHost = host.toLowerCase().replace(/^www\./, "");
  const normRule = normalizeDomainEntry(rule);
  if (!normRule) return false;

  // Standard "*.domain.tld" matches both domain.tld and any subdomain *.domain.tld
  if (normRule.startsWith("*.")) {
    const suffix = normRule.slice(2);
    if (!suffix.includes("*")) {
      return cleanHost === suffix || cleanHost.endsWith("." + suffix);
    }
  }

  // Glob wildcard pattern (e.g., "*slot*.xyz" or "ad*.example.com")
  if (normRule.includes("*")) {
    const escaped = normRule
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "[a-z0-9.-]*");
    const rx = new RegExp(`^(?:[a-z0-9-]+\\.)*${escaped}$`, "i");
    return rx.test(cleanHost);
  }

  // Exact domain rule (e.g., "hai8g.com" matches hai8g.com & sub.hai8g.com;
  // "ads.example.com" matches ads.example.com & sub.ads.example.com, NOT example.com or www.example.com)
  return cleanHost === normRule || cleanHost.endsWith("." + normRule);
}

/**
 * Check if a URL matches any domain or wildcard rule in a list.
 * @param {string} urlStr
 * @param {string[]} list
 * @param {string} [baseHref]
 * @returns {boolean}
 */
export function isDomainInList(urlStr, list, baseHref) {
  if (!urlStr || !Array.isArray(list) || list.length === 0) return false;
  const host = getHostname(urlStr, baseHref).replace(/^www\./, "");
  if (!host) return false;
  for (const item of list) {
    if (matchHostnameAgainstRule(host, item)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if two hostnames belong to the same trusted big-tech ecosystem.
 * @param {string} hostA
 * @param {string} hostB
 * @returns {boolean}
 */
export function isSameSafeEcosystem(hostA, hostB) {
  if (!hostA || !hostB) return false;
  return SAFE_ECOSYSTEM_GROUPS.some((rx) => rx.test(hostA) && rx.test(hostB));
}

/**
 * Parse a plain-text hostlist (supports hosts format, AdBlock ||domain^, wildcards, or plain domains per line).
 * @param {string} rawText
 * @returns {string[]}
 */
export function parseHostlistText(rawText) {
  if (!rawText || typeof rawText !== "string") return [];
  const results = new Set();
  const lines = rawText.split(/\r?\n/);
  for (const rawLine of lines) {
    const noComment = rawLine.replace(/[#!;].*$/, "").trim();
    if (!noComment) continue;
    const tokens = noComment.split(/\s+/).filter(Boolean);
    const candidate =
      tokens.length >= 2 && /^(0\.0\.0\.0|127\.0\.0\.1|::1?)$/.test(tokens[0])
        ? tokens[1]
        : tokens[0];
    const clean = normalizeDomainEntry(candidate);
    if (clean && clean !== "localhost") {
      results.add(clean);
    }
  }
  return Array.from(results);
}

/**
 * Export a domain array into a clean plain-text hostlist format.
 * @param {string[]} domains
 * @param {string} [title]
 * @returns {string}
 */
export function exportHostlistText(domains, title = "AEGIS-AI Shield v3.2.0 Hostlist") {
  const unique = Array.from(
    new Set((Array.isArray(domains) ? domains : []).map(normalizeDomainEntry).filter(Boolean))
  ).sort();
  return [
    `# ${title}`,
    `# Total: ${unique.length} domain | Format: 1 domain atau wildcard (*.domain.com) per baris`,
    "",
    ...unique
  ].join("\n");
}

/**
 * Check whether a URL's base domain or hostname currently has an active Temporary Allow / Safe Mode window.
 * @param {Record<string, number>} tempAllowMap Map of domain -> expiresAt timestamp (ms)
 * @param {string} urlStr
 * @param {number} [now]
 * @returns {{ active: boolean, domain: string, remainingMs: number }}
 */
export function getTemporaryAllowState(tempAllowMap, urlStr, now = Date.now()) {
  if (!tempAllowMap || typeof tempAllowMap !== "object" || !urlStr) {
    return { active: false, domain: "", remainingMs: 0 };
  }
  const host = getHostname(urlStr).replace(/^www\./, "");
  if (!host) return { active: false, domain: "", remainingMs: 0 };
  const base = getBaseDomain(host);
  const candidates = [host, base];

  for (const key of candidates) {
    const exp = Number(tempAllowMap[key]);
    if (Number.isFinite(exp) && exp > now) {
      return { active: true, domain: key, remainingMs: exp - now };
    }
  }
  return { active: false, domain: "", remainingMs: 0 };
}

/**
 * Remove expired entries from a Temporary Allow map.
 * @param {Record<string, number>} tempAllowMap
 * @param {number} [now]
 * @returns {Record<string, number>}
 */
export function pruneExpiredTempAllows(tempAllowMap, now = Date.now()) {
  /** @type {Record<string, number>} */
  const next = {};
  if (!tempAllowMap || typeof tempAllowMap !== "object") return next;
  for (const [dom, exp] of Object.entries(tempAllowMap)) {
    if (Number.isFinite(Number(exp)) && Number(exp) > now) {
      next[dom] = Number(exp);
    }
  }
  return next;
}
