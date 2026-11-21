// @ts-check
/**
 * AEGIS-AI Shield v3.2.0 — Consolidated Declarative Net Request (DNR) Rule Builder
 * Supports wildcard rules ("*.domain.com" & safe glob "*slot*.xyz"), deduplicates redundant
 * child subdomains when a parent domain is already blocked, and stays strictly within Chrome's
 * MAX_NUMBER_OF_DYNAMIC_RULES quota.
 */
import { TIMINGS } from "./constants.js";
import { extractExactHostFromRule, normalizeDomainEntry } from "./domain-utils.js";

export const DNR_BLOCKED_RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "script",
  "xmlhttprequest",
  "ping",
  "other"
];

/**
 * Remove redundant child subdomains when a parent domain is already in the exact host set
 * (Chrome DNR requestDomains automatically matches subdomains).
 * @param {string[]} hosts
 * @returns {string[]}
 */
export function deduplicateSubdomainHosts(hosts) {
  const unique = Array.from(new Set(hosts)).sort((a, b) => a.length - b.length);
  const keptSet = new Set();
  /** @type {string[]} */
  const result = [];

  for (const host of unique) {
    const labels = host.split(".");
    let coveredByParent = false;
    for (let i = 1; i < labels.length - 1; i++) {
      const parent = labels.slice(i).join(".");
      if (keptSet.has(parent)) {
        coveredByParent = true;
        break;
      }
    }
    if (!coveredByParent) {
      keptSet.add(host);
      result.push(host);
    }
  }
  return result;
}

/**
 * Build consolidated DNR dynamic rules from a raw blacklist array (exact hosts + wildcard patterns).
 * @param {string[]} deniedDomains
 * @param {number} [maxDynamicRules]
 * @param {number} [batchSize]
 * @returns {{ rules: Array<any>, totalDomains: number, ruleCount: number, truncatedCount: number, maxRules: number }}
 */
export function buildConsolidatedDnrRules(
  deniedDomains,
  maxDynamicRules = TIMINGS.DNR_FALLBACK_MAX_RULES,
  batchSize = TIMINGS.DNR_BATCH_SIZE
) {
  const safeMaxRules = Math.max(
    1,
    Math.min(30000, Number(maxDynamicRules) || TIMINGS.DNR_FALLBACK_MAX_RULES)
  );
  const safeBatchSize = Math.max(1, Math.min(500, Number(batchSize) || TIMINGS.DNR_BATCH_SIZE));

  /** @type {string[]} */
  const rawExactHosts = [];
  /** @type {string[]} */
  const globWildcards = [];

  for (const raw of Array.isArray(deniedDomains) ? deniedDomains : []) {
    const norm = normalizeDomainEntry(raw);
    if (!norm) continue;
    const exact = extractExactHostFromRule(norm);
    if (exact) {
      rawExactHosts.push(exact);
    } else if (norm.includes("*")) {
      globWildcards.push(norm);
    }
  }

  const dedupedHosts = deduplicateSubdomainHosts(rawExactHosts);
  const uniqueGlobs = Array.from(new Set(globWildcards));

  // Reserve space for batched domain rules first, then up to remaining slots for glob urlFilter rules
  const maxSupportedExactHosts = safeMaxRules * safeBatchSize;
  const effectiveHosts = dedupedHosts.slice(0, maxSupportedExactHosts);
  let truncatedCount = Math.max(0, dedupedHosts.length - effectiveHosts.length);

  const rules = [];
  for (let i = 0; i < effectiveHosts.length; i += safeBatchSize) {
    const chunk = effectiveHosts.slice(i, i + safeBatchSize);
    rules.push({
      id: rules.length + 1,
      priority: 1,
      action: { type: "block" },
      condition: {
        requestDomains: chunk,
        resourceTypes: DNR_BLOCKED_RESOURCE_TYPES
      }
    });
  }

  // Add glob wildcard rules (e.g., "*slot*.xyz" -> urlFilter: "||*slot*.xyz^") if rule budget remains
  for (const glob of uniqueGlobs) {
    if (rules.length >= safeMaxRules) {
      truncatedCount += 1;
      continue;
    }
    rules.push({
      id: rules.length + 1,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: `||${glob}^`,
        resourceTypes: DNR_BLOCKED_RESOURCE_TYPES
      }
    });
  }

  return {
    rules,
    totalDomains: effectiveHosts.length + Math.max(0, uniqueGlobs.length - Math.max(0, truncatedCount - Math.max(0, dedupedHosts.length - effectiveHosts.length))),
    ruleCount: rules.length,
    truncatedCount,
    maxRules: safeMaxRules
  };
}
