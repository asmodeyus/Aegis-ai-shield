const GEMINI_MODEL = "gemini-2.5-flash";

const SUSPICIOUS_TLD = /\.(cfd|xyz|top|cyou|icu|buzz|click|link|monster|quest|rest|sbs|shop|site|tokyo|vip|wang|win|work|wtf|zone|live|asia|online|store|fun|pro|club|cam|cc|me|pw|tk|ml|ga|cf|gq)$/i;
const GAMBLING_KEYWORDS = /(slot|gacor|maxwin|zeus|pragmatic|togel|judol|casino|betting|scatter|rtp|deposit|wd|bonus100|situsresmi|linkalternatif|sbobet|poker|judi|bandar|slot88|gacor88|pascol4d|dewadora|toto4d)/i;
const COMMERCE_AFFILIATE_REGEX = /(shopee\.|shope\.ee|tokopedia\.|lazada\.|blibli\.|bukalapak\.|tiktok\.com\/t\/|invol\.co|accesstrade|admitad|ecotrack|go2cloud|onclickalgo|popads|popcash|propellerads|adsterra|hilltopads|exoclick|juicyads|trafficjunky|monetag|richads|wpadmngr|clickadu)/i;
const RANDOM_SHORT_DOMAIN_REGEX = /^[a-z0-9]{2,4}[0-9][a-z0-9]{1,4}\.(com|net|org|co|id|io|info|biz)$/i;
const SEARCH_ARBITRAGE_PARAMS = /(utm_source=.*ad|utm_medium=affiliate|af_siteid=|af_sub|clickid=|click_id=|subid=|sub_id=|aff_id=|zoneid=|bannerid=|popunder|redirect|gclid=|fbclid=.*ad)/i;
const SAFE_MEDIA_HOST_REGEX = /(^|\.)(ibb\.co|ibb\.co\.com|imgur\.com|postimg\.cc|pixhost\.to|imgbox\.com|imagebam\.com|prnt\.sc|prntscr\.com|gyazo\.com|flickr\.com|staticflickr\.com|wikimedia\.org|tenor\.com|giphy\.com|redgifs\.com|catbox\.moe|bunkr\.(si|ru|is|la|sk|ax|ac|black|red|media|site)|cyberdrop\.(me|to|cc)|pixeldrain\.com|gofile\.io|mega\.nz|mediafire\.com|drive\.google\.com|docs\.google\.com|dropbox\.com)$/i;
const KNOWN_AD_SHORTENER_REGEX = /(^|\.)(optional\.me|see\.optional\.me|rebrand\.ly|bit\.ly|t\.ly|tinyurl\.com|is\.gd|v\.gd|cutt\.ly|shorturl\.at|ouo\.io|shrinkme\.io|exe\.io|bc\.vc|adf\.ly|linkvertise\.com)$/i;

const SEARCH_ENGINE_HOST_REGEX = /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|yandex\.[a-z.]+|ya\.ru|search\.brave\.com|ecosia\.org|startpage\.com|baidu\.com)$/i;
const MESSENGER_OR_SOCIAL_ENTRY_REGEX = /(^|\.)(t\.me|telegram\.me|telegram\.org|telegra\.ph|wa\.me|whatsapp\.com|l\.wl\.co|l\.facebook\.com|lm\.facebook\.com|l\.instagram\.com|t\.co|redd\.it|out\.reddit\.com|discord\.com|discordapp\.com|line\.me)$/i;

const AUTH_PATH_OR_PARAM_REGEX = /(\/(login|signin|sign-in|log-in|auth|oauth|oauth2|sso|saml|openid|oidc|authorize|callback|session|account|accounts|passport|idp|cas|connect\/authorize|v2\/auth|cdn-cgi\/challenge-platform)(\/|$)|[?&](client_id|redirect_uri|response_type|state|scope|openid|code_challenge|samlrequest|return_to|continue|_xfRedirect|__cf_chl_tk|__cf_chl_rt_tk|__cf_chl_f_tk)=)/i;
const AUTH_SUBDOMAIN_REGEX = /^(accounts|auth|login|signin|sso|id|oauth|passport|idp|iam)\./i;
const CHALLENGE_HOST_REGEX = /(challenges\.cloudflare\.com|cloudflarecaptcha\.com|hcaptcha\.com|recaptcha\.net|gstatic\.com\/recaptcha|dnstest\.dev)/i;

const SAFE_ECOSYSTEM_GROUPS = [
  /(^|\.)(yandex\.(com|ru|kz|by|uz|ua|tr|net)|ya\.ru|yastatic\.net)$/i,
  /(^|\.)(google\.(com|co\.id|com\.sg|com\.my)|googleapis\.com|gstatic\.com|youtube\.com|youtu\.be)$/i,
  /(^|\.)(microsoft\.com|live\.com|bing\.com|msn\.com|microsoftonline\.com|login\.windows\.net)$/i,
  /(^|\.)(apple\.com|icloud\.com)$/i,
  /(^|\.)(github\.com|githubusercontent\.com)$/i,
  /(^|\.)(facebook\.com|fb\.com|instagram\.com)$/i,
  /(^|\.)(discord\.com|discordapp\.com)$/i
];

function isSameSafeEcosystem(hostA, hostB) {
  if (!hostA || !hostB) return false;
  return SAFE_ECOSYSTEM_GROUPS.some((rx) => rx.test(hostA) && rx.test(hostB));
}

function isAuthFlowUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    return AUTH_SUBDOMAIN_REGEX.test(host) || AUTH_PATH_OR_PARAM_REGEX.test(u.pathname + u.search);
  } catch {
    return false;
  }
}

const DEFAULT_TRUSTED_DOMAINS = ["semprot.com", "kaskus.co.id", "reddit.com"];
const TAB_HISTORY_TTL_MS = 2 * 60 * 60 * 1000;
const TAB_HISTORY_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

const tabHistory = new Map();
const recentlyAllowedTargets = new Map();
let lastTabHistoryCleanup = 0;

async function cleanupStaleTabHistory(verifyOpenTabs = true) {
  const now = Date.now();
  lastTabHistoryCleanup = now;
  let activeTabIds = null;

  if (verifyOpenTabs && chrome.tabs && typeof chrome.tabs.query === "function") {
    try {
      const openTabs = await chrome.tabs.query({});
      activeTabIds = new Set(
        openTabs
          .map((t) => t && t.id)
          .filter((id) => typeof id === "number")
      );
    } catch (e) {
      activeTabIds = null;
    }
  }

  for (const [tabId, entry] of tabHistory.entries()) {
    const isClosedTab = activeTabIds !== null && !activeTabIds.has(tabId);
    const isExpired = Boolean(entry && entry.lastTimestamp > 0 && (now - entry.lastTimestamp) > TAB_HISTORY_TTL_MS);
    if (isClosedTab || isExpired) {
      tabHistory.delete(tabId);
    }
  }
}

setInterval(() => {
  cleanupStaleTabHistory(true);
}, TAB_HISTORY_CLEANUP_INTERVAL_MS);

// =========================================================================
// DIAGNOSTIC LOG BUFFER (COPY-PASTEABLE LOG UNTUK ANALISA GAGAL LANJUT LINK)
// =========================================================================
const MAX_AEGIS_LOGS = 120;
let aegisLogsCache = [];
let aegisLogsLoaded = false;
let aegisLogFlushTimer = null;
let aegisLoggingEnabled = true;

async function ensureLogsLoaded() {
  if (aegisLogsLoaded) return aegisLogsCache;
  try {
    const res = await chrome.storage.local.get(["aegisLogs", "globalSettings"]);
    aegisLogsCache = Array.isArray(res.aegisLogs) ? res.aegisLogs.slice(0, MAX_AEGIS_LOGS) : [];
    aegisLoggingEnabled = !res.globalSettings || res.globalSettings.loggingEnabled !== false;
    aegisLogsLoaded = true;
  } catch {
    aegisLogsLoaded = true;
  }
  return aegisLogsCache;
}

function scheduleLogFlush() {
  clearTimeout(aegisLogFlushTimer);
  aegisLogFlushTimer = setTimeout(() => {
    try {
      chrome.storage.local.set({ aegisLogs: aegisLogsCache.slice(0, MAX_AEGIS_LOGS) });
    } catch (e) {}
  }, 220);
}

async function appendAegisLog(entry) {
  await ensureLogsLoaded();
  if (!aegisLoggingEnabled) return;
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    level: String(entry.level || "WARN").toUpperCase(),
    source: String(entry.source || "background"),
    code: String(entry.code || "EVENT"),
    fromUrl: String(entry.fromUrl || "").slice(0, 220),
    toUrl: entry.toUrl ? String(entry.toUrl).slice(0, 220) : "",
    detail: String(entry.detail || "").slice(0, 320)
  };
  aegisLogsCache.unshift(item);
  if (aegisLogsCache.length > MAX_AEGIS_LOGS) {
    aegisLogsCache = aegisLogsCache.slice(0, MAX_AEGIS_LOGS);
  }
  scheduleLogFlush();
}

function allowManualTarget(urlStr, durationMs = 25000) {
  if (!urlStr) return;
  const exp = Date.now() + durationMs;
  recentlyAllowedTargets.set(urlStr, exp);
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    const base = getBaseDomain(host);
    if (host) recentlyAllowedTargets.set(`host:${host}`, exp);
    if (base) recentlyAllowedTargets.set(`host:${base}`, exp);
  } catch (e) {}
}

function isTargetRecentlyAllowed(urlStr) {
  if (!urlStr) return false;
  const now = Date.now();
  for (const [k, exp] of recentlyAllowedTargets.entries()) {
    if (now > exp) recentlyAllowedTargets.delete(k);
  }
  const directExp = recentlyAllowedTargets.get(urlStr);
  if (directExp && now <= directExp) return true;
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    const base = getBaseDomain(host);
    const hostExp = recentlyAllowedTargets.get(`host:${host}`);
    const baseExp = recentlyAllowedTargets.get(`host:${base}`);
    return Boolean((hostExp && now <= hostExp) || (baseExp && now <= baseExp));
  } catch {
    return false;
  }
}

async function getDomainRules() {
  const data = await chrome.storage.local.get(["trustedDomains", "deniedDomains", "strictCrossOrigin", "globalSettings"]);
  const g = data.globalSettings && typeof data.globalSettings === "object" ? data.globalSettings : {};
  const winSec = Number(g.redirectWindowSec);
  aegisLoggingEnabled = g.loggingEnabled !== false;
  return {
    trusted: Array.isArray(data.trustedDomains) ? data.trustedDomains : [],
    denied: Array.isArray(data.deniedDomains) ? data.deniedDomains : [],
    strictCrossOrigin: data.strictCrossOrigin !== false,
    smartUgcSense: g.smartUgcSense !== false,
    shortlinkBypassEnabled: g.shortlinkBypassEnabled !== false,
    shortlinkAutoClick: g.shortlinkAutoClick !== false,
    loggingEnabled: g.loggingEnabled !== false,
    redirectWindowMs: Number.isFinite(winSec) && winSec >= 1 ? winSec * 1000 : 3500,
    dnrEnabled: g.dnrEnabled !== false
  };
}

function getHostname(urlStr) {
  try {
    return new URL(urlStr).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function getBaseDomain(hostname) {
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length <= 2) return hostname;
  const sld = parts[parts.length - 2];
  if (["co", "com", "net", "org", "ac", "go", "or", "web", "sch"].includes(sld) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

function normalizeDomainEntry(raw) {
  const clean = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
    .split("#")[0];
  return clean;
}

function isDomainInList(urlStr, list) {
  if (!urlStr || !Array.isArray(list) || list.length === 0) return false;
  try {
    const host = new URL(urlStr).hostname.toLowerCase().replace(/^www\./, "");
    if (!host) return false;
    const base = getBaseDomain(host);
    for (const item of list) {
      const rule = normalizeDomainEntry(item);
      if (!rule) continue;
      const ruleBase = getBaseDomain(rule);
      if (
        host === rule ||
        base === rule ||
        host === ruleBase ||
        base === ruleBase ||
        host.endsWith("." + rule) ||
        host.endsWith("." + ruleBase)
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function isSuspiciousUrl(urlStr, rules = { trusted: [], denied: [], strictCrossOrigin: true }, sourceUrl = "") {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    const baseHost = getBaseDomain(host);

    if (isDomainInList(urlStr, rules.trusted)) return false;
    if (isTargetRecentlyAllowed(urlStr)) return false;
    if (isDomainInList(urlStr, rules.denied)) return true;
    if (CHALLENGE_HOST_REGEX.test(host)) return false;

    if (sourceUrl) {
      try {
        const srcHost = new URL(sourceUrl).hostname.toLowerCase();
        if (isSameSafeEcosystem(srcHost, host)) return false;
      } catch (e) {}
    }

    const hasHardAdSignals =
      GAMBLING_KEYWORDS.test(u.href) ||
      COMMERCE_AFFILIATE_REGEX.test(u.href) ||
      RANDOM_SHORT_DOMAIN_REGEX.test(baseHost) ||
      SEARCH_ARBITRAGE_PARAMS.test(u.href) ||
      KNOWN_AD_SHORTENER_REGEX.test(host);

    if (hasHardAdSignals) {
      return true;
    }

    // Hosting gambar & media komunitas populer (ibb.co.com, imgur.com, postimg.cc, pixhost.to, dll.)
    if (SAFE_MEDIA_HOST_REGEX.test(host)) {
      return false;
    }

    if (SUSPICIOUS_TLD.test(host)) {
      return true;
    }

    const isSearch = (host.includes("google.") && u.pathname === "/search") ||
                     (host.includes("bing.com") && u.pathname === "/search") ||
                     (host.includes("duckduckgo.com") && u.pathname === "/") ||
                     (host.includes("search.yahoo.com") && u.pathname.startsWith("/search"));
    if (isSearch) {
      const q = u.searchParams.get("q") || "";
      if (SEARCH_ARBITRAGE_PARAMS.test(u.href) || GAMBLING_KEYWORDS.test(q)) return true;
      if (sourceUrl) {
        try {
          const srcHost = new URL(sourceUrl).hostname.toLowerCase();
          if (!SEARCH_ENGINE_HOST_REGEX.test(srcHost)) {
            return true;
          }
        } catch (e) {}
      }
    }

    return false;
  } catch {
    return false;
  }
}

function getSafeReturnUrl(tabId, currentMaliciousUrl, rules) {
  const entry = tabHistory.get(tabId);
  if (!entry || !entry.stack || entry.stack.length === 0) return null;
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
  if (tabHistory.size > 40 && (now - lastTabHistoryCleanup) > TAB_HISTORY_CLEANUP_INTERVAL_MS) {
    cleanupStaleTabHistory(true);
  }
  if (!tabHistory.has(tabId)) {
    tabHistory.set(tabId, {
      stack: [],
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
      pendingPrompts: []
    });
  }
  return tabHistory.get(tabId);
}

function isManuallyAllowed(entry, targetUrl) {
  if (isTargetRecentlyAllowed(targetUrl)) return true;
  if (!entry) return false;
  const now = Date.now();
  if (entry.authGraceUntil && now < entry.authGraceUntil) {
    return true;
  }
  if (!entry.manualAllowedUrl) return false;
  if (now > entry.manualAllowedUntil) {
    entry.manualAllowedUrl = "";
    return false;
  }
  try {
    const allowedHost = getHostname(entry.manualAllowedUrl);
    const targetHost = getHostname(targetUrl);
    return entry.manualAllowedUrl === targetUrl || (allowedHost && allowedHost === targetHost);
  } catch {
    return false;
  }
}

function forceRevertTab(tabId, fallbackUrl, blockedUrl, reasonMsg, silentBlacklist = false, deniedList = []) {
  const now = Date.now();
  const entry = ensureTabEntry(tabId);

  if (now - entry.lastRevertTime < 2200) {
    return;
  }

  if (now - entry.lastRevertTime < 10000) {
    entry.revertCount += 1;
  } else {
    entry.revertCount = 1;
  }

  entry.lastRevertTime = now;

  if (entry.revertCount > 2) {
    entry.lockedUntil = now + 15000;
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
    entry.pendingPrompts = entry.pendingPrompts.filter((p) => !isDomainInList(p.blockedUrl, deniedList));
  }

  tabHistory.set(tabId, entry);

  if (fallbackUrl) {
    chrome.tabs.update(tabId, { url: fallbackUrl });
  }
}

chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const url = details.url;
  if (!url || !url.startsWith("http")) return;

  const rules = await getDomainRules();
  const entry = ensureTabEntry(details.tabId);
  const now = Date.now();
  const qualifiers = details.transitionQualifiers || [];
  const isForwardBack = qualifiers.includes("forward_back");
  const isBlacklisted = isDomainInList(url, rules.denied);

  // Jika domain berada di Blacklist pengguna, langsung blokir/kembalikan secara SENYAP tanpa menampilkan HUD
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
      forceRevertTab(details.tabId, safeUrl, url, "Domain Blacklist diblokir senyap", true, rules.denied);
    }
    return;
  }

  if (isForwardBack) {
    const idxInStack = entry.stack.lastIndexOf(url);
    if (idxInStack !== -1) {
      entry.stack = entry.stack.slice(0, idxInStack + 1);
    } else {
      entry.stack.push(url);
      if (entry.stack.length > 15) entry.stack.shift();
    }
    entry.lockedUntil = now + 6000;
    entry.lastRevertTime = now;
    entry.revertCount = 0;
    entry.lastTimestamp = now;
    tabHistory.set(details.tabId, entry);
    return;
  }

  if (isAuthFlowUrl(url) && !isSuspiciousUrl(url, rules)) {
    entry.authGraceUntil = now + 30000;
  }

  if (isManuallyAllowed(entry, url)) {
    if (entry.stack[entry.stack.length - 1] !== url) {
      entry.stack.push(url);
      if (entry.stack.length > 15) entry.stack.shift();
    }
    entry.lastTimestamp = now;
    tabHistory.set(details.tabId, entry);
    return;
  }

  if (now < entry.lockedUntil) return;

  const prevUrl = entry.stack[entry.stack.length - 1] || "";

  // Deteksi Halaman Web Pertama (dibuka dari Telegram, WhatsApp, Address Bar, Bookmark, Tab Baru, atau Intent Eksternal)
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
    entry.revertCount = 0;
    entry.lastTimestamp = now;
    entry.firstPageGraceUntil = now + 6000;
    allowManualTarget(url, 15000);
    tabHistory.set(details.tabId, entry);
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
    try {
      const prevObj = new URL(prevUrl);
      const currObj = new URL(url);
      const prevHost = prevObj.hostname.toLowerCase();
      const currHost = currObj.hostname.toLowerCase();
      const prevBase = getBaseDomain(prevHost);
      const currBase = getBaseDomain(currHost);

      const isFromSearchEngine = SEARCH_ENGINE_HOST_REGEX.test(prevHost);
      const isFromMessengerOrSocial = MESSENGER_OR_SOCIAL_ENTRY_REGEX.test(prevHost);
      const isWithinFirstPageCanonicalRedirect =
        entry.firstPageGraceUntil &&
        now < entry.firstPageGraceUntil &&
        (prevBase === currBase || qualifiers.includes("server_redirect"));

      // Jika pengguna membuka halaman dari Hasil Pencarian Google/Bing/DuckDuckGo/Yandex
      // atau dari Link Shim Telegram/WhatsApp/Sosmed (t.me, wa.me, l.wl.co, dll.) -> Langsung perbolehkan!
      if (isFromSearchEngine || isFromMessengerOrSocial || isWithinFirstPageCanonicalRedirect) {
        entry.stack.push(url);
        if (entry.stack.length > 15) entry.stack.shift();
        entry.lastTimestamp = now;
        entry.firstPageGraceUntil = now + 4500;
        allowManualTarget(url, 15000);
        tabHistory.set(details.tabId, entry);
        return;
      }

      if (prevBase !== currBase && !isSameSafeEcosystem(prevHost, currHost)) {
        const isHardMalicious =
          isBlacklisted ||
          GAMBLING_KEYWORDS.test(currObj.href) ||
          COMMERCE_AFFILIATE_REGEX.test(currObj.href) ||
          RANDOM_SHORT_DOMAIN_REGEX.test(currBase) ||
          SEARCH_ARBITRAGE_PARAMS.test(currObj.href) ||
          KNOWN_AD_SHORTENER_REGEX.test(currHost);

        // v2.2.5: Jika pengguna sengaja menekan tombol CTA shortlink same-origin (misal "Go To Link" ?download=1&t=...)
        // dan server melakukan HTTP 302 (server_redirect) ke tautan tujuan yang bersih (bukan blacklist / bukan judol / bukan iklan),
        // langsung izinkan agar halaman tujuan tampil tanpa dipantulkan kembali!
        const isWithinShortlinkCtaGrace = Boolean(
          entry.shortlinkCtaGraceUntil && now < entry.shortlinkCtaGraceUntil
        );
        if (isWithinShortlinkCtaGrace && !isHardMalicious && !isBlacklisted) {
          entry.stack.push(url);
          if (entry.stack.length > 15) entry.stack.shift();
          entry.lastTimestamp = now;
          entry.shortlinkCtaGraceUntil = 0;
          allowManualTarget(url, 18000);
          tabHistory.set(details.tabId, entry);
          appendAegisLog({
            level: "ALLOW",
            source: "background",
            code: "ALLOW_SHORTLINK_302",
            fromUrl: prevUrl,
            toUrl: url,
            detail: `HTTP 302 dari tombol CTA shortlink diizinkan (transition=${details.transitionType}, qualifiers=${qualifiers.join(",") || "none"})`
          });
          return;
        }

        // Hosting gambar/media aman (ibb.co.com, imgur, postimg.cc, dll.) tidak ditahan saat diklik
        if (SAFE_MEDIA_HOST_REGEX.test(currHost) && !isHardMalicious) {
          entry.stack.push(url);
          if (entry.stack.length > 15) entry.stack.shift();
          entry.lastTimestamp = now;
          tabHistory.set(details.tabId, entry);
          return;
        }

        const isSuspicious = isSuspiciousUrl(url, rules, prevUrl);
        const isIntentionalUserNav =
          (details.transitionType === "link" || details.transitionType === "form_submit") &&
          !qualifiers.includes("server_redirect");
        const isAuthJump = isAuthFlowUrl(url) || isAuthFlowUrl(prevUrl);
        const elapsedMs = now - entry.lastTimestamp;

        const isRapidAutoRedirect =
          rules.strictCrossOrigin &&
          !isIntentionalUserNav &&
          !isAuthJump &&
          !isFromSearchEngine &&
          !isFromMessengerOrSocial &&
          (elapsedMs < rules.redirectWindowMs || qualifiers.includes("client_redirect") || qualifiers.includes("server_redirect"));

        if (isSuspicious || isRapidAutoRedirect) {
          const safeUrl = getSafeReturnUrl(details.tabId, url, rules) || prevUrl;
          appendAegisLog({
            level: "BLOCK",
            source: "background",
            code: isSuspicious ? "BLOCK_SUSPICIOUS_COMMIT" : "BLOCK_RAPID_REDIRECT_REVERT",
            fromUrl: prevUrl,
            toUrl: url,
            detail: `Revert -> ${safeUrl} | reason=${isSuspicious ? "suspicious_url" : "strict_cross_origin_redirect"} | transition=${details.transitionType} | qualifiers=${qualifiers.join(",") || "none"} | elapsed=${elapsedMs}ms | shortlinkGrace=${isWithinShortlinkCtaGrace} | hardMalicious=${isHardMalicious}`
          });
          forceRevertTab(
            details.tabId,
            safeUrl,
            url,
            isSuspicious ? "Redirect iklan/affiliate ditahan" : "Auto-redirect lintas domain ditahan",
            isBlacklisted,
            rules.denied
          );
          return;
        }
      }
    } catch (e) {}
  }

  if (!isSuspiciousUrl(url, rules) || entry.stack.length === 0) {
    if (entry.stack[entry.stack.length - 1] !== url) {
      entry.stack.push(url);
      if (entry.stack.length > 15) entry.stack.shift();
      if (now - entry.lastRevertTime > 4000) {
        entry.revertCount = 0;
      }
    }
    entry.lastTimestamp = now;
    tabHistory.set(details.tabId, entry);
  }
});

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const targetUrl = details.url;
  if (!targetUrl || !targetUrl.startsWith("http")) return;

  const rules = await getDomainRules();
  const entry = ensureTabEntry(details.tabId);
  const now = Date.now();
  const isTargetBlacklisted = isDomainInList(targetUrl, rules.denied);

  if (isAuthFlowUrl(targetUrl) && !isSuspiciousUrl(targetUrl, rules)) {
    entry.authGraceUntil = now + 30000;
  }

  if (!isTargetBlacklisted && isManuallyAllowed(entry, targetUrl)) return;
  if (entry.stack.length === 0) return;
  if (!isTargetBlacklisted && entry.firstPageGraceUntil && now < entry.firstPageGraceUntil) return;
  if (now < entry.lockedUntil || now - entry.lastRevertTime < 2200) return;

  const currentUrl = entry.stack[entry.stack.length - 1];
  if (!currentUrl || currentUrl === targetUrl) return;

  try {
    const prevObj = new URL(currentUrl);
    const targetObj = new URL(targetUrl);
    const prevHost = prevObj.hostname.toLowerCase();
    const targetHost = targetObj.hostname.toLowerCase();
    const prevBase = getBaseDomain(prevHost);
    const targetBase = getBaseDomain(targetHost);

    const isCurrentSearchOrMessenger =
      SEARCH_ENGINE_HOST_REGEX.test(prevHost) ||
      MESSENGER_OR_SOCIAL_ENTRY_REGEX.test(prevHost);

    if (prevBase !== targetBase && !isSameSafeEcosystem(prevHost, targetHost)) {
      if (isCurrentSearchOrMessenger && !isTargetBlacklisted) {
        allowManualTarget(targetUrl, 15000);
        return;
      }
      const isHardMaliciousTarget =
        isTargetBlacklisted ||
        GAMBLING_KEYWORDS.test(targetUrl) ||
        COMMERCE_AFFILIATE_REGEX.test(targetUrl) ||
        RANDOM_SHORT_DOMAIN_REGEX.test(targetBase) ||
        SEARCH_ARBITRAGE_PARAMS.test(targetUrl) ||
        KNOWN_AD_SHORTENER_REGEX.test(targetHost);

      if (
        entry.shortlinkCtaGraceUntil &&
        now < entry.shortlinkCtaGraceUntil &&
        !isHardMaliciousTarget
      ) {
        allowManualTarget(targetUrl, 18000);
        return;
      }
      if (SAFE_MEDIA_HOST_REGEX.test(targetHost) && !isTargetBlacklisted && !GAMBLING_KEYWORDS.test(targetUrl)) {
        return;
      }
      if (isTargetBlacklisted || isSuspiciousUrl(targetUrl, rules, currentUrl)) {
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
          "Redirect iklan/affiliate ditahan",
          isTargetBlacklisted,
          rules.denied
        );
      }
    }
  } catch (e) {}
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabHistory.delete(tabId);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "AUTH_FLOW_STARTED" && sender.tab && sender.tab.id) {
    const entry = ensureTabEntry(sender.tab.id);
    entry.authGraceUntil = Date.now() + 30000;
    entry.lockedUntil = Date.now() + 10000;
    tabHistory.set(sender.tab.id, entry);
    return;
  }

  if (request.type === "ALLOW_USER_CONTENT_NAVIGATION" && request.url) {
    allowManualTarget(request.url, 25000);
    if (sender.tab && sender.tab.id) {
      const entry = ensureTabEntry(sender.tab.id);
      entry.manualAllowedUrl = request.url;
      entry.manualAllowedUntil = Date.now() + 20000;
      tabHistory.set(sender.tab.id, entry);
    }
    return;
  }

  if (request.type === "USER_CLICKED_SHORTLINK_CTA" && sender.tab && sender.tab.id) {
    const entry = ensureTabEntry(sender.tab.id);
    const now = Date.now();
    entry.shortlinkCtaGraceUntil = now + 9000;
    try {
      entry.shortlinkCtaSourceHost = getHostname(request.sourceUrl || sender.tab.url || "");
    } catch (e) {}
    tabHistory.set(sender.tab.id, entry);
    appendAegisLog({
      level: "ALLOW",
      source: "background",
      code: "GRANT_SHORTLINK_CTA_GRACE",
      fromUrl: request.sourceUrl || sender.tab.url || "",
      toUrl: request.href || "",
      detail: "Grace window 9d diaktifkan untuk tombol CTA shortlink (izinkan HTTP 302 tujuan bersih)"
    });
    return;
  }

  if (request.type === "ALLOW_SHORTLINK_BYPASS_NAV" && request.url) {
    allowManualTarget(request.url, 25000);
    if (sender.tab && sender.tab.id) {
      const entry = ensureTabEntry(sender.tab.id);
      entry.manualAllowedUrl = request.url;
      entry.manualAllowedUntil = Date.now() + 25000;
      entry.shortlinkCtaGraceUntil = Date.now() + 9000;
      tabHistory.set(sender.tab.id, entry);
    }
    appendAegisLog({
      level: "BYPASS",
      source: "background",
      code: "ALLOW_SHORTLINK_BYPASS",
      fromUrl: request.sourceUrl || (sender.tab && sender.tab.url) || "",
      toUrl: request.url,
      detail: `Bypass Shortlink Debloated diizinkan (${request.method || "DIRECT"})`
    });
    sendResponse({ ok: true });
    return true;
  }

  if (request.type === "APPEND_AEGIS_LOG" && request.entry) {
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

  if (request.type === "GET_AEGIS_LOGS") {
    ensureLogsLoaded().then((logs) => {
      sendResponse({ logs });
    });
    return true;
  }

  if (request.type === "CLEAR_AEGIS_LOGS") {
    aegisLogsCache = [];
    aegisLogsLoaded = true;
    chrome.storage.local.set({ aegisLogs: [] }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (request.type === "CHECK_SHOULD_BLOCK_ENTRY" && sender.tab && sender.tab.id) {
    const tabId = sender.tab.id;
    const url = request.url || sender.tab.url || "";
    getDomainRules().then((rules) => {
      const entry = tabHistory.get(tabId);
      const isBlacklisted = isDomainInList(url, rules.denied);
      if (!isBlacklisted) {
        if (
          isManuallyAllowed(entry, url) ||
          !entry ||
          entry.stack.length <= 1 ||
          (entry.firstPageGraceUntil && Date.now() < entry.firstPageGraceUntil)
        ) {
          sendResponse({ shouldRevert: false, isBlacklisted: false });
          return;
        }
      }
      const safeUrl = getSafeReturnUrl(tabId, url, rules);
      if (!safeUrl) {
        sendResponse({ shouldRevert: false, isBlacklisted });
        return;
      }
      sendResponse({
        shouldRevert: true,
        isBlacklisted,
        reason: isBlacklisted ? "Domain Blacklist diblokir senyap" : "Redirect iklan/affiliate ditahan"
      });
    });
    return true;
  }

  if (request.type === "GET_PENDING_PROMPTS" && sender.tab && sender.tab.id) {
    getDomainRules().then((rules) => {
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
      }
      sendResponse({ prompts: filteredItems });
    });
    return true;
  }

  if (request.type === "FORCE_GO_BACK" && sender.tab && sender.tab.id) {
    getDomainRules().then((rules) => {
      const entry = tabHistory.get(sender.tab.id);
      const currentTabUrl = sender.tab.url || "";
      const isBlacklisted = isDomainInList(currentTabUrl, rules.denied);
      if (!isBlacklisted && isManuallyAllowed(entry, currentTabUrl)) return;
      const safeUrl = getSafeReturnUrl(sender.tab.id, currentTabUrl, rules);
      if (safeUrl) {
        forceRevertTab(
          sender.tab.id,
          safeUrl,
          currentTabUrl,
          request.reason || "Redirect ditahan",
          isBlacklisted,
          rules.denied
        );
      }
    });
    return;
  }

  if (request.type === "OPEN_GROUP_TAB" && request.url && sender.tab) {
    allowManualTarget(request.url, 30000);
    const createOpts = {
      url: request.url,
      active: false,
      openerTabId: sender.tab.id
    };
    if (typeof sender.tab.index === "number") {
      createOpts.index = sender.tab.index + 1;
    }
    if (typeof sender.tab.windowId === "number") {
      createOpts.windowId = sender.tab.windowId;
    }
    chrome.tabs.create(createOpts, async (newTab) => {
      if (newTab && typeof newTab.id === "number") {
        const newEntry = ensureTabEntry(newTab.id);
        newEntry.manualAllowedUrl = request.url;
        newEntry.manualAllowedUntil = Date.now() + 30000;
        newEntry.lockedUntil = Date.now() + 15000;
        newEntry.stack = [request.url];
        tabHistory.set(newTab.id, newEntry);
      }
      if (!newTab || typeof newTab.id !== "number" || !chrome.tabs.group) return;
      try {
        const latestSender = await chrome.tabs.get(sender.tab.id).catch(() => sender.tab);
        const noneId = (chrome.tabGroups && typeof chrome.tabGroups.TAB_GROUP_ID_NONE === "number")
          ? chrome.tabGroups.TAB_GROUP_ID_NONE
          : -1;
        const existingGroupId = typeof latestSender.groupId === "number" ? latestSender.groupId : noneId;

        if (existingGroupId !== noneId && existingGroupId >= 0) {
          await chrome.tabs.group({
            tabIds: [newTab.id],
            groupId: existingGroupId
          });
        } else {
          const groupOpts = { tabIds: [sender.tab.id, newTab.id] };
          if (typeof latestSender.windowId === "number") {
            groupOpts.createProperties = { windowId: latestSender.windowId };
          }
          await chrome.tabs.group(groupOpts);
        }
      } catch (e) {}
    });
    return;
  }

  if (request.type === "OPEN_FOREGROUND_TAB" && request.url) {
    allowManualTarget(request.url, 30000);
    chrome.tabs.create({ url: request.url, active: true }, (newTab) => {
      if (newTab && typeof newTab.id === "number") {
        const newEntry = ensureTabEntry(newTab.id);
        newEntry.manualAllowedUrl = request.url;
        newEntry.manualAllowedUntil = Date.now() + 30000;
        newEntry.lockedUntil = Date.now() + 15000;
        newEntry.stack = [request.url];
        tabHistory.set(newTab.id, newEntry);
      }
    });
    return;
  }

  if (request.type === "NAVIGATE_CURRENT_TAB" && request.url && sender.tab && sender.tab.id) {
    allowManualTarget(request.url, 30000);
    const entry = ensureTabEntry(sender.tab.id);
    entry.manualAllowedUrl = request.url;
    entry.manualAllowedUntil = Date.now() + 25000;
    entry.lockedUntil = Date.now() + 12000;
    entry.lastRevertTime = Date.now();
    chrome.tabs.update(sender.tab.id, { url: request.url });
    return;
  }

  if (request.type === "ANALYZE_CANDIDATES") {
    analyzeWithGemini(request.payload)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

function parseGeminiAuditResponse(rawText) {
  const fallback = { realIndex: -1, blockedIndices: [] };
  if (typeof rawText !== "string" || !rawText.trim()) return fallback;

  let cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const tryParseObject = (candidate) => {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const realIndex = Number.isInteger(parsed.realIndex) ? parsed.realIndex : -1;
        const blockedIndices = Array.isArray(parsed.blockedIndices)
          ? parsed.blockedIndices.filter((n) => Number.isInteger(n) && n >= 0)
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

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const sliced = tryParseObject(cleaned.slice(firstBrace, lastBrace + 1));
    if (sliced) return sliced;
  }

  return fallback;
}

async function analyzeWithGemini(payload) {
  const { geminiApiKey } = await chrome.storage.local.get(["geminiApiKey"]);
  if (!geminiApiKey) {
    return { realIndex: -1, blockedIndices: [], reason: "API Key kosong" };
  }

  const prompt = `Analisis daftar elemen tombol/link dari halaman web berikut untuk membedakan mana TOMBOL TUJUAN ASLI (download file, lanjut shortlink, target utama) dan mana JEBAKAN IKLAN / JUDOL / SHOPEE AFFILIATE / SEARCH HIJACK.

Judul: ${payload.title}
URL: ${payload.pageUrl}
Kandidat (JSON):
${JSON.stringify(payload.candidates)}

Aturan:
1. Pilih SATU index (realIndex) tombol tujuan utama yang sah, atau -1 jika tidak pasti.
2. Masukkan index iklan/judol/Shopee/redirect palsu ke array blockedIndices.
3. Balas HANYA JSON valid: {"realIndex": number, "blockedIndices": number[]}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
    }
  );

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return parseGeminiAuditResponse(rawText);
}

// =========================================================================
// DECLARATIVE NET REQUEST (DNR): BLOKIR DOMAIN BLACKLIST DI LEVEL JARINGAN
// =========================================================================
async function syncBlacklistToDnr(deniedList = []) {
  if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.updateDynamicRules) return;
  try {
    const { globalSettings } = await chrome.storage.local.get(["globalSettings"]);
    const dnrActive = !globalSettings || globalSettings.dnrEnabled !== false;
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existingRules.map((r) => r.id);

    if (!dnrActive) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: [] });
      return;
    }

    const uniqueHosts = Array.from(
      new Set(
        (Array.isArray(deniedList) ? deniedList : [])
          .map((d) => String(d || "").trim().toLowerCase().replace(/^www\./, ""))
          .filter((d) => d && d.includes(".") && !d.includes(" "))
      )
    ).slice(0, 4500);

    const addRules = uniqueHosts.map((domain, idx) => ({
      id: idx + 1,
      priority: 1,
      action: { type: "block" },
      condition: {
        requestDomains: [domain],
        resourceTypes: [
          "main_frame",
          "sub_frame",
          "script",
          "xmlhttprequest",
          "ping",
          "other"
        ]
      }
    }));

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules
    });
  } catch (e) {}
}

let dnrSyncDebounceTimer = null;

function scheduleSyncBlacklistToDnr(delayMs = 350) {
  clearTimeout(dnrSyncDebounceTimer);
  dnrSyncDebounceTimer = setTimeout(async () => {
    try {
      const { deniedDomains } = await chrome.storage.local.get(["deniedDomains"]);
      await syncBlacklistToDnr(deniedDomains || []);
    } catch (e) {}
  }, delayMs);
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get([
    "deniedDomains",
    "trustedDomains",
    "geminiApiKey",
    "strictCrossOrigin",
    "autoSkipCountdown",
    "globalSettings",
    "hudPositions"
  ]);
  const defaultsToSet = {};
  if (typeof existing.strictCrossOrigin !== "boolean") defaultsToSet.strictCrossOrigin = true;
  if (typeof existing.autoSkipCountdown !== "boolean") defaultsToSet.autoSkipCountdown = true;
  if (!Array.isArray(existing.trustedDomains)) {
    defaultsToSet.trustedDomains = [...DEFAULT_TRUSTED_DOMAINS];
  }
  if (!Array.isArray(existing.deniedDomains)) defaultsToSet.deniedDomains = [];
  if (!existing.globalSettings || typeof existing.globalSettings !== "object") {
    defaultsToSet.globalSettings = {
      hudEnabled: true,
      hudDurationSec: 4.5,
      hudPosition: "top-center",
      hudOpacity: 0.95,
      hudScale: 1.0,
      hudShowTrust: true,
      hudShowGroup: true,
      hudShowOpen: true,
      hudShowBlock: true,
      hudShowUrlDetail: true,
      videoDockEnabled: true,
      videoDockDimSec: 2.5,
      videoDockExpandDir: "auto",
      videoPillScale: 1.0,
      videoPillOpacity: 0.95,
      videoPillShowPlayPause: true,
      videoPillShowList: true,
      videoPillShowDownload: true,
      videoPillShowPip: true,
      videoPillShowFullscreen: true,
      pipSize: "medium",
      pipOpacity: 0.95,
      adSkipSpeed: "16",
      smartUgcSense: true,
      shortlinkBypassEnabled: true,
      shortlinkAutoClick: true,
      loggingEnabled: true,
      removeTransparentOverlay: true,
      antiHistoryTrap: true,
      dnrEnabled: true,
      redirectWindowSec: 3.5
    };
  }
  if (!existing.hudPositions || typeof existing.hudPositions !== "object") {
    defaultsToSet.hudPositions = {
      topHud: null,
      videoDock: null,
      miniPip: null
    };
  }
  if (Object.keys(defaultsToSet).length > 0) {
    await chrome.storage.local.set(defaultsToSet);
  }
  await syncBlacklistToDnr(existing.deniedDomains || []);
  await cleanupStaleTabHistory(true);
});

chrome.runtime.onStartup.addListener(async () => {
  const { deniedDomains } = await chrome.storage.local.get(["deniedDomains"]);
  await syncBlacklistToDnr(deniedDomains || []);
  await cleanupStaleTabHistory(true);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.globalSettings && changes.globalSettings.newValue) {
    aegisLoggingEnabled = changes.globalSettings.newValue.loggingEnabled !== false;
  }
  if (areaName === "local" && (changes.deniedDomains || changes.globalSettings)) {
    scheduleSyncBlacklistToDnr(350);
  }
});
