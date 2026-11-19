const GEMINI_MODEL = "gemini-2.5-flash";

const SUSPICIOUS_TLD = /\.(cfd|xyz|top|cyou|icu|buzz|click|link|monster|quest|rest|sbs|shop|site|tokyo|vip|wang|win|work|wtf|zone|live|asia|online|store|fun|pro|club|cam|cc|me|pw|tk|ml|ga|cf|gq)$/i;
const GAMBLING_KEYWORDS = /(slot|gacor|maxwin|zeus|pragmatic|togel|judol|casino|betting|scatter|rtp|deposit|wd|bonus100|situsresmi|linkalternatif|sbobet|poker|judi|bandar|slot88|gacor88)/i;
const COMMERCE_AFFILIATE_REGEX = /(shopee\.|shope\.ee|tokopedia\.|lazada\.|blibli\.|bukalapak\.|tiktok\.com\/t\/|invol\.co|accesstrade|admitad|ecotrack|go2cloud|onclickalgo|popads|popcash|propellerads|adsterra|hilltopads|exoclick|juicyads|trafficjunky|monetag|richads)/i;
const RANDOM_SHORT_DOMAIN_REGEX = /^[a-z0-9]{2,4}[0-9][a-z0-9]{1,4}\.(com|net|org|co|id|io|info|biz)$/i;
const SEARCH_ARBITRAGE_PARAMS = /(utm_source=.*ad|utm_medium=affiliate|af_siteid=|af_sub|clickid=|click_id=|subid=|sub_id=|aff_id=|zoneid=|bannerid=|popunder|redirect|gclid=|fbclid=.*ad)/i;

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

const tabHistory = new Map();

async function getDomainRules() {
  const data = await chrome.storage.local.get(["trustedDomains", "deniedDomains", "strictCrossOrigin", "globalSettings"]);
  const g = data.globalSettings && typeof data.globalSettings === "object" ? data.globalSettings : {};
  const winSec = Number(g.redirectWindowSec);
  return {
    trusted: Array.isArray(data.trustedDomains) ? data.trustedDomains : [],
    denied: Array.isArray(data.deniedDomains) ? data.deniedDomains : [],
    strictCrossOrigin: data.strictCrossOrigin !== false,
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

function isSuspiciousUrl(urlStr, rules = { trusted: [], denied: [], strictCrossOrigin: true }, sourceUrl = "") {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    const baseHost = getBaseDomain(host);

    if (rules.trusted.includes(host) || rules.trusted.includes(baseHost)) return false;
    if (rules.denied.includes(host) || rules.denied.includes(baseHost)) return true;
    if (CHALLENGE_HOST_REGEX.test(host)) return false;

    if (sourceUrl) {
      try {
        const srcHost = new URL(sourceUrl).hostname.toLowerCase();
        if (isSameSafeEcosystem(srcHost, host)) return false;
      } catch (e) {}
    }

    if (
      GAMBLING_KEYWORDS.test(u.href) ||
      SUSPICIOUS_TLD.test(host) ||
      COMMERCE_AFFILIATE_REGEX.test(u.href) ||
      RANDOM_SHORT_DOMAIN_REGEX.test(baseHost) ||
      SEARCH_ARBITRAGE_PARAMS.test(u.href)
    ) {
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
          if (!srcHost.includes("google.") && !srcHost.includes("bing.com")) {
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
    if (candidate && candidate !== currentMaliciousUrl && !isSuspiciousUrl(candidate, rules)) {
      return candidate;
    }
  }
  return null;
}

function ensureTabEntry(tabId) {
  if (!tabHistory.has(tabId)) {
    tabHistory.set(tabId, {
      stack: [],
      lastTimestamp: 0,
      lastRevertTime: 0,
      revertCount: 0,
      lockedUntil: 0,
      manualAllowedUrl: "",
      manualAllowedUntil: 0,
      authGraceUntil: 0,
      pendingPrompts: []
    });
  }
  return tabHistory.get(tabId);
}

function isManuallyAllowed(entry, targetUrl) {
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

function isDomainInList(urlStr, list) {
  if (!urlStr || !Array.isArray(list) || list.length === 0) return false;
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    const base = getBaseDomain(host);
    return list.includes(host) || list.includes(base);
  } catch {
    return false;
  }
}

function forceRevertTab(tabId, fallbackUrl, blockedUrl, reasonMsg, silentBlacklist = false) {
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

  if (!silentBlacklist && blockedUrl && blockedUrl.startsWith("http")) {
    const exists = entry.pendingPrompts.some((p) => p.blockedUrl === blockedUrl);
    if (!exists) {
      entry.pendingPrompts.push({
        blockedUrl,
        message: entry.revertCount > 2 ? "Loop diputus (jeda 15d)" : reasonMsg,
        kind: "redirect"
      });
      if (entry.pendingPrompts.length > 10) entry.pendingPrompts.shift();
    }
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

  if (isForwardBack) {
    const idxInStack = entry.stack.lastIndexOf(url);
    if (idxInStack !== -1) {
      entry.stack = entry.stack.slice(0, idxInStack + 1);
    } else if (!isSuspiciousUrl(url, rules)) {
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
    return;
  }

  if (now < entry.lockedUntil) return;

  const prevUrl = entry.stack[entry.stack.length - 1] || "";

  const isExternalOrEntryTransition =
    details.transitionType === "auto_toplevel" ||
    details.transitionType === "typed" ||
    details.transitionType === "auto_bookmark" ||
    details.transitionType === "generated" ||
    details.transitionType === "start_page" ||
    qualifiers.includes("from_address_bar");

  // Jika link dibuka pertama kali di tab atau dibuka dari luar browser (Intent / auto_toplevel / address bar),
  // reset riwayat lama tab agar tidak dianggap redirect dari situs sebelumnya!
  if (isExternalOrEntryTransition) {
    entry.stack = [];
    entry.revertCount = 0;
  }

  if (prevUrl && prevUrl !== url && !isExternalOrEntryTransition) {
    try {
      const prevObj = new URL(prevUrl);
      const currObj = new URL(url);
      const prevHost = prevObj.hostname.toLowerCase();
      const currHost = currObj.hostname.toLowerCase();
      const prevBase = getBaseDomain(prevHost);
      const currBase = getBaseDomain(currHost);

      // Cek apakah halaman sebelumnya adalah mesin pencari (Google, Bing, DuckDuckGo, Yahoo, Yandex Search)
      const isFromSearchEngine =
        (/(^|\.)(google\.|bing\.com|duckduckgo\.com|search\.yahoo\.com|yandex\.|ya\.ru)/i.test(prevHost) &&
          (prevObj.pathname === "/search" || prevObj.pathname === "/url" || prevObj.pathname === "/" || prevObj.searchParams.has("q") || prevObj.searchParams.has("query")));

      if (prevBase !== currBase && !isSameSafeEcosystem(prevHost, currHost)) {
        // Jika berasal dari hasil klik mesin pencari dan domain tujuan bukan blacklist/judol, izinkan langsung!
        const isBlacklisted = isDomainInList(url, rules.denied);
        const isHardMalicious =
          isBlacklisted ||
          GAMBLING_KEYWORDS.test(currObj.href) ||
          COMMERCE_AFFILIATE_REGEX.test(currObj.href) ||
          RANDOM_SHORT_DOMAIN_REGEX.test(currBase);

        if (isFromSearchEngine && !isHardMalicious) {
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

        const isRapidAutoRedirect =
          rules.strictCrossOrigin &&
          !isIntentionalUserNav &&
          !isAuthJump &&
          !isFromSearchEngine &&
          (now - entry.lastTimestamp < rules.redirectWindowMs || qualifiers.includes("client_redirect") || qualifiers.includes("server_redirect"));

        if (isSuspicious || isRapidAutoRedirect) {
          const safeUrl = getSafeReturnUrl(details.tabId, url, rules) || prevUrl;
          forceRevertTab(details.tabId, safeUrl, url, isSuspicious ? "Redirect iklan/affiliate ditahan" : "Auto-redirect lintas domain ditahan", isBlacklisted);
          return;
        }
      }
    } catch (e) {}
  }

  if (!isSuspiciousUrl(url, rules)) {
    if (entry.stack[entry.stack.length - 1] !== url) {
      entry.stack.push(url);
      if (entry.stack.length > 15) entry.stack.shift();
      if (now - entry.lastRevertTime > 4000) {
        entry.revertCount = 0;
      }
    }
    entry.lastTimestamp = now;
  }
});

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const targetUrl = details.url;
  if (!targetUrl || !targetUrl.startsWith("http")) return;

  const rules = await getDomainRules();
  const entry = ensureTabEntry(details.tabId);
  const now = Date.now();

  if (isAuthFlowUrl(targetUrl) && !isSuspiciousUrl(targetUrl, rules)) {
    entry.authGraceUntil = now + 30000;
  }

  if (isManuallyAllowed(entry, targetUrl)) return;
  if (entry.stack.length === 0) return;
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

    const isCurrentSearchEngine =
      /(^|\.)(google\.|bing\.com|duckduckgo\.com|search\.yahoo\.com|yandex\.|ya\.ru)/i.test(prevHost) &&
      (prevObj.pathname === "/search" || prevObj.pathname === "/url" || prevObj.pathname === "/" || prevObj.searchParams.has("q"));

    if (prevBase !== targetBase && !isSameSafeEcosystem(prevHost, targetHost)) {
      const isTargetBlacklisted = isDomainInList(targetUrl, rules.denied);
      if (isCurrentSearchEngine && !isTargetBlacklisted && !GAMBLING_KEYWORDS.test(targetUrl)) {
        return;
      }
      if (isSuspiciousUrl(targetUrl, rules, currentUrl)) {
        const safeUrl = getSafeReturnUrl(details.tabId, targetUrl, rules) || currentUrl;
        const isBlacklisted = isDomainInList(targetUrl, rules.denied);
        forceRevertTab(details.tabId, safeUrl, targetUrl, "Redirect iklan/affiliate ditahan", isBlacklisted);
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

  if (request.type === "GET_PENDING_PROMPTS" && sender.tab && sender.tab.id) {
    const entry = tabHistory.get(sender.tab.id);
    const items = entry && Array.isArray(entry.pendingPrompts) ? [...entry.pendingPrompts] : [];
    if (entry) {
      entry.pendingPrompts = [];
      tabHistory.set(sender.tab.id, entry);
    }
    sendResponse({ prompts: items });
    return true;
  }

  if (request.type === "FORCE_GO_BACK" && sender.tab && sender.tab.id) {
    getDomainRules().then((rules) => {
      const safeUrl = getSafeReturnUrl(sender.tab.id, sender.tab.url, rules);
      forceRevertTab(sender.tab.id, safeUrl, sender.tab.url, request.reason || "Redirect ditahan");
    });
    return;
  }

  if (request.type === "OPEN_GROUP_TAB" && request.url && sender.tab) {
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
    chrome.tabs.create({ url: request.url, active: true });
    return;
  }

  if (request.type === "NAVIGATE_CURRENT_TAB" && request.url && sender.tab && sender.tab.id) {
    const entry = ensureTabEntry(sender.tab.id);
    entry.manualAllowedUrl = request.url;
    entry.manualAllowedUntil = Date.now() + 12000;
    entry.lockedUntil = Date.now() + 8000;
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
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  return JSON.parse(rawText);
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

chrome.runtime.onInstalled.addListener(async (details) => {
  const existing = await chrome.storage.local.get([
    "deniedDomains",
    "trustedDomains",
    "geminiApiKey",
    "strictCrossOrigin",
    "autoSkipCountdown",
    "globalSettings"
  ]);
  const defaultsToSet = {};
  if (typeof existing.strictCrossOrigin !== "boolean") defaultsToSet.strictCrossOrigin = true;
  if (typeof existing.autoSkipCountdown !== "boolean") defaultsToSet.autoSkipCountdown = true;
  if (!Array.isArray(existing.trustedDomains)) defaultsToSet.trustedDomains = [];
  if (!Array.isArray(existing.deniedDomains)) defaultsToSet.deniedDomains = [];
  if (!existing.globalSettings || typeof existing.globalSettings !== "object") {
    defaultsToSet.globalSettings = {
      hudEnabled: true,
      hudDurationSec: 4.5,
      hudPosition: "top-center",
      videoDockEnabled: true,
      videoDockDimSec: 2.5,
      pipSize: "medium",
      adSkipSpeed: "16",
      removeTransparentOverlay: true,
      antiHistoryTrap: true,
      dnrEnabled: true,
      redirectWindowSec: 3.5
    };
  }
  if (Object.keys(defaultsToSet).length > 0) {
    await chrome.storage.local.set(defaultsToSet);
  }
  await syncBlacklistToDnr(existing.deniedDomains || []);
});

chrome.runtime.onStartup.addListener(async () => {
  const { deniedDomains } = await chrome.storage.local.get(["deniedDomains"]);
  await syncBlacklistToDnr(deniedDomains || []);
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === "local" && (changes.deniedDomains || changes.globalSettings)) {
    const { deniedDomains } = await chrome.storage.local.get(["deniedDomains"]);
    syncBlacklistToDnr(deniedDomains || []);
  }
});
