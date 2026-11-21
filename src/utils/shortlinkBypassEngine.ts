import {
  COMMERCE_AFFILIATE_REGEX,
  GAMBLING_REGEX,
  RANDOM_SHORT_DOMAIN_REGEX,
  SEARCH_ARBITRAGE_PARAMS_REGEX,
  getBaseDomain,
  isDomainMatchedInList,
} from './smartContentClassifier';

export type AegisLogLevel = 'BLOCK' | 'ALLOW' | 'BYPASS' | 'WARN' | 'DEBUG';
export type AegisLogSource = 'background' | 'content' | 'main_world';

export interface AegisLogEntry {
  id: string;
  ts: number;
  level: AegisLogLevel;
  source: AegisLogSource;
  code: string;
  fromUrl: string;
  toUrl?: string;
  detail: string;
}

export interface ShortlinkExtractContext {
  pageUrl: string;
  metaRefreshContent?: string;
  hiddenInputValues?: Array<{ name: string; value: string }>;
  deniedDomains?: string[];
}

export interface ShortlinkExtractResult {
  found: boolean;
  decodedUrl: string;
  method:
    | 'NONE'
    | 'QUERY_DIRECT'
    | 'QUERY_BASE64'
    | 'QUERY_DOUBLE_BASE64'
    | 'QUERY_REVERSED'
    | 'HASH_BASE64'
    | 'HIDDEN_INPUT_PAYLOAD'
    | 'META_REFRESH';
  blockedReason?: string;
}

export interface ShortlinkStepDomSpec {
  hasVisibleUnsolvedCaptcha: boolean;
  hasAdLinkFlyForm: boolean;
  ctaHref?: string;
  ctaText?: string;
  ctaDisabled?: boolean;
  ctaId?: string;
  ctaMatchesAdSlot?: boolean;
  deniedDomains?: string[];
  pageUrl: string;
}

export interface ShortlinkStepVerdict {
  action: 'WAIT_FOR_CAPTCHA' | 'WAIT_FOR_TIMER' | 'SUBMIT_FORM' | 'AUTO_CLICK_CTA' | 'SKIP_AD_OR_BLACKLIST' | 'NO_ACTION';
  reason: string;
  targetUrl?: string;
}

const SHORTLINK_QUERY_KEYS = [
  'url',
  'u',
  'to',
  'go',
  'link',
  'r',
  'o',
  'site',
  'target',
  'dest',
  'destination',
  'redirect',
  'k',
  'm',
  'd',
  'l',
  'data',
];

function safeBase64Decode(raw: string): string | null {
  try {
    const cleaned = raw.trim().replace(/-/g, '+').replace(/_/g, '/');
    if (cleaned.length < 8 || !/^[A-Za-z0-9+/=]+$/.test(cleaned)) return null;
    const padded = cleaned + '='.repeat((4 - (cleaned.length % 4)) % 4);
    const decoded = atob(padded);
    if (!decoded || /[\x00-\x08\x0E-\x1F]/.test(decoded)) return null;
    return decoded.trim();
  } catch {
    return null;
  }
}

function tryExtractHttpUrlFromString(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^https?:\/\/[^\s"'<>]+$/i.test(trimmed)) {
    return trimmed;
  }
  // JSON payload like {"url":"https://..."} or {"link":"https://..."} (common in WP Safelink)
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed);
      const candidate = obj.url || obj.link || obj.target || obj.to || obj.href || '';
      if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate.trim())) {
        return candidate.trim();
      }
    } catch {
      // ignore invalid JSON
    }
  }
  return null;
}

export function isDestinationSafeForBypass(
  candidateUrl: string,
  pageUrl: string,
  deniedDomains: string[] = []
): { safe: boolean; reason?: string } {
  try {
    const page = new URL(pageUrl);
    const dest = new URL(candidateUrl, page.href);
    if (dest.protocol !== 'http:' && dest.protocol !== 'https:') {
      return { safe: false, reason: 'Protokol non-HTTP ditolak' };
    }
    if (dest.href === page.href) {
      return { safe: false, reason: 'URL sama dengan halaman saat ini' };
    }
    if (isDomainMatchedInList(dest.href, deniedDomains)) {
      return { safe: false, reason: 'Domain hasil decode ada di Blacklist' };
    }
    const host = dest.hostname.toLowerCase();
    const base = getBaseDomain(host);
    if (
      GAMBLING_REGEX.test(dest.href) ||
      COMMERCE_AFFILIATE_REGEX.test(dest.href) ||
      SEARCH_ARBITRAGE_PARAMS_REGEX.test(dest.href) ||
      RANDOM_SHORT_DOMAIN_REGEX.test(base)
    ) {
      return { safe: false, reason: 'URL hasil decode terdeteksi iklan/judol/affiliate' };
    }
    return { safe: true };
  } catch {
    return { safe: false, reason: 'Format URL tidak valid' };
  }
}

function decodeEncodedCandidate(
  rawValue: string
): { url: string; method: 'QUERY_DIRECT' | 'QUERY_BASE64' | 'QUERY_DOUBLE_BASE64' | 'QUERY_REVERSED' } | null {
  if (!rawValue || rawValue.length < 8) return null;

  let uriDecoded = rawValue.trim();
  try {
    uriDecoded = decodeURIComponent(uriDecoded);
  } catch {
    // keep raw
  }

  // 1. Direct HTTP(S) URL
  const direct = tryExtractHttpUrlFromString(uriDecoded);
  if (direct) {
    return { url: direct, method: 'QUERY_DIRECT' };
  }

  // 2. Reversed plain HTTP(S) URL (e.g. moc.elpmaxe//:sptth)
  const reversedPlain = uriDecoded.split('').reverse().join('');
  const revDirect = tryExtractHttpUrlFromString(reversedPlain);
  if (revDirect) {
    return { url: revDirect, method: 'QUERY_REVERSED' };
  }

  // 3. Single Base64 (standard / URL-safe / JSON-in-Base64)
  const b64Once = safeBase64Decode(uriDecoded);
  if (b64Once) {
    const fromOnce = tryExtractHttpUrlFromString(b64Once);
    if (fromOnce) {
      return { url: fromOnce, method: 'QUERY_BASE64' };
    }
    const revB64Once = tryExtractHttpUrlFromString(b64Once.split('').reverse().join(''));
    if (revB64Once) {
      return { url: revB64Once, method: 'QUERY_REVERSED' };
    }
    // 4. Double Base64 (used by several Indonesian Blogger/WP safelinks)
    const b64Twice = safeBase64Decode(b64Once);
    if (b64Twice) {
      const fromTwice = tryExtractHttpUrlFromString(b64Twice);
      if (fromTwice) {
        return { url: fromTwice, method: 'QUERY_DOUBLE_BASE64' };
      }
    }
  }

  // 5. Reversed Base64 (e.g., ==QbvNmL...)
  const b64Reversed = safeBase64Decode(reversedPlain);
  if (b64Reversed) {
    const fromRevB64 = tryExtractHttpUrlFromString(b64Reversed);
    if (fromRevB64) {
      return { url: fromRevB64, method: 'QUERY_REVERSED' };
    }
  }

  return null;
}

export function extractDirectShortlinkUrl(ctx: ShortlinkExtractContext): ShortlinkExtractResult {
  const denied = ctx.deniedDomains || [];
  let page: URL;
  try {
    page = new URL(ctx.pageUrl);
  } catch {
    return { found: false, decodedUrl: '', method: 'NONE' };
  }

  // 1. Scan known safelink/shortlink query parameters
  for (const key of SHORTLINK_QUERY_KEYS) {
    const val = page.searchParams.get(key);
    if (!val) continue;
    const decoded = decodeEncodedCandidate(val);
    if (decoded) {
      const check = isDestinationSafeForBypass(decoded.url, ctx.pageUrl, denied);
      if (check.safe) {
        return {
          found: true,
          decodedUrl: decoded.url,
          method: decoded.method,
        };
      }
      return {
        found: false,
        decodedUrl: decoded.url,
        method: decoded.method,
        blockedReason: check.reason,
      };
    }
  }

  // 2. Scan URL hash fragment (e.g. #aHR0cHM6Ly9...)
  const rawHash = (page.hash || '').replace(/^#/, '').trim();
  if (rawHash.length >= 12) {
    const hashCandidate = rawHash.includes('=') ? rawHash.split('=').slice(1).join('=') : rawHash;
    const decoded = decodeEncodedCandidate(hashCandidate);
    if (decoded) {
      const check = isDestinationSafeForBypass(decoded.url, ctx.pageUrl, denied);
      if (check.safe) {
        return {
          found: true,
          decodedUrl: decoded.url,
          method: 'HASH_BASE64',
        };
      }
      return {
        found: false,
        decodedUrl: decoded.url,
        method: 'HASH_BASE64',
        blockedReason: check.reason,
      };
    }
  }

  // 3. Scan hidden WP/Blogger safelink inputs (e.g. input[name="newwpsafelink"])
  if (Array.isArray(ctx.hiddenInputValues)) {
    for (const field of ctx.hiddenInputValues) {
      const name = String(field.name || '').toLowerCase();
      if (!/(safelink|newwpsafelink|go|url|link|target|dest|data|redirect)/i.test(name)) continue;
      const decoded = decodeEncodedCandidate(field.value || '');
      if (decoded) {
        const check = isDestinationSafeForBypass(decoded.url, ctx.pageUrl, denied);
        if (check.safe) {
          return {
            found: true,
            decodedUrl: decoded.url,
            method: 'HIDDEN_INPUT_PAYLOAD',
          };
        }
        return {
          found: false,
          decodedUrl: decoded.url,
          method: 'HIDDEN_INPUT_PAYLOAD',
          blockedReason: check.reason,
        };
      }
    }
  }

  // 4. Scan <meta http-equiv="refresh" content="5;url=https://...">
  if (ctx.metaRefreshContent) {
    const match = ctx.metaRefreshContent.match(/url\s*=\s*['"]?([^'"\s;>]+)['"]?/i);
    if (match && match[1]) {
      const check = isDestinationSafeForBypass(match[1], ctx.pageUrl, denied);
      if (check.safe) {
        return {
          found: true,
          decodedUrl: new URL(match[1], ctx.pageUrl).href,
          method: 'META_REFRESH',
        };
      }
      return {
        found: false,
        decodedUrl: match[1],
        method: 'META_REFRESH',
        blockedReason: check.reason,
      };
    }
  }

  return { found: false, decodedUrl: '', method: 'NONE' };
}

export function detectShortlinkBypassAction(spec: ShortlinkStepDomSpec): ShortlinkStepVerdict {
  if (spec.hasVisibleUnsolvedCaptcha) {
    return {
      action: 'WAIT_FOR_CAPTCHA',
      reason: 'CAPTCHA terdeteksi — menunggu verifikasi pengguna sebelum lanjut',
    };
  }

  if (spec.ctaMatchesAdSlot) {
    return {
      action: 'SKIP_AD_OR_BLACKLIST',
      reason: 'Tombol berada di slot iklan — dilewati demi keamanan',
    };
  }

  if (spec.ctaDisabled) {
    return {
      action: 'WAIT_FOR_TIMER',
      reason: 'Tombol tujuan masih nonaktif (countdown sedang berjalan)',
    };
  }

  if (spec.hasAdLinkFlyForm && !spec.ctaHref) {
    return {
      action: 'SUBMIT_FORM',
      reason: 'Form shortlink AdLinkFly/Safelink siap dikirim otomatis',
    };
  }

  if (spec.ctaHref) {
    try {
      const resolved = new URL(spec.ctaHref, spec.pageUrl).href;
      const denied = spec.deniedDomains || [];
      if (isDomainMatchedInList(resolved, denied)) {
        return {
          action: 'SKIP_AD_OR_BLACKLIST',
          reason: 'Target CTA berada di Blacklist — tidak diklik otomatis',
          targetUrl: resolved,
        };
      }
      const sameOrigin = new URL(resolved).origin === new URL(spec.pageUrl).origin;
      if (!sameOrigin) {
        const check = isDestinationSafeForBypass(resolved, spec.pageUrl, denied);
        if (!check.safe) {
          return {
            action: 'SKIP_AD_OR_BLACKLIST',
            reason: check.reason || 'Target CTA terindikasi iklan/berbahaya',
            targetUrl: resolved,
          };
        }
      }
      return {
        action: 'AUTO_CLICK_CTA',
        reason: `Tombol tujuan "${spec.ctaText || spec.ctaId || 'Go To Link'}" siap dibuka otomatis`,
        targetUrl: resolved,
      };
    } catch {
      return {
        action: 'NO_ACTION',
        reason: 'Format tautan CTA tidak dapat diproses',
      };
    }
  }

  return {
    action: 'NO_ACTION',
    reason: 'Tidak ada langkah shortlink aktif pada halaman',
  };
}

export function formatAegisLogsForCopy(
  entries: AegisLogEntry[],
  filter: 'ALL' | AegisLogLevel = 'ALL',
  version = '3.2.0'
): string {
  const filtered =
    filter === 'ALL' ? entries : entries.filter((item) => item.level === filter);

  const header = [
    `=== AEGIS-AI SHIELD v${version} DIAGNOSTIC LOG ===`,
    `Filter: ${filter} | Total Tercatat: ${filtered.length} entri`,
    `Petunjuk: Salin teks ini untuk analisa penyebab gagal lanjut ke link tujuan.`,
    `--------------------------------------------------`,
  ];

  if (filtered.length === 0) {
    return [...header, '(Belum ada catatan log untuk filter ini.)'].join('\n');
  }

  const lines = filtered.map((entry) => {
    const dt = new Date(entry.ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    const timeStr = `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
    const targetPart = entry.toUrl ? ` -> ${entry.toUrl}` : '';
    return `[${timeStr}] [${entry.level}/${entry.source}] ${entry.code}\n  Detail : ${entry.detail}\n  URL    : ${entry.fromUrl}${targetPart}`;
  });

  return [...header, ...lines].join('\n\n');
}

export const DEFAULT_TRUSTED_COMMUNITY_DOMAINS = [
  'semprot.com',
  'kaskus.co.id',
  'reddit.com',
] as const;

export interface GeminiAuditParsedResult {
  realIndex: number;
  blockedIndices: number[];
}

export function parseGeminiAuditResponse(rawText: string): GeminiAuditParsedResult {
  const fallback: GeminiAuditParsedResult = { realIndex: -1, blockedIndices: [] };
  if (typeof rawText !== 'string' || !rawText.trim()) return fallback;

  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const tryParseObject = (candidate: string): GeminiAuditParsedResult | null => {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const realIndex = Number.isInteger(parsed.realIndex) ? parsed.realIndex : -1;
        const blockedIndices = Array.isArray(parsed.blockedIndices)
          ? parsed.blockedIndices.filter((n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0)
          : [];
        return { realIndex, blockedIndices };
      }
    } catch {
      return null;
    }
    return null;
  };

  const direct = tryParseObject(cleaned);
  if (direct) return direct;

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const sliced = tryParseObject(cleaned.slice(firstBrace, lastBrace + 1));
    if (sliced) return sliced;
  }

  return fallback;
}

export interface TabHistorySnapshot {
  lastTimestamp: number;
}

export function pruneStaleTabHistory<T extends TabHistorySnapshot>(
  historyMap: Map<number, T>,
  nowMs: number,
  maxAgeMs = 2 * 60 * 60 * 1000,
  activeTabIds?: Set<number> | null
): number {
  let removed = 0;
  for (const [tabId, entry] of historyMap.entries()) {
    const isClosedTab = Boolean(activeTabIds && !activeTabIds.has(tabId));
    const isExpired = Boolean(entry && entry.lastTimestamp > 0 && nowMs - entry.lastTimestamp > maxAgeMs);
    if (isClosedTab || isExpired) {
      historyMap.delete(tabId);
      removed += 1;
    }
  }
  return removed;
}

export function shouldRunAiDomAuditFallback(opts: {
  shortlinkAutoClick: boolean;
  shortlinkDirectBypassTriggered: boolean;
  bypassStepExecuted: boolean;
}): boolean {
  if (opts.shortlinkDirectBypassTriggered) return false;
  if (!opts.shortlinkAutoClick) return true;
  return !opts.bypassStepExecuted;
}
