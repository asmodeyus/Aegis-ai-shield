(() => {
  "use strict";

  // Abaikan frame sandbox (about:blank / origin null) & halaman verifikasi Cloudflare Turnstile / Challenge
  if (
    (location.protocol !== "http:" && location.protocol !== "https:") ||
    !location.hostname ||
    window.origin === "null" ||
    location.pathname.includes("/cdn-cgi/challenge-platform/") ||
    location.search.includes("__cf_chl_tk=") ||
    location.search.includes("__cf_chl_rt_tk=") ||
    location.search.includes("__cf_chl_f_tk=") ||
    /(challenges\.cloudflare\.com|cloudflarecaptcha\.com|hcaptcha\.com|recaptcha\.net)/i.test(location.hostname)
  ) {
    return;
  }

  const GAMBLING_REGEX = /(slot|gacor|maxwin|zeus|pragmatic|togel|judol|casino|betting|scatter|rtp|deposit|wd|bonus100|situsresmi|linkalternatif|sbobet|poker|judi|bandar|pascol4d|dewadora|toto4d)/i;
  const SUSPICIOUS_HOST = /\.(cfd|xyz|top|cyou|icu|buzz|click|link|monster|quest|rest|sbs|shop|site|tokyo|vip|wang|win|work|wtf|zone|live|asia|online|store|fun|pro|club|cam|cc|me|pw|tk|ml|ga|cf|gq)$/i;
  const COMMERCE_AFFILIATE_REGEX = /(shopee\.|shope\.ee|tokopedia\.|lazada\.|blibli\.|bukalapak\.|tiktok\.com\/t\/|invol\.co|accesstrade|admitad|ecotrack|go2cloud|onclickalgo|popads|popcash|propellerads|adsterra|hilltopads|exoclick|juicyads|trafficjunky|monetag|richads|wpadmngr|clickadu)/i;
  const RANDOM_SHORT_DOMAIN_REGEX = /^[a-z0-9]{2,4}[0-9][a-z0-9]{1,4}\.(com|net|org|co|id|io|info|biz)$/i;
  const SEARCH_ARBITRAGE_PARAMS = /(utm_source=.*ad|utm_medium=affiliate|af_siteid=|af_sub|clickid=|click_id=|subid=|sub_id=|aff_id=|zoneid=|bannerid=|popunder|redirect|gclid=)/i;
  const SAFE_MEDIA_HOST_REGEX = /(^|\.)(ibb\.co|ibb\.co\.com|imgur\.com|postimg\.cc|pixhost\.to|imgbox\.com|imagebam\.com|prnt\.sc|prntscr\.com|gyazo\.com|flickr\.com|staticflickr\.com|wikimedia\.org|tenor\.com|giphy\.com|redgifs\.com|catbox\.moe|bunkr\.(si|ru|is|la|sk|ax|ac|black|red|media|site)|cyberdrop\.(me|to|cc)|pixeldrain\.com|gofile\.io|mega\.nz|mediafire\.com|drive\.google\.com|docs\.google\.com|dropbox\.com)$/i;
  const KNOWN_AD_SHORTENER_REGEX = /(^|\.)(optional\.me|see\.optional\.me|rebrand\.ly|bit\.ly|t\.ly|tinyurl\.com|is\.gd|v\.gd|cutt\.ly|shorturl\.at|ouo\.io|shrinkme\.io|exe\.io|bc\.vc|adf\.ly|linkvertise\.com)$/i;
  const NON_VIDEO_ASSET_REGEX = /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|avif|css|js|json|woff2?|ttf|eot|vtt|srt)(\?|#|$)/i;
  const VIDEO_EXT_REGEX = /\.(mp4|m3u8|mkv|webm|mov|avi|flv|ts|mpd)(\?|#|$)/i;
  const VIDEO_STREAM_HINT_REGEX = /(\/pass_md5\/|\/hls\/|\/stream\/|\/get_video|mime=video|videoplayback|master\.txt|index\.txt|doodcdn|cloudcdn|vidcdn|\/token\/|\/delivery\/)/i;
  const VIDEO_EMBED_HOST_REGEX = /(dood|ds2play|dsvplay|do7go|ds2video|d000d|d0o0d|dooodster|videostream|vidstream|vidhide|lulustream|filemoon|streamtape|voe\.sx|mixdrop)/i;

  const AUTH_BUTTON_REGEX = /\b(log\s?in|sign\s?in|masuk|daftar|register|sign\s?up|sso|oauth|continue with|lanjutkan dengan|google|microsoft|apple|github|facebook|yandex|discord)\b/i;
  const AUTH_URL_REGEX = /(\/(login|signin|sign-in|log-in|auth|oauth|oauth2|sso|saml|openid|oidc|authorize|callback|session|account|accounts|passport|idp|cas|connect\/authorize|v2\/auth)(\/|$)|[?&](client_id|redirect_uri|response_type|state|scope|openid|code_challenge|samlrequest|return_to|continue|_xfRedirect)=)/i;
  const AUTH_SUBDOMAIN_REGEX = /^(accounts|auth|login|signin|sso|id|oauth|passport|idp|iam)\./i;

  const SEARCH_ENGINE_HOST_REGEX = /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|yandex\.[a-z.]+|ya\.ru|search\.brave\.com|ecosia\.org|startpage\.com|baidu\.com)$/i;
  const MESSENGER_OR_SOCIAL_ENTRY_REGEX = /(^|\.)(t\.me|telegram\.me|telegram\.org|telegra\.ph|wa\.me|whatsapp\.com|l\.wl\.co|l\.facebook\.com|lm\.facebook\.com|l\.instagram\.com|t\.co|redd\.it|out\.reddit\.com|discord\.com|discordapp\.com|line\.me)$/i;
  const EXTERNAL_APP_REFERRER_REGEX = /^(android-app:\/\/|ios-app:\/\/|tg:\/\/|whatsapp:\/\/|intent:\/\/)/i;
  const DISGUISED_AD_CSS_CLASS_REGEX = /(^|\s)(itr|samBannerUnit|samCodeUnit|adsbygoogle|floating-ad|popup-ad|banner-ad|iklan-banner|sponsor-banner|sticky-ad|exo-native|mgid-widget|taboola|outbrain|revcontent|adsterra|propellerads)(\s|$)/i;
  const SHORTLINK_CTA_TEXT_REGEX = /\b(go\s*to\s*link|get\s*link|continue|proceed|download|unduh|lanjut|lanjutkan|menuju\s*link|open\s*link|visit\s*link|unlock\s*link|generate\s*link|buka\s*link|ambil\s*link)\b/i;
  const SHORTLINK_CTA_HREF_REGEX = /([?&](download|dl|go|out|url|link|target|redirect|token|t)=|\/(go|out|redirect|download|dl|get-link|visit|jump|r|l)(\/|$|\?))/i;

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

  function isAuthUrlStr(urlStr) {
    try {
      const u = new URL(urlStr, location.href);
      return AUTH_SUBDOMAIN_REGEX.test(u.hostname.toLowerCase()) || AUTH_URL_REGEX.test(u.pathname + u.search);
    } catch {
      return false;
    }
  }

  const DEFAULT_GLOBAL_SETTINGS = {
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

  const DEFAULT_HUD_POSITIONS = {
    topHud: null,
    videoDock: null,
    miniPip: null
  };

  let trustedDomains = [];
  let deniedDomains = [];
  let strictCrossOrigin = true;
  let autoSkipCountdown = true;
  let globalSettings = { ...DEFAULT_GLOBAL_SETTINGS };
  let hudPositions = { ...DEFAULT_HUD_POSITIONS };
  let autoSkipTriggeredCount = 0;

  // =========================================================================
  // UTILITAS KOORDINAT, EDGE DOCKING & ARAH BUKA KIRI-KANAN (PERSISTENT)
  // =========================================================================
  function clampHudPosition(left, top, elWidth, elHeight, margin = 4, minTopOverride = null) {
    const vw = Math.max(elWidth + margin * 2, window.innerWidth || 360);
    const vh = Math.max(elHeight + margin * 2, window.innerHeight || 640);
    const minTop = minTopOverride !== null ? minTopOverride : margin;
    const maxLeft = Math.max(margin, vw - elWidth - margin);
    const maxTop = Math.max(minTop, vh - elHeight - margin);
    return {
      left: Math.round(Math.max(margin, Math.min(left, maxLeft))),
      top: Math.round(Math.max(minTop, Math.min(top, maxTop)))
    };
  }

  function createSavedHudCoord(left, top, elWidth, elHeight, margin = 4, minTopOverride = null) {
    const vw = window.innerWidth || 360;
    const vh = window.innerHeight || 640;
    const clamped = clampHudPosition(left, top, elWidth, elHeight, margin, minTopOverride);
    const usableW = Math.max(1, vw - elWidth);
    const usableH = Math.max(1, vh - elHeight);
    const centerX = clamped.left + elWidth / 2;
    const anchorSide = centerX < vw / 2 ? "left" : "right";
    const rightOffset = Math.round(Math.max(margin, vw - (clamped.left + elWidth)));
    return {
      left: clamped.left,
      top: clamped.top,
      xRatio: Number(Math.max(0, Math.min(1, clamped.left / usableW)).toFixed(4)),
      yRatio: Number(Math.max(0, Math.min(1, clamped.top / usableH)).toFixed(4)),
      anchorSide,
      rightOffset
    };
  }

  function resolveSavedHudCoord(saved, elWidth, elHeight, margin = 4, minTopOverride = null) {
    if (!saved || typeof saved.left !== "number" || typeof saved.top !== "number") {
      return null;
    }
    const vw = window.innerWidth || 360;
    const vh = window.innerHeight || 640;
    const anchorSide = saved.anchorSide || (saved.left < vw / 2 ? "left" : "right");
    let candidateLeft = saved.left;
    let candidateTop = saved.top;

    if (anchorSide === "right" && typeof saved.rightOffset === "number") {
      candidateLeft = vw - elWidth - saved.rightOffset;
    } else if (
      typeof saved.xRatio === "number" &&
      typeof saved.yRatio === "number" &&
      (saved.left + elWidth + margin > vw || saved.top + elHeight + margin > vh)
    ) {
      const usableW = Math.max(1, vw - elWidth);
      const usableH = Math.max(1, vh - elHeight);
      candidateLeft = saved.xRatio * usableW;
      candidateTop = saved.yRatio * usableH;
    }
    const clamped = clampHudPosition(candidateLeft, candidateTop, elWidth, elHeight, margin, minTopOverride);
    const right = Math.round(Math.max(margin, vw - (clamped.left + elWidth)));
    return {
      left: clamped.left,
      top: clamped.top,
      right,
      anchorSide
    };
  }

  function getEffectiveVideoDockDir() {
    const cfgDir = globalSettings.videoDockExpandDir || "auto";
    if (cfgDir === "ltr") return "ltr";
    if (cfgDir === "rtl") return "rtl";
    const saved = hudPositions && hudPositions.videoDock;
    if (saved) {
      if (saved.anchorSide === "left") return "ltr";
      if (saved.anchorSide === "right") return "rtl";
      return saved.left < (window.innerWidth || 360) / 2 ? "ltr" : "rtl";
    }
    return "rtl";
  }

  function saveHudPosition(key, coordObj) {
    hudPositions = {
      ...hudPositions,
      [key]: coordObj || null
    };
    try {
      chrome.storage.local.set({ hudPositions: { ...hudPositions } });
    } catch (e) {}
  }

  function applySavedMiniPipPosition() {
    if (hudPositions && hudPositions.miniPip) {
      const resolved = resolveSavedHudCoord(hudPositions.miniPip, miniPlayerPos.width, miniPlayerPos.height, 8, 28);
      if (resolved) {
        miniPlayerUserMoved = true;
        miniPlayerPos.left = resolved.left;
        miniPlayerPos.top = resolved.top;
        return;
      }
    }
    miniPlayerUserMoved = false;
  }

  function applyPipDimensionsFromGlobal() {
    const sz = globalSettings.pipSize || "medium";
    if (sz === "small") {
      miniPlayerPos.width = 220;
      miniPlayerPos.height = 124;
    } else if (sz === "large") {
      miniPlayerPos.width = 320;
      miniPlayerPos.height = 180;
    } else {
      miniPlayerPos.width = 260;
      miniPlayerPos.height = 146;
    }
    applySavedMiniPipPosition();
    if (miniPlayerStyleEl) {
      miniPlayerStyleEl.remove();
      miniPlayerStyleEl = null;
    }
    if (isMiniPlayerActive) {
      ensureMiniPlayerStyle();
      updateMiniPlayerPosition();
    }
  }

  let storageRulesLoaded = false;
  let resolveStorageReady;
  const storageReadyPromise = new Promise((resolve) => {
    resolveStorageReady = resolve;
  });

  function purgeBlacklistedOrTrustedPrompts() {
    if (!Array.isArray(promptQueue) || promptQueue.length === 0) return;
    for (let i = promptQueue.length - 1; i >= 0; i--) {
      const item = promptQueue[i];
      if (!item || !item.blockedUrl || isUrlInDeniedList(item.blockedUrl) || isUrlInTrustedList(item.blockedUrl)) {
        promptQueue.splice(i, 1);
      }
    }
  }

  chrome.storage.local.get(
    ["trustedDomains", "deniedDomains", "strictCrossOrigin", "autoSkipCountdown", "globalSettings", "hudPositions"],
    (res) => {
      trustedDomains = Array.isArray(res.trustedDomains) ? res.trustedDomains : [];
      deniedDomains = Array.isArray(res.deniedDomains) ? res.deniedDomains : [];
      strictCrossOrigin = res.strictCrossOrigin !== false;
      autoSkipCountdown = res.autoSkipCountdown !== false;
      globalSettings = { ...DEFAULT_GLOBAL_SETTINGS, ...(res.globalSettings || {}) };
      hudPositions = { ...DEFAULT_HUD_POSITIONS, ...(res.hudPositions || {}) };
      storageRulesLoaded = true;
      if (typeof resolveStorageReady === "function") resolveStorageReady();
      purgeBlacklistedOrTrustedPrompts();
      applyPipDimensionsFromGlobal();
      syncMainWorldRules();
      if (window.top === window.self) {
        if (isRenderingHud || promptQueue.length > 0) renderTopManualHUD();
        renderFloatingVideoDock();
      }
    }
  );

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.trustedDomains) trustedDomains = changes.trustedDomains.newValue || [];
    if (changes.deniedDomains) deniedDomains = changes.deniedDomains.newValue || [];
    if (changes.strictCrossOrigin) strictCrossOrigin = changes.strictCrossOrigin.newValue !== false;
    if (changes.autoSkipCountdown) autoSkipCountdown = changes.autoSkipCountdown.newValue !== false;
    if (changes.globalSettings) {
      globalSettings = { ...DEFAULT_GLOBAL_SETTINGS, ...(changes.globalSettings.newValue || {}) };
      applyPipDimensionsFromGlobal();
    }
    if (changes.hudPositions) {
      hudPositions = { ...DEFAULT_HUD_POSITIONS, ...(changes.hudPositions.newValue || {}) };
      applySavedMiniPipPosition();
      if (isMiniPlayerActive) {
        updateMiniPlayerPosition();
      }
    }
    purgeBlacklistedOrTrustedPrompts();
    syncMainWorldRules();
    if (window.top === window.self) {
      if (isRenderingHud || promptQueue.length === 0) renderTopManualHUD();
      renderFloatingVideoDock();
    }
  });

  function syncMainWorldRules() {
    window.dispatchEvent(
      new CustomEvent("__AEGIS_SYNC_RULES__", {
        detail: {
          trusted: trustedDomains,
          denied: deniedDomains,
          strictCrossOrigin,
          autoSkipCountdown,
          globalSettings
        }
      })
    );
  }

  window.addEventListener("__AEGIS_AUTH_GESTURE__", () => {
    try {
      chrome.runtime.sendMessage({ type: "AUTH_FLOW_STARTED" });
    } catch (e) {}
  });

  function logAegisEvent(level, code, toUrl, detail) {
    if (globalSettings.loggingEnabled === false) return;
    try {
      chrome.runtime.sendMessage({
        type: "APPEND_AEGIS_LOG",
        entry: {
          level: level || "WARN",
          source: "content",
          code: code || "CONTENT_EVENT",
          fromUrl: location.href,
          toUrl: toUrl ? String(toUrl) : "",
          detail: detail ? String(detail) : ""
        }
      });
    } catch (e) {}
  }

  window.addEventListener("__AEGIS_LOG_EVENT__", (ev) => {
    if (!ev.detail || globalSettings.loggingEnabled === false) return;
    try {
      chrome.runtime.sendMessage({
        type: "APPEND_AEGIS_LOG",
        entry: ev.detail
      });
    } catch (e) {}
  });

  function getBaseDomain(hostname) {
    const parts = hostname.split(".").filter(Boolean);
    if (parts.length <= 2) return hostname;
    const sld = parts[parts.length - 2];
    if (["co", "com", "net", "org", "ac", "go", "or", "web", "sch"].includes(sld) && parts.length >= 3) {
      return parts.slice(-3).join(".");
    }
    return parts.slice(-2).join(".");
  }

  function isVideoUrl(urlStr, isConfirmedMime = false) {
    if (!urlStr || typeof urlStr !== "string") return false;
    const clean = urlStr.trim();
    if (NON_VIDEO_ASSET_REGEX.test(clean)) return false;
    if (isConfirmedMime) return true;
    return VIDEO_EXT_REGEX.test(clean) || VIDEO_STREAM_HINT_REGEX.test(clean);
  }

  function normalizeRuleDomain(raw) {
    return String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .split("?")[0]
      .split("#")[0];
  }

  function isUrlMatchedInList(urlStr, list) {
    if (!urlStr || !Array.isArray(list) || list.length === 0) return false;
    try {
      const target = new URL(urlStr, location.href);
      const host = target.hostname.toLowerCase().replace(/^www\./, "");
      if (!host) return false;
      const baseHost = getBaseDomain(host);
      for (const item of list) {
        const rule = normalizeRuleDomain(item);
        if (!rule) continue;
        const ruleBase = getBaseDomain(rule);
        if (
          host === rule ||
          baseHost === rule ||
          host === ruleBase ||
          baseHost === ruleBase ||
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

  function isUrlInDeniedList(urlStr) {
    return isUrlMatchedInList(urlStr, deniedDomains);
  }

  function isUrlInTrustedList(urlStr) {
    return isUrlMatchedInList(urlStr, trustedDomains);
  }

  function addDomainToBlacklist(urlStr, callback) {
    try {
      const u = new URL(urlStr, location.href);
      const baseHost = getBaseDomain(u.hostname.toLowerCase());
      if (!baseHost) return;
      chrome.storage.local.get(["deniedDomains", "trustedDomains"], (res) => {
        const denied = Array.isArray(res.deniedDomains) ? [...res.deniedDomains] : [];
        const trusted = Array.isArray(res.trustedDomains) ? res.trustedDomains.filter((d) => normalizeRuleDomain(d) !== baseHost && normalizeRuleDomain(d) !== u.hostname.toLowerCase()) : [];
        if (!denied.includes(baseHost)) {
          denied.push(baseHost);
        }
        deniedDomains = denied;
        trustedDomains = trusted;
        purgeBlacklistedOrTrustedPrompts();
        syncMainWorldRules();
        chrome.storage.local.set({ deniedDomains: denied, trustedDomains: trusted }, () => {
          if (typeof callback === "function") callback(baseHost);
        });
      });
    } catch (e) {}
  }

  function addDomainToWhitelist(urlStr, callback) {
    try {
      const u = new URL(urlStr, location.href);
      const baseHost = getBaseDomain(u.hostname.toLowerCase());
      if (!baseHost) return;
      chrome.storage.local.get(["trustedDomains", "deniedDomains"], (res) => {
        const trusted = Array.isArray(res.trustedDomains) ? [...res.trustedDomains] : [];
        const denied = Array.isArray(res.deniedDomains) ? res.deniedDomains.filter((d) => normalizeRuleDomain(d) !== baseHost && normalizeRuleDomain(d) !== u.hostname.toLowerCase()) : [];
        if (!trusted.includes(baseHost)) {
          trusted.push(baseHost);
        }
        trustedDomains = trusted;
        deniedDomains = denied;
        purgeBlacklistedOrTrustedPrompts();
        syncMainWorldRules();
        chrome.storage.local.set({ trustedDomains: trusted, deniedDomains: denied }, () => {
          if (typeof callback === "function") callback(baseHost);
        });
      });
    } catch (e) {}
  }

  function isDangerousUrl(urlStr) {
    try {
      if (/^(intent|shopeeid|tokopedia|lazada|market):/i.test(urlStr.trim())) {
        return true;
      }
      const target = new URL(urlStr, location.href);
      const curHost = location.hostname.toLowerCase();
      const host = target.hostname.toLowerCase();
      const baseHost = getBaseDomain(host);
      const currentBase = getBaseDomain(curHost);

      if (isUrlInTrustedList(target.href)) return false;
      if (isUrlInDeniedList(target.href)) return true;
      if (baseHost === currentBase) return false;
      if (isSameSafeEcosystem(curHost, host)) return false;
      if (isAuthUrlStr(target.href)) return false;

      if (host.includes("google.") && target.pathname === "/search") return true;
      if (
        GAMBLING_REGEX.test(target.href) ||
        COMMERCE_AFFILIATE_REGEX.test(target.href) ||
        RANDOM_SHORT_DOMAIN_REGEX.test(baseHost) ||
        SEARCH_ARBITRAGE_PARAMS.test(target.href) ||
        KNOWN_AD_SHORTENER_REGEX.test(host)
      ) {
        return true;
      }
      if (SAFE_MEDIA_HOST_REGEX.test(host)) {
        return false;
      }
      if (SUSPICIOUS_HOST.test(host)) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // =========================================================================
  // AI-LEVEL SMART UGC vs. AD-INFILTRATED IMAGE CLASSIFIER (OPSI 1 + OPSI 2)
  // Memindai pola class CSS, atribut URL (.click / .top / shortener), & kecocokan domain thumbnail
  // =========================================================================
  function hasDisguisedAdCssClass(el) {
    if (!el) return false;
    const ownClass = typeof el.className === "string" ? el.className : "";
    const parentEl = el.parentElement;
    const parentClass = parentEl && typeof parentEl.className === "string" ? parentEl.className : "";
    return DISGUISED_AD_CSS_CLASS_REGEX.test(ownClass) || DISGUISED_AD_CSS_CLASS_REGEX.test(parentClass);
  }

  function isRealAdSlotContainer(el) {
    if (!el || !el.closest) return false;
    if (hasDisguisedAdCssClass(el)) return true;
    // Abaikan class jebakan anti-adblock (.message-main.ads, img.bbImage.adUnit)
    return Boolean(
      el.closest(
        ".itr, #header_sp, [id^='header_sp'], .samBannerUnit, .samCodeUnit, [data-revive-zoneid], ins.adsbygoogle, [id^='div-gpt-ad'], [class*='floating-ad' i], [class*='popup-ad' i], [class*='banner-ad' i], [class*='iklan-banner' i], [class*='sponsor-banner' i], [class*='exo-native' i], [class*='mgid-widget' i]"
      )
    );
  }

  function isInsideUserPostContent(el) {
    if (!el || !el.closest) return false;
    if (isRealAdSlotContainer(el)) return false;
    const rel = (el.getAttribute && el.getAttribute("rel")) || "";
    const hasUgcRel = /\bugc\b/i.test(rel);
    const hasBbImage = Boolean(el.querySelector && el.querySelector("img.bbImage, img[data-url]"));
    const inContentContainer = Boolean(
      el.closest(
        ".bbWrapper, .message-userContent, article.message-body, .message-content, .postbody, .post-content, .entry-content, .comment-content, .markdown-body, [data-xf-init*='lightbox' i]"
      )
    );
    return hasUgcRel || hasBbImage || inContentContainer;
  }

  function checkThumbnailMatchesDestination(anchorEl, destBaseHost) {
    if (!anchorEl || !anchorEl.querySelector || !destBaseHost) return false;
    const imgEl = anchorEl.querySelector("img");
    if (!imgEl) return false;
    const rawImgSrc = imgEl.getAttribute("data-url") || imgEl.getAttribute("data-src") || imgEl.currentSrc || imgEl.src || "";
    if (!rawImgSrc) return false;
    try {
      const imgHost = new URL(rawImgSrc, location.href).hostname.toLowerCase();
      const imgBase = getBaseDomain(imgHost);
      return Boolean(imgBase && (imgBase === destBaseHost || SAFE_MEDIA_HOST_REGEX.test(imgHost)));
    } catch {
      return false;
    }
  }

  function classifyContentLinkOrImage(anchorEl, rawHref) {
    const raw = String(rawHref || "").trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("javascript:")) {
      return {
        category: "AUTH_OR_SAME_ORIGIN",
        resolvedUrl: raw,
        shouldAllowDirectly: true,
        shouldHoldInHud: false,
        shouldSilentBlock: false,
        reason: ""
      };
    }

    if (/^(intent|shopeeid|tokopedia|lazada|market):/i.test(raw)) {
      return {
        category: "AD_INFILTRATED_IMAGE_OR_BANNER",
        resolvedUrl: raw,
        shouldAllowDirectly: false,
        shouldHoldInHud: true,
        shouldSilentBlock: false,
        reason: "Deep-link aplikasi belanja/iklan ditahan"
      };
    }

    let target;
    try {
      target = new URL(raw, location.href);
    } catch {
      return {
        category: "AUTH_OR_SAME_ORIGIN",
        resolvedUrl: raw,
        shouldAllowDirectly: true,
        shouldHoldInHud: false,
        shouldSilentBlock: false,
        reason: ""
      };
    }

    if (!target.protocol.startsWith("http")) {
      return {
        category: "AUTH_OR_SAME_ORIGIN",
        resolvedUrl: target.href,
        shouldAllowDirectly: true,
        shouldHoldInHud: false,
        shouldSilentBlock: false,
        reason: ""
      };
    }

    const curHost = location.hostname.toLowerCase();
    const curBase = getBaseDomain(curHost);
    const host = target.hostname.toLowerCase();
    const baseHost = getBaseDomain(host);

    if (
      baseHost === curBase ||
      isSameSafeEcosystem(curHost, host) ||
      isUrlInTrustedList(target.href) ||
      isAuthUrlStr(target.href)
    ) {
      return {
        category: "AUTH_OR_SAME_ORIGIN",
        resolvedUrl: target.href,
        shouldAllowDirectly: true,
        shouldHoldInHud: false,
        shouldSilentBlock: false,
        reason: ""
      };
    }

    // Domain yang sudah ada di Blacklist pengguna diblokir secara SENYAP tanpa memunculkan HUD Block Menu!
    if (isUrlInDeniedList(target.href)) {
      return {
        category: "BLACKLISTED_SILENT_BLOCK",
        resolvedUrl: target.href,
        shouldAllowDirectly: false,
        shouldHoldInHud: false,
        shouldSilentBlock: true,
        reason: "Domain berada di daftar Blacklist (diblokir senyap)"
      };
    }

    const inRealAdSlot = isRealAdSlotContainer(anchorEl);
    const inUserPost = isInsideUserPostContent(anchorEl);
    const hasImgChild = Boolean(anchorEl && anchorEl.querySelector && anchorEl.querySelector("img"));
    const inlineOnclick = (anchorEl && anchorEl.getAttribute && (anchorEl.getAttribute("onclick") || anchorEl.getAttribute("onmousedown"))) || "";
    const hasSuspiciousInlineOnclick = /(window\.open|location\.href|popunder|adsterra|onclickalgo)/i.test(inlineOnclick);
    const thumbnailMatchesDest = checkThumbnailMatchesDestination(anchorEl, baseHost);

    const isHardAdOrGambling =
      GAMBLING_REGEX.test(target.href) ||
      COMMERCE_AFFILIATE_REGEX.test(target.href) ||
      SEARCH_ARBITRAGE_PARAMS.test(target.href) ||
      RANDOM_SHORT_DOMAIN_REGEX.test(baseHost) ||
      (host.includes("google.") && target.pathname === "/search");

    const isKnownAdShortener = KNOWN_AD_SHORTENER_REGEX.test(host);
    const isSuspiciousTld = SUSPICIOUS_HOST.test(host);
    const isSafeMediaHost = SAFE_MEDIA_HOST_REGEX.test(host);

    if (inRealAdSlot || hasSuspiciousInlineOnclick) {
      return {
        category: "AD_INFILTRATED_IMAGE_OR_BANNER",
        resolvedUrl: target.href,
        shouldAllowDirectly: false,
        shouldHoldInHud: true,
        shouldSilentBlock: false,
        reason: "Banner iklan / gambar tersusupi iklan ditahan"
      };
    }

    if (isHardAdOrGambling || isKnownAdShortener) {
      return {
        category: "AD_INFILTRATED_IMAGE_OR_BANNER",
        resolvedUrl: target.href,
        shouldAllowDirectly: false,
        shouldHoldInHud: true,
        shouldSilentBlock: false,
        reason: hasImgChild
          ? "Gambar tersusupi tautan iklan/judol ditahan"
          : "Tautan iklan/affiliate/judol ditahan"
      };
    }

    // Opsi 1: Hosting gambar & media populer (ibb.co.com, imgur.com, postimg.cc, pixhost.to, dll.) langsung dibuka
    if (isSafeMediaHost) {
      return {
        category: "SAFE_MEDIA_OR_UGC",
        resolvedUrl: target.href,
        shouldAllowDirectly: true,
        shouldHoldInHud: false,
        shouldSilentBlock: false,
        reason: ""
      };
    }

    // Opsi 1 + Opsi 2: AI Smart UGC Classifier untuk konten di dalam postingan member (.bbWrapper / rel~="ugc" / img.bbImage)
    if (globalSettings.smartUgcSense !== false && inUserPost) {
      if (isSuspiciousTld) {
        return {
          category: "SUSPICIOUS_EXTERNAL_UGC_HOLD",
          resolvedUrl: target.href,
          shouldAllowDirectly: false,
          shouldHoldInHud: true,
          shouldSilentBlock: false,
          reason: "Konten eksternal (.click/.top) ditahan — Pilih ↗ Buka jika aman"
        };
      }
      return {
        category: "SAFE_MEDIA_OR_UGC",
        resolvedUrl: target.href,
        shouldAllowDirectly: true,
        shouldHoldInHud: false,
        shouldSilentBlock: false,
        reason: thumbnailMatchesDest ? "Gambar thumbnail sesuai dengan domain tujuan" : ""
      };
    }

    if (isSuspiciousTld) {
      return {
        category: "SUSPICIOUS_EXTERNAL_UGC_HOLD",
        resolvedUrl: target.href,
        shouldAllowDirectly: false,
        shouldHoldInHud: true,
        shouldSilentBlock: false,
        reason: "Tautan eksternal (.click/.top) ditahan — Pilih ↗ Buka jika aman"
      };
    }

    return {
      category: "SAFE_MEDIA_OR_UGC",
      resolvedUrl: target.href,
      shouldAllowDirectly: true,
      shouldHoldInHud: false,
      shouldSilentBlock: false,
      reason: ""
    };
  }

  if (window.top === window.self) {
    const currentHost = location.hostname.toLowerCase();
    const currentBase = getBaseDomain(currentHost);
    const rawRef = String(document.referrer || "").trim();
    const refHost = (() => {
      try { return rawRef ? new URL(rawRef).hostname.toLowerCase() : ""; } catch { return ""; }
    })();
    const isFromSearchReferrer = SEARCH_ENGINE_HOST_REGEX.test(refHost) || /com\.google\.android\.googlequicksearchbox/i.test(rawRef);
    const isFromMessengerOrSocialReferrer =
      MESSENGER_OR_SOCIAL_ENTRY_REGEX.test(refHost) ||
      EXTERNAL_APP_REFERRER_REGEX.test(rawRef);
    const isDirectFirstPageEntry = !rawRef && window.history.length <= 2;

    if (
      !isSameSafeEcosystem(currentHost, currentHost) &&
      !SAFE_MEDIA_HOST_REGEX.test(currentHost) &&
      !isFromSearchReferrer &&
      !isFromMessengerOrSocialReferrer &&
      !isDirectFirstPageEntry &&
      (GAMBLING_REGEX.test(location.href) ||
      SUSPICIOUS_HOST.test(currentHost) ||
      COMMERCE_AFFILIATE_REGEX.test(location.href) ||
      RANDOM_SHORT_DOMAIN_REGEX.test(currentBase))
    ) {
      chrome.storage.local.get(["trustedDomains", "deniedDomains"], (res) => {
        const trustedList = Array.isArray(res.trustedDomains) ? res.trustedDomains : [];
        const deniedList = Array.isArray(res.deniedDomains) ? res.deniedDomains : [];
        const isTrusted = isUrlMatchedInList(location.href, trustedList);
        const isDenied = isUrlMatchedInList(location.href, deniedList);
        if (!isTrusted) {
          chrome.runtime.sendMessage(
            { type: "CHECK_SHOULD_BLOCK_ENTRY", url: location.href },
            (check) => {
              if (check && check.shouldRevert) {
                try { window.stop(); } catch (e) {}
                chrome.runtime.sendMessage({
                  type: "FORCE_GO_BACK",
                  reason: isDenied || check.isBlacklisted ? "Domain Blacklist diblokir senyap" : (check.reason || "Redirect iklan/affiliate ditahan")
                });
              }
            }
          );
        }
      });
    }
  }

  window.addEventListener("__AEGIS_REQUEST_RULES__", () => {
    syncMainWorldRules();
  });

  // =========================================================================
  // ANTREAN KONFIRMASI MANUAL (ATAS) & FLOATING VIDEO DOCK (DI BAWAH VIDEO)
  // =========================================================================
  const promptQueue = [];
  const seenPromptUrls = new Set();
  const detectedVideos = [];
  let isRenderingHud = false;
  let previewOpen = false;
  let videoDrawerOpen = false;
  let videoDockManualExpanded = false;
  let hudAutoCloseTimer = null;
  let hudInteractionPaused = false;
  let isDraggingTopHud = false;

  let videoDockDimTimer = null;
  let videoDockInteractionPaused = false;
  let videoDockPositionRAF = null;
  let isDraggingVideoDock = false;

  let isMiniPlayerActive = false;
  let miniPlayerStyleEl = null;
  let pipToggleLock = false;
  let miniPlayerUserMoved = false;
  let miniPlayerPos = {
    left: null,
    top: null,
    width: 260,
    height: 146
  };

  function enqueueManualPrompt(item) {
    if (!item || !item.blockedUrl) return;
    const cleanUrl = String(item.blockedUrl).trim();
    if (!cleanUrl.startsWith("http") && !/^(intent|shopeeid|tokopedia|lazada):/i.test(cleanUrl)) return;

    // Pastikan rules dari chrome.storage.local sudah dimuat sebelum memproses antrean HUD,
    // sehingga domain yang sudah masuk Blacklist TIDAK PERNAH memunculkan HUD Block Menu!
    if (!storageRulesLoaded) {
      storageReadyPromise.then(() => {
        enqueueManualPrompt(item);
      });
      return;
    }

    if (isUrlInDeniedList(cleanUrl) || isUrlInTrustedList(cleanUrl)) {
      return;
    }

    if (seenPromptUrls.has(cleanUrl)) return;
    seenPromptUrls.add(cleanUrl);

    if (window.top !== window.self) {
      window.top.postMessage({
        __AEGIS_FORWARD_PROMPT__: true,
        payload: { blockedUrl: cleanUrl, message: item.message, kind: item.kind }
      }, "*");
      return;
    }

    promptQueue.push({
      blockedUrl: cleanUrl,
      message: item.message || "Popup / Redirect ditahan",
      kind: item.kind || "popup"
    });

    if (!isRenderingHud) {
      renderTopManualHUD();
    }
  }

  function registerDetectedVideo(rawUrl, isConfirmedMime = false) {
    if (!rawUrl) return;
    try {
      const rawStr = String(rawUrl).trim();
      if (rawStr.startsWith("data:") || rawStr.startsWith("blob:")) return;
      const absUrl = new URL(rawStr, location.href).href;
      if (!absUrl.startsWith("http")) return;
      if (NON_VIDEO_ASSET_REGEX.test(absUrl)) return;
      if (!isVideoUrl(absUrl, isConfirmedMime)) return;

      if (window.top !== window.self) {
        window.top.postMessage({
          __AEGIS_FORWARD_VIDEO__: true,
          url: absUrl,
          confirmed: isConfirmedMime
        }, "*");
        return;
      }

      if (!detectedVideos.includes(absUrl)) {
        detectedVideos.push(absUrl);
        if (detectedVideos.length > 15) detectedVideos.shift();
        renderFloatingVideoDock();
      }
    } catch (e) {}
  }

  function runIsolatedAutoSkip() {
    if (!autoSkipCountdown) return;
    const curHost = location.hostname.toLowerCase();
    if (isUrlInTrustedList(location.href) || isSameSafeEcosystem(curHost, curHost)) return;

    let skipped = false;
    document.querySelectorAll("button, a, [role='button']").forEach((el) => {
      try {
        if (
          el.id === "aegis-top-manual-hud" ||
          el.closest("#aegis-top-manual-hud") ||
          el.id === "aegis-video-bottom-dock" ||
          el.closest("#aegis-video-bottom-dock")
        ) return;
        const txt = (el.innerText || el.getAttribute("aria-label") || "").trim();
        if (/^(skip|skip ad|skip ads|lewati|lewati iklan|close ad|tutup iklan)$/i.test(txt)) {
          if (el.dataset.aegisIsoClicked === "1") return;
          el.dataset.aegisIsoClicked = "1";
          el.disabled = false;
          el.removeAttribute("disabled");
          el.click();
          skipped = true;
        }
      } catch (e) {}
    });

    if (skipped) {
      notifyAutoSkipped();
    }
  }

  function notifyAutoSkipped() {
    if (window.top !== window.self) {
      window.top.postMessage({ __AEGIS_FORWARD_AUTO_SKIPPED__: true }, "*");
      return;
    }
    autoSkipTriggeredCount += 1;
    renderFloatingVideoDock();
  }

  setInterval(runIsolatedAutoSkip, 900);

  window.addEventListener("__AEGIS_AUTO_SKIPPED__", () => {
    notifyAutoSkipped();
  });

  window.addEventListener("message", (ev) => {
    if (!ev.data) return;
    if (window.top === window.self) {
      if (ev.data.__AEGIS_FORWARD_PROMPT__ && ev.data.payload) {
        enqueueManualPrompt(ev.data.payload);
      } else if (ev.data.__AEGIS_FORWARD_VIDEO__ && ev.data.url) {
        registerDetectedVideo(ev.data.url, Boolean(ev.data.confirmed));
      } else if (ev.data.__AEGIS_FORWARD_AUTO_SKIPPED__) {
        notifyAutoSkipped();
      }
    }
  });

  window.addEventListener("__AEGIS_BLOCKED_EVENT__", (ev) => {
    if (!ev.detail) return;
    enqueueManualPrompt({
      blockedUrl: ev.detail.url,
      kind: ev.detail.kind || "popup",
      message: ev.detail.kind === "redirect" ? "Redirect ditahan" : "Popup ditahan"
    });
  });

  window.addEventListener("__AEGIS_VIDEO_DETECTED__", (ev) => {
    if (ev.detail && ev.detail.url) {
      registerDetectedVideo(ev.detail.url, Boolean(ev.detail.confirmed));
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "AEGIS_STRICT_PROMPT") {
      enqueueManualPrompt({
        blockedUrl: msg.blockedUrl,
        kind: msg.kind || "redirect",
        message: msg.message || "Navigasi ditahan"
      });
    }
  });

  function ensureVideoControlsVisible() {
    document.querySelectorAll("video").forEach((v) => {
      try {
        const st = window.getComputedStyle(v);
        if (st.visibility === "hidden" || parseFloat(st.opacity) < 0.05) {
          v.style.visibility = "visible";
          v.style.opacity = "1";
        }
        if (!v.hasAttribute("controls")) {
          const parent = v.parentElement;
          const hasCustomControls = parent && parent.querySelector("[class*='control'], [class*='play'], [class*='vjs-'], [class*='jw-'], [class*='plyr']");
          if (!hasCustomControls) {
            v.setAttribute("controls", "controls");
          }
        }
      } catch (e) {}
    });
  }

  if (window.top === window.self) {
    storageReadyPromise.then(() => {
      tryEarlyDirectShortlinkBypass();
    });
    window.addEventListener("DOMContentLoaded", () => {
      chrome.runtime.sendMessage({ type: "GET_PENDING_PROMPTS" }, (res) => {
        if (res && Array.isArray(res.prompts)) {
          res.prompts.forEach((p) => enqueueManualPrompt(p));
        }
      });
      scanDomForVideos();
      ensureVideoControlsVisible();
      neutralizeEmptyTrapOverlays();
      storageReadyPromise.then(() => {
        if (!tryEarlyDirectShortlinkBypass()) {
          runShortlinkDebloatedBypassStep();
        }
      });
      setTimeout(() => {
        scanDomForVideos();
        ensureVideoControlsVisible();
        neutralizeEmptyTrapOverlays();
        runShortlinkDebloatedBypassStep();
      }, 1500);
      setTimeout(() => {
        scanDomForVideos();
        ensureVideoControlsVisible();
        neutralizeEmptyTrapOverlays();
        runShortlinkDebloatedBypassStep();
      }, 4000);
      setTimeout(() => {
        storageReadyPromise.then(() => {
          runAiDomAudit();
        });
      }, 1200);
    });
    setInterval(() => {
      if (document.readyState !== "loading") {
        runShortlinkDebloatedBypassStep();
      }
    }, 1100);
  }

  function scanDomForVideos() {
    document.querySelectorAll("video, video source, a[href]").forEach((el) => {
      const src = el.currentSrc || el.src || el.getAttribute("src") || el.getAttribute("href") || "";
      if (src) {
        if (src.startsWith("blob:")) {
          registerDetectedVideo(location.href, true);
        } else if (isVideoUrl(src)) {
          registerDetectedVideo(src);
        }
      }
    });

    document.querySelectorAll("iframe[src]").forEach((ifr) => {
      const ifrSrc = ifr.src || ifr.getAttribute("src") || "";
      if (ifrSrc && VIDEO_EMBED_HOST_REGEX.test(ifrSrc)) {
        registerDetectedVideo(ifrSrc, true);
      }
    });

    ensureVideoControlsVisible();

    if (window.top === window.self) {
      renderFloatingVideoDock();
    }
  }

  setTimeout(scanDomForVideos, 1200);
  setTimeout(scanDomForVideos, 3500);
  setTimeout(scanDomForVideos, 7000);

  let domVideoScanDebounce = null;
  const videoDomObserver = new MutationObserver((mutations) => {
    let foundMediaNode = false;
    for (const m of mutations) {
      if (m.type === "attributes" && (m.target.tagName === "VIDEO" || m.target.tagName === "IFRAME" || m.target.tagName === "SOURCE")) {
        foundMediaNode = true;
        break;
      }
      for (const node of m.addedNodes) {
        if (node.nodeType === 1 && (node.tagName === "VIDEO" || node.tagName === "IFRAME" || (node.querySelector && node.querySelector("video, iframe")))) {
          foundMediaNode = true;
          break;
        }
      }
      if (foundMediaNode) break;
    }
    if (foundMediaNode) {
      clearTimeout(domVideoScanDebounce);
      domVideoScanDebounce = setTimeout(scanDomForVideos, 450);
    }
  });

  if (document.documentElement) {
    videoDomObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"]
    });
  }

  // =========================================================================
  // SMART VIDEO ANCHOR & EDGE-AWARE FLOATING DOCK (BUKA KIRI→KANAN / KANAN→KIRI)
  // =========================================================================
  function findPrimaryVideoElement() {
    const fsEl = getActiveFullscreenElement();
    if (fsEl) {
      if (fsEl.tagName === "VIDEO") return fsEl;
      const innerVid = fsEl.querySelector && fsEl.querySelector("video");
      if (innerVid) return innerVid;
      return fsEl;
    }

    let bestEl = null;
    let bestScore = 0;

    document.querySelectorAll("video").forEach((v) => {
      const rect = v.getBoundingClientRect();
      if (rect.width < 120 || rect.height < 80) return;
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const st = window.getComputedStyle(v);
      if (st.display === "none" || st.visibility === "hidden" || parseFloat(st.opacity) === 0) return;
      const hasMediaSource = Boolean(v.currentSrc || v.src || v.querySelector("source[src]") || v.readyState > 0);
      if (!hasMediaSource) return;
      const area = rect.width * rect.height;
      const playingBonus = (!v.paused && !v.ended && v.readyState >= 2) ? 5000000 : 0;
      const score = area + playingBonus;
      if (score > bestScore) {
        bestScore = score;
        bestEl = v;
      }
    });

    if (bestEl) return bestEl;

    document.querySelectorAll("iframe").forEach((ifr) => {
      const rect = ifr.getBoundingClientRect();
      if (rect.width < 180 || rect.height < 110) return;
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const st = window.getComputedStyle(ifr);
      if (st.display === "none" || st.visibility === "hidden") return;
      const src = (ifr.src || ifr.getAttribute("src") || "").toLowerCase();
      if (!src || src === "about:blank" || src.startsWith("javascript:")) return;
      const isPlayerHint = VIDEO_EMBED_HOST_REGEX.test(src) || /(\/embed\/|\/player\/|\/video\/|player\.|embed\.|m3u8|mp4)/i.test(src);
      if (isPlayerHint) {
        const score = rect.width * rect.height;
        if (score > bestScore) {
          bestScore = score;
          bestEl = ifr;
        }
      }
    });

    return bestEl;
  }

  function updateFloatingVideoDockPosition() {
    if (isDraggingVideoDock) return;
    const dockHost = document.getElementById("aegis-video-bottom-dock");
    if (!dockHost) return;

    const expandDir = getEffectiveVideoDockDir();

    // Jika pengguna sudah menggeser posisi Video Dock secara manual, gunakan posisi tersimpan
    // dengan penguncian tepi kiri (left) atau tepi kanan (right) agar saat pil membuka/menutup
    // di pinggir layar tidak pernah terpotong atau bergeser menjauhi pinggir!
    if (hudPositions && hudPositions.videoDock) {
      const rect = dockHost.getBoundingClientRect();
      const elW = Math.max(38, rect.width || 52);
      const elH = Math.max(22, rect.height || 26);
      const resolved = resolveSavedHudCoord(hudPositions.videoDock, elW, elH, 4);
      if (resolved) {
        dockHost.style.top = `${resolved.top}px`;
        dockHost.style.bottom = "auto";
        if (expandDir === "ltr") {
          dockHost.style.left = `${resolved.left}px`;
          dockHost.style.right = "auto";
        } else {
          dockHost.style.right = `${resolved.right}px`;
          dockHost.style.left = "auto";
        }
        return;
      }
    }

    const fsEl = getActiveFullscreenElement();
    if (fsEl) {
      if (expandDir === "ltr") {
        dockHost.style.left = "14px";
        dockHost.style.right = "auto";
      } else {
        dockHost.style.right = "16px";
        dockHost.style.left = "auto";
      }
      dockHost.style.bottom = "56px";
      dockHost.style.top = "auto";
      return;
    }

    if (isMiniPlayerActive) {
      if (expandDir === "ltr") {
        dockHost.style.left = "12px";
        dockHost.style.right = "auto";
      } else {
        dockHost.style.right = "12px";
        dockHost.style.left = "auto";
      }
      dockHost.style.bottom = "12px";
      dockHost.style.top = "auto";
      return;
    }

    const targetEl = findPrimaryVideoElement();
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      const belowVideoTop = rect.bottom + 8;
      const alignRight = Math.max(8, window.innerWidth - rect.right);
      const alignLeft = Math.max(8, rect.left);

      if (belowVideoTop + 44 <= window.innerHeight - 6 && rect.bottom > 40) {
        dockHost.style.top = `${Math.round(belowVideoTop)}px`;
        dockHost.style.bottom = "auto";
      } else {
        const clampedBottom = Math.max(10, window.innerHeight - Math.min(rect.bottom, window.innerHeight) + 12);
        dockHost.style.bottom = `${Math.round(clampedBottom)}px`;
        dockHost.style.top = "auto";
      }

      if (expandDir === "ltr") {
        dockHost.style.left = `${Math.round(alignLeft)}px`;
        dockHost.style.right = "auto";
      } else {
        dockHost.style.right = `${Math.round(alignRight)}px`;
        dockHost.style.left = "auto";
      }
    } else {
      if (expandDir === "ltr") {
        dockHost.style.left = "10px";
        dockHost.style.right = "auto";
      } else {
        dockHost.style.right = "10px";
        dockHost.style.left = "auto";
      }
      dockHost.style.bottom = "16px";
      dockHost.style.top = "auto";
    }
  }

  function updateTopManualHudSavedPosition() {
    if (isDraggingTopHud) return;
    const hostEl = document.getElementById("aegis-top-manual-hud");
    if (!hostEl || !hudPositions || !hudPositions.topHud) return;
    const rect = hostEl.getBoundingClientRect();
    const resolved = resolveSavedHudCoord(hudPositions.topHud, rect.width || 360, rect.height || 130, 6);
    if (resolved) {
      hostEl.style.left = `${resolved.left}px`;
      hostEl.style.top = `${resolved.top}px`;
      hostEl.style.right = "auto";
      hostEl.style.bottom = "auto";
      hostEl.style.transform = "none";
    }
  }

  function scheduleDockPositionSync() {
    if (videoDockPositionRAF) return;
    videoDockPositionRAF = requestAnimationFrame(() => {
      videoDockPositionRAF = null;
      updateFloatingVideoDockPosition();
    });
  }

  window.addEventListener("scroll", scheduleDockPositionSync, { passive: true });
  window.addEventListener("resize", () => {
    scheduleDockPositionSync();
    updateTopManualHudSavedPosition();
    if (isMiniPlayerActive) {
      updateMiniPlayerPosition();
    }
  }, { passive: true });

  ["play", "playing", "pause", "ended", "loadedmetadata"].forEach((evtName) => {
    document.addEventListener(evtName, (e) => {
      if (e.target && e.target.tagName === "VIDEO") {
        if (evtName === "play" || evtName === "playing" || evtName === "loadedmetadata") {
          const src = e.target.currentSrc || e.target.src || "";
          if (src.startsWith("blob:")) registerDetectedVideo(location.href, true);
          else if (src) registerDetectedVideo(src);
        }
        if (window.top === window.self) {
          renderFloatingVideoDock();
        }
      }
    }, true);
  });

  function getActiveVideoTargetUrl() {
    if (detectedVideos.length > 0) {
      return detectedVideos[detectedVideos.length - 1];
    }
    const v = findPrimaryVideoElement();
    if (v) {
      if (v.tagName === "VIDEO") {
        const s = v.currentSrc || v.src || "";
        if (s && !s.startsWith("blob:") && !s.startsWith("data:")) return s;
      } else if (v.tagName === "IFRAME" && v.src) {
        return v.src;
      }
    }
    return location.href;
  }

  // =========================================================================
  // STABLE SINGLE-INSTANCE MINI-PLAYER / PiP (DRAGGABLE & SAVED POSITION)
  // =========================================================================
  function getMiniPlayerSafeTop() {
    const dockHost = document.getElementById("aegis-video-bottom-dock");
    let bottomReserved = 54;
    if (dockHost) {
      const dockRect = dockHost.getBoundingClientRect();
      const isDockBottomRight = dockRect.bottom > window.innerHeight * 0.6 && dockRect.right > window.innerWidth * 0.5;
      if (isDockBottomRight && dockRect.height > 0) {
        bottomReserved = Math.max(54, Math.round(window.innerHeight - dockRect.top + 10));
      }
    } else if (videoDrawerOpen) {
      bottomReserved = 235;
    }
    return Math.max(28, window.innerHeight - miniPlayerPos.height - bottomReserved);
  }

  function renderMiniPlayerDragBar(targetEl) {
    let bar = document.getElementById("aegis-miniplayer-dragbar");
    if (!targetEl || !isMiniPlayerActive) {
      if (bar) bar.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "aegis-miniplayer-dragbar";
      Object.assign(bar.style, {
        position: "fixed",
        height: "22px",
        zIndex: "2147483646",
        background: "rgba(15, 23, 42, 0.94)",
        border: "1px solid rgba(16, 185, 129, 0.65)",
        borderBottom: "none",
        borderRadius: "10px 10px 0 0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 7px",
        color: "#e2e8f0",
        fontSize: "10px",
        fontWeight: "700",
        fontFamily: "system-ui, -apple-system, sans-serif",
        cursor: "grab",
        userSelect: "none",
        touchAction: "none"
      });
      bar.innerHTML = `
        <span style="pointer-events:none; color:#34d399;">⠿ Mini PiP (Geser)</span>
        <div style="display:flex; gap:4px; align-items:center;">
          <button type="button" id="aegisPipResetPosBtn" title="Reset Posisi Tersimpan ke Kanan Bawah" style="background:#1e293b; color:#93c5fd; border:1px solid #334155; border-radius:4px; padding:0 5px; font-size:9px; font-weight:700; cursor:pointer;">↺</button>
          <button type="button" id="aegisPipExitBtn" title="Tutup Mini PiP" style="background:#ef4444; color:#fff; border:none; border-radius:4px; padding:0 5px; font-size:9px; font-weight:700; cursor:pointer;">✕</button>
        </div>
      `;
      (document.body || document.documentElement).appendChild(bar);

      bar.querySelector("#aegisPipResetPosBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        miniPlayerUserMoved = false;
        saveHudPosition("miniPip", null);
        miniPlayerPos.left = Math.max(12, window.innerWidth - miniPlayerPos.width - 12);
        miniPlayerPos.top = getMiniPlayerSafeTop();
        updateMiniPlayerPosition();
      });

      bar.querySelector("#aegisPipExitBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        disableMiniPlayer();
        renderFloatingVideoDock();
      });

      let dragging = false, sx = 0, sy = 0, ol = 0, ot = 0;
      bar.addEventListener("pointerdown", (e) => {
        if (e.target.tagName === "BUTTON") return;
        dragging = true;
        bar.style.cursor = "grabbing";
        try { bar.setPointerCapture(e.pointerId); } catch (err) {}
        sx = e.clientX;
        sy = e.clientY;
        ol = miniPlayerPos.left ?? (window.innerWidth - miniPlayerPos.width - 12);
        ot = miniPlayerPos.top ?? getMiniPlayerSafeTop();
      });
      bar.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        miniPlayerUserMoved = true;
        const clamped = clampHudPosition(
          ol + (e.clientX - sx),
          ot + (e.clientY - sy),
          miniPlayerPos.width,
          miniPlayerPos.height,
          8,
          28
        );
        miniPlayerPos.left = clamped.left;
        miniPlayerPos.top = clamped.top;
        updateMiniPlayerPosition();
      });
      const finishMiniPipDrag = (e) => {
        if (!dragging) return;
        dragging = false;
        bar.style.cursor = "grab";
        try { bar.releasePointerCapture(e.pointerId); } catch (err) {}
        if (miniPlayerUserMoved && typeof miniPlayerPos.left === "number" && typeof miniPlayerPos.top === "number") {
          saveHudPosition(
            "miniPip",
            createSavedHudCoord(miniPlayerPos.left, miniPlayerPos.top, miniPlayerPos.width, miniPlayerPos.height, 8, 28)
          );
        }
      };
      bar.addEventListener("pointerup", finishMiniPipDrag);
      bar.addEventListener("pointercancel", finishMiniPipDrag);
    }

    const pipOpacity = Math.max(
      0.5,
      Math.min(1.0, Number(globalSettings.pipOpacity ?? globalSettings.hudOpacity ?? 0.95))
    );
    bar.style.opacity = String(pipOpacity);
    bar.style.width = `${miniPlayerPos.width}px`;
    bar.style.left = `${miniPlayerPos.left}px`;
    bar.style.top = `${Math.max(4, miniPlayerPos.top - 21)}px`;
  }

  function updateMiniPlayerPosition() {
    const target = document.querySelector(".__aegis_miniplayer_target__");
    if (!target) {
      const bar = document.getElementById("aegis-miniplayer-dragbar");
      if (bar) bar.remove();
      return;
    }

    if (hudPositions && hudPositions.miniPip && !miniPlayerUserMoved) {
      applySavedMiniPipPosition();
    }

    if (miniPlayerPos.left === null || !miniPlayerUserMoved) {
      miniPlayerPos.left = Math.max(12, window.innerWidth - miniPlayerPos.width - 12);
      miniPlayerPos.top = getMiniPlayerSafeTop();
    } else {
      const clamped = clampHudPosition(
        miniPlayerPos.left,
        miniPlayerPos.top,
        miniPlayerPos.width,
        miniPlayerPos.height,
        8,
        28
      );
      miniPlayerPos.left = clamped.left;
      miniPlayerPos.top = clamped.top;
    }

    const pipOpacity = Math.max(
      0.5,
      Math.min(1.0, Number(globalSettings.pipOpacity ?? globalSettings.hudOpacity ?? 0.95))
    );
    target.style.setProperty("left", `${miniPlayerPos.left}px`, "important");
    target.style.setProperty("top", `${miniPlayerPos.top}px`, "important");
    target.style.setProperty("right", "auto", "important");
    target.style.setProperty("bottom", "auto", "important");
    target.style.setProperty("opacity", String(pipOpacity), "important");
    renderMiniPlayerDragBar(target);
  }

  function ensureMiniPlayerStyle() {
    if (miniPlayerStyleEl && document.head.contains(miniPlayerStyleEl)) return;
    miniPlayerStyleEl = document.createElement("style");
    miniPlayerStyleEl.id = "aegis-miniplayer-style";
    miniPlayerStyleEl.textContent = `
      .__aegis_miniplayer_target__ {
        position: fixed !important;
        width: ${miniPlayerPos.width}px !important;
        height: ${miniPlayerPos.height}px !important;
        min-width: ${miniPlayerPos.width}px !important;
        min-height: ${miniPlayerPos.height}px !important;
        max-width: ${miniPlayerPos.width}px !important;
        max-height: ${miniPlayerPos.height}px !important;
        z-index: 2147483645 !important;
        border-radius: 0 0 12px 12px !important;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.78) !important;
        border: 1.5px solid rgba(16, 185, 129, 0.75) !important;
        background: #000 !important;
        object-fit: contain !important;
        overflow: hidden !important;
      }
    `;
    (document.head || document.documentElement).appendChild(miniPlayerStyleEl);
  }

  function disableMiniPlayer() {
    isMiniPlayerActive = false;
    const bar = document.getElementById("aegis-miniplayer-dragbar");
    if (bar) bar.remove();
    document.querySelectorAll(".__aegis_miniplayer_target__").forEach((el) => {
      el.classList.remove("__aegis_miniplayer_target__");
      el.style.removeProperty("left");
      el.style.removeProperty("top");
      el.style.removeProperty("right");
      el.style.removeProperty("bottom");
    });
  }

  async function toggleSmartMinimizeOrPiP() {
    if (pipToggleLock) return;
    pipToggleLock = true;
    setTimeout(() => { pipToggleLock = false; }, 350);

    const activeFs = getActiveFullscreenElement();
    if (activeFs) {
      const vid = activeFs.tagName === "VIDEO" ? activeFs : (activeFs.querySelector && activeFs.querySelector("video"));
      const wasPlaying = vid ? (!vid.paused && !vid.ended) : false;
      const savedTime = vid ? vid.currentTime : 0;

      if (isForcedPortrait) resetPortraitState();
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } catch (e) {}

      if (vid && wasPlaying) {
        setTimeout(() => {
          try {
            if (Math.abs(vid.currentTime - savedTime) > 1.5 && savedTime > 0 && savedTime < vid.duration - 0.5) {
              vid.currentTime = savedTime;
            }
            if (vid.paused) vid.play().catch(() => {});
          } catch (e) {}
        }, 120);
      }
      return;
    }

    if (document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
      } catch (e) {}
      renderFloatingVideoDock();
      return;
    }

    if (isMiniPlayerActive) {
      disableMiniPlayer();
      renderFloatingVideoDock();
      return;
    }

    const primaryVid = findPrimaryVideoElement();
    const vid = (primaryVid && primaryVid.tagName === "VIDEO") ? primaryVid : document.querySelector("video");
    if (vid && document.pictureInPictureEnabled && !vid.disablePictureInPicture && vid.readyState >= 1) {
      try {
        await vid.requestPictureInPicture();
        renderFloatingVideoDock();
        return;
      } catch (e) {}
    }

    const target = findPrimaryVideoElement();
    if (target) {
      disableMiniPlayer();
      ensureMiniPlayerStyle();
      target.classList.add("__aegis_miniplayer_target__");
      isMiniPlayerActive = true;
      applySavedMiniPipPosition();
      if (!miniPlayerUserMoved || miniPlayerPos.left === null) {
        miniPlayerPos.left = Math.max(12, window.innerWidth - miniPlayerPos.width - 12);
        miniPlayerPos.top = getMiniPlayerSafeTop();
      }
      if (target.tagName === "VIDEO" && target.paused && target.readyState >= 2) {
        target.play().catch(() => {});
      }
      renderFloatingVideoDock();
      updateMiniPlayerPosition();
    }
  }

  function renderFloatingVideoDock() {
    if (window.top !== window.self) return;

    clearTimeout(videoDockDimTimer);
    const primaryVideo = findPrimaryVideoElement();
    const totalVideoCount = detectedVideos.length > 0 ? detectedVideos.length : (primaryVideo ? 1 : 0);
    const hasVideo = totalVideoCount > 0;

    const existingDock = document.getElementById("aegis-video-bottom-dock");

    if (!hasVideo || globalSettings.videoDockEnabled === false) {
      videoDrawerOpen = false;
      videoDockManualExpanded = false;
      videoDockInteractionPaused = false;
      if (!hasVideo && isMiniPlayerActive) disableMiniPlayer();
      if (existingDock) existingDock.remove();
      return;
    }

    if (existingDock) existingDock.remove();

    const fsEl = getActiveFullscreenElement();
    const mountParent = fsEl || document.body || document.documentElement;

    const expandDir = getEffectiveVideoDockDir(); // "ltr" (buka kiri->kanan) atau "rtl" (buka kanan->kiri)
    const isTopHalf = Boolean(
      hudPositions &&
      hudPositions.videoDock &&
      typeof hudPositions.videoDock.top === "number" &&
      hudPositions.videoDock.top < 200
    );

    const dockHost = document.createElement("div");
    dockHost.id = "aegis-video-bottom-dock";
    Object.assign(dockHost.style, {
      position: "fixed",
      right: expandDir === "rtl" ? "10px" : "auto",
      left: expandDir === "ltr" ? "10px" : "auto",
      bottom: "16px",
      zIndex: "2147483647",
      pointerEvents: "auto",
      maxWidth: "min(360px, calc(100vw - 12px))",
      touchAction: "none"
    });

    const shadow = dockHost.attachShadow({ mode: "closed" });
    const directVidEl = primaryVideo && primaryVideo.tagName === "VIDEO" ? primaryVideo : document.querySelector("video");
    const canToggleDirectPlay = Boolean(directVidEl);
    const isDirectPaused = directVidEl ? directVidEl.paused : true;
    const isPipOrMiniActive = isMiniPlayerActive || Boolean(document.pictureInPictureElement);
    const hasCustomDockPos = Boolean(hudPositions && hudPositions.videoDock);

    const videoPillOpacity = Math.max(
      0.5,
      Math.min(1.0, Number(globalSettings.videoPillOpacity ?? globalSettings.hudOpacity ?? 0.95))
    );
    const videoPillScale = Math.max(0.75, Math.min(1.35, Number(globalSettings.videoPillScale ?? 1.0)));
    const showPlayPause = globalSettings.videoPillShowPlayPause !== false && canToggleDirectPlay;
    const showList = globalSettings.videoPillShowList !== false;
    const showDownload = globalSettings.videoPillShowDownload !== false;
    const showPip = globalSettings.videoPillShowPip !== false;
    const showFullscreen = globalSettings.videoPillShowFullscreen !== false;

    const videoListHtml = detectedVideos.length > 0
      ? detectedVideos.map((vUrl, i) => {
          let label = vUrl;
          try {
            const u = new URL(vUrl);
            const parts = u.pathname.split("/").filter(Boolean);
            label = (parts[parts.length - 1] || u.hostname) + (u.search ? u.search.slice(0, 18) : "");
          } catch (e) {}
          return `
            <div class="vid-row">
              <span class="vid-name" title="${escapeHtml(vUrl)}">${i + 1}. ${escapeHtml(label)}</span>
              <div class="vid-actions">
                <button class="btn-vid-act btn-vid-tab" data-vid-tab="${escapeHtml(vUrl)}" title="Buka di tab baru dalam grup">Tab Grup ↗</button>
                <button class="btn-vid-act btn-vid-here" data-vid-here="${escapeHtml(vUrl)}" title="Putar langsung di tab ini">Buka</button>
              </div>
            </div>
          `;
        }).join("")
      : `<div class="vid-empty">Stream terdeteksi dari pemutar aktif di halaman ini.</div>`;

    shadow.innerHTML = `
      <style>
        * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
        .dock-wrap {
          display: flex;
          flex-direction: ${isTopHalf ? "column-reverse" : "column"};
          align-items: ${expandDir === "ltr" ? "flex-start" : "flex-end"};
          gap: 6px;
          opacity: ${videoPillOpacity};
          transform: scale(${videoPillScale});
          transform-origin: ${isTopHalf ? "top" : "bottom"} ${expandDir === "ltr" ? "left" : "right"};
        }
        .vid-drawer {
          display: ${videoDrawerOpen ? "block" : "none"};
          width: min(340px, calc(100vw - 16px));
          background: rgba(15, 23, 42, 0.96);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-radius: 14px;
          padding: 8px 10px;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.65);
          color: #f8fafc;
        }
        .drawer-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          padding-bottom: 6px;
          margin-bottom: 6px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
          font-size: 10.5px;
          cursor: grab;
          user-select: none;
          touch-action: none;
        }
        .drawer-head:active { cursor: grabbing; }
        .skip-pill {
          color: ${autoSkipCountdown ? "#34d399" : "#94a3b8"};
          font-weight: 700;
        }
        .vid-scroll {
          max-height: 135px;
          overflow-y: auto;
        }
        .vid-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          padding: 4px 0;
          border-bottom: 1px solid rgba(30, 41, 59, 0.8);
        }
        .vid-row:last-child { border-bottom: none; }
        .vid-name {
          font-size: 10.5px;
          color: #e2e8f0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
        }
        .vid-actions {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        .btn-vid-act {
          border: none;
          border-radius: 6px;
          padding: 3px 7px;
          font-size: 9.5px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }
        .btn-vid-act:active { transform: scale(0.95); }
        .btn-vid-here { background: #0284c7; color: #f0f9ff; }
        .btn-vid-tab { background: #334155; color: #f8fafc; border: 1px solid #475569; }
        .vid-empty { font-size: 10px; color: #94a3b8; padding: 2px 0; }

        .floating-pill {
          display: inline-flex;
          flex-direction: ${expandDir === "rtl" ? "row-reverse" : "row"};
          transform-origin: ${expandDir === "rtl" ? "right center" : "left center"};
          align-items: center;
          gap: 4px;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid ${hasCustomDockPos ? "rgba(52, 211, 153, 0.45)" : "rgba(255, 255, 255, 0.18)"};
          border-radius: 999px;
          padding: 5px 9px;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
          transition: opacity 0.25s ease, transform 0.18s ease, background 0.18s ease, padding 0.18s ease;
          user-select: none;
          touch-action: none;
        }
        .dim-compact-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          color: #34d399;
          background: rgba(16, 185, 129, 0.18);
          border-radius: 999px;
          padding: 4px 10px;
          letter-spacing: 0.2px;
          white-space: nowrap;
          cursor: pointer;
          user-select: none;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .dim-compact-badge:hover {
          background: rgba(16, 185, 129, 0.28);
        }
        .floating-pill.auto-dimmed {
          padding: 6px 12px;
          background: rgba(15, 23, 42, 0.92);
          border-color: rgba(56, 189, 248, 0.45);
          cursor: pointer;
        }
        .floating-pill.auto-dimmed .dim-compact-badge {
          background: transparent;
          color: #f8fafc;
          padding: 0;
          font-size: 12px;
        }
        .floating-pill.auto-dimmed .pill-btn {
          display: none !important;
        }
        .floating-pill:not(.auto-dimmed):hover,
        .floating-pill:not(.auto-dimmed):active,
        .dock-wrap.drawer-open .floating-pill {
          transform: scale(1) !important;
          padding: 5px 9px !important;
          background: rgba(15, 23, 42, 0.96) !important;
        }
        .floating-pill:not(.auto-dimmed) .pill-btn,
        .dock-wrap.drawer-open .floating-pill .pill-btn {
          display: inline-flex !important;
        }
        .pill-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 30px;
          border: none;
          background: transparent;
          color: #f8fafc;
          border-radius: 999px;
          cursor: pointer;
          padding: 0;
          transition: background 0.15s ease, transform 0.12s ease, color 0.15s ease;
        }
        .pill-btn:hover {
          background: rgba(255, 255, 255, 0.14);
        }
        .pill-btn:active {
          transform: scale(0.92);
        }
        .pill-btn.active {
          color: #34d399;
          background: rgba(16, 185, 129, 0.18);
        }
        .pill-btn.reset-dock-btn,
        .pill-btn.dir-dock-btn {
          width: 24px;
          height: 24px;
          font-size: 11px;
          font-weight: 700;
          color: #93c5fd;
        }
        .pill-btn svg {
          width: 17px;
          height: 17px;
          stroke: currentColor;
          fill: none;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .count-badge {
          position: absolute;
          top: 1px;
          right: 1px;
          min-width: 14px;
          height: 14px;
          padding: 0 3px;
          border-radius: 999px;
          background: #10b981;
          color: #022c22;
          font-size: 9px;
          font-weight: 800;
          line-height: 14px;
          text-align: center;
        }
      </style>
      <div class="dock-wrap ${videoDrawerOpen ? "drawer-open" : ""}">
        <div class="vid-drawer">
          <div class="drawer-head" id="vidDrawerHead" title="Geser untuk memindahkan posisi Dock Video">
            <span class="skip-pill">⠿ ${autoSkipCountdown ? `⚡ Auto-Skip 5–30d AKTIF${autoSkipTriggeredCount > 0 ? ` (${autoSkipTriggeredCount}×)` : ""}` : "⏸️ Auto-Skip OFF"}</span>
            <div style="display:flex; align-items:center; gap:4px;">
              <span style="color:#94a3b8;">${detectedVideos.length} Stream</span>
              <button class="pill-btn dir-dock-btn" id="drawerDirToggleBtn" title="Ubah Arah Buka Pil (${expandDir === "ltr" ? "Kiri → Kanan" : "Kanan ← Kiri"})">${expandDir === "ltr" ? "→" : "←"}</button>
              ${hasCustomDockPos ? `<button class="pill-btn reset-dock-btn" id="drawerResetPosBtn" title="Reset posisi Dock Video ke Auto-Anchor">↺</button>` : ""}
            </div>
          </div>
          <div class="vid-scroll">${videoListHtml}</div>
        </div>

        <div class="floating-pill ${(!videoDockManualExpanded && !videoDrawerOpen) ? "auto-dimmed" : ""}" id="aegisVideoPill" title="Tekan untuk membuka/menutup kontrol video (${totalVideoCount}) · Geser untuk memindahkan">
          <span class="dim-compact-badge" id="dimCompactBadge" title="Tekan untuk membuka/melipat pil video · Geser untuk memindahkan">🎬(${totalVideoCount})</span>
          ${showPlayPause ? `
          <button class="pill-btn ${!isDirectPaused ? "active" : ""}" id="pillPlayPauseBtn" title="${isDirectPaused ? "Putar Video (Play)" : "Jeda Video (Pause)"}">
            ${isDirectPaused
              ? `<svg viewBox="0 0 24 24"><polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none"/></svg>`
              : `<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/></svg>`}
          </button>
          ` : ""}

          ${showList ? `
          <button class="pill-btn ${videoDrawerOpen ? "active" : ""}" id="pillListBtn" title="Daftar Stream Video (${detectedVideos.length})">
            <svg viewBox="0 0 24 24">
              <path d="M5 4h14"/>
              <path d="M4 7h16"/>
              <rect x="3" y="10" width="18" height="10" rx="2"/>
              <path d="M12 13v4"/>
              <path d="M10 15h4"/>
            </svg>
            ${detectedVideos.length > 0 ? `<span class="count-badge">${detectedVideos.length}</span>` : ""}
          </button>
          ` : ""}

          ${showDownload ? `
          <button class="pill-btn" id="pillDownloadBtn" title="Buka / Unduh Stream Video Langsung">
            <svg viewBox="0 0 24 24">
              <path d="M12 4v11"/>
              <path d="M8 11l4 4 4-4"/>
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
            </svg>
          </button>
          ` : ""}

          ${showPip ? `
          <button class="pill-btn ${isPipOrMiniActive ? "active" : ""}" id="pillPipBtn" title="${fsEl ? "Keluar Layar Penuh (Minimize)" : (isPipOrMiniActive ? "Tutup PiP / Kembalikan Ukuran" : "Picture-in-Picture (Posisi Tersimpan)")}">
            <svg viewBox="0 0 24 24">
              <path d="M4 4l5 5"/>
              <path d="M9 5v4H5"/>
              <path d="M13 5h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4"/>
              <rect x="13" y="13" width="6" height="4" rx="1" fill="currentColor" stroke="none"/>
            </svg>
          </button>
          ` : ""}

          ${showFullscreen ? `
          <button class="pill-btn ${isForcedPortrait ? "active" : ""}" id="pillFullscreenBtn" title="${fsEl ? (isLandscapeViewport() || isForcedPortrait ? "Putar Potret / Keluar Fullscreen" : "Keluar Fullscreen") : "Layar Penuh (Fullscreen)"}">
            <svg viewBox="0 0 24 24">
              <path d="M4 9V5a1 1 0 0 1 1-1h4"/>
              <path d="M20 9V5a1 1 0 0 0-1-1h-4"/>
              <path d="M4 15v4a1 1 0 0 0 1 1h4"/>
              <path d="M20 15v4a1 1 0 0 1-1 1h-4"/>
            </svg>
          </button>
          ` : ""}
        </div>
      </div>
    `;

    const pillEl = shadow.getElementById("aegisVideoPill");
    const dimBadgeEl = shadow.getElementById("dimCompactBadge");
    const drawerHeadEl = shadow.getElementById("vidDrawerHead");
    let suppressNextDockClick = false;

    const configuredDimMs = Math.max(0, Number(globalSettings.videoDockDimSec ?? 2.5) * 1000);
    const effectiveDimMs = configuredDimMs > 0 ? configuredDimMs : 2500;
    const scheduleDockDim = (delayMs = effectiveDimMs) => {
      clearTimeout(videoDockDimTimer);
      if (configuredDimMs <= 0 || delayMs <= 0) return;
      if (!videoDockManualExpanded || videoDrawerOpen || videoDockInteractionPaused || isDraggingVideoDock) return;
      videoDockDimTimer = setTimeout(() => {
        if (!videoDockManualExpanded || videoDrawerOpen || videoDockInteractionPaused || isDraggingVideoDock) return;
        videoDockManualExpanded = false;
        if (pillEl) pillEl.classList.add("auto-dimmed");
        requestAnimationFrame(updateFloatingVideoDockPosition);
      }, delayMs);
    };

    const wakePill = () => {
      videoDockManualExpanded = true;
      if (pillEl) pillEl.classList.remove("auto-dimmed");
      clearTimeout(videoDockDimTimer);
      requestAnimationFrame(updateFloatingVideoDockPosition);
    };

    const collapsePill = () => {
      videoDockManualExpanded = false;
      videoDrawerOpen = false;
      clearTimeout(videoDockDimTimer);
      if (pillEl) pillEl.classList.add("auto-dimmed");
      renderFloatingVideoDock();
    };

    // Universal Drag Handler untuk Video Dock (Pointer Capture pada handleEl — tanpa leak listener di window)
    let lastPointerDownOnBadge = false;

    const attachVideoDockDrag = (handleEl) => {
      if (!handleEl) return;
      let pointerActive = false;
      let dragMoved = false;
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let startTop = 0;

      handleEl.addEventListener("pointerdown", (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        if (e.target && e.target.closest && e.target.closest("button")) return;
        lastPointerDownOnBadge = Boolean(
          e.target && e.target.closest && e.target.closest("#dimCompactBadge")
        );
        const rect = dockHost.getBoundingClientRect();
        pointerActive = true;
        dragMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = rect.left;
        startTop = rect.top;
        clearTimeout(videoDockDimTimer);
        try {
          handleEl.setPointerCapture(e.pointerId);
        } catch (err) {}
      });

      handleEl.addEventListener("pointermove", (e) => {
        if (!pointerActive) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!dragMoved && Math.hypot(dx, dy) >= 5) {
          dragMoved = true;
          isDraggingVideoDock = true;
          suppressNextDockClick = true;
        }
        if (dragMoved) {
          const rect = dockHost.getBoundingClientRect();
          const clamped = clampHudPosition(
            startLeft + dx,
            startTop + dy,
            rect.width || 68,
            rect.height || 34,
            4
          );
          dockHost.style.left = `${clamped.left}px`;
          dockHost.style.top = `${clamped.top}px`;
          dockHost.style.right = "auto";
          dockHost.style.bottom = "auto";
        }
      });

      const endDockDrag = (e) => {
        if (!pointerActive) return;
        pointerActive = false;
        try {
          handleEl.releasePointerCapture(e.pointerId);
        } catch (err) {}
        if (dragMoved) {
          isDraggingVideoDock = false;
          const rect = dockHost.getBoundingClientRect();
          const newCoord = createSavedHudCoord(rect.left, rect.top, rect.width || 68, rect.height || 34, 4);
          saveHudPosition("videoDock", newCoord);
          if (
            (globalSettings.videoDockExpandDir === "ltr" && newCoord.anchorSide === "right") ||
            (globalSettings.videoDockExpandDir === "rtl" && newCoord.anchorSide === "left")
          ) {
            globalSettings = { ...globalSettings, videoDockExpandDir: "auto" };
            try { chrome.storage.local.set({ globalSettings }); } catch (err) {}
          }
          setTimeout(() => { suppressNextDockClick = false; }, 80);
          renderFloatingVideoDock();
        }
      };

      handleEl.addEventListener("pointerup", endDockDrag);
      handleEl.addEventListener("pointercancel", endDockDrag);
    };

    attachVideoDockDrag(pillEl);
    attachVideoDockDrag(drawerHeadEl);

    const handleToggleVideoDockDirection = (e) => {
      e.stopPropagation();
      if (suppressNextDockClick) return;
      const nextDir = expandDir === "ltr" ? "rtl" : "ltr";
      globalSettings = { ...globalSettings, videoDockExpandDir: nextDir };
      if (hudPositions && hudPositions.videoDock) {
        const vw = window.innerWidth || 360;
        const rect = dockHost.getBoundingClientRect();
        const curW = rect.width || 68;
        const updatedCoord = {
          ...hudPositions.videoDock,
          anchorSide: nextDir === "ltr" ? "left" : "right",
          left: Math.round(rect.left),
          rightOffset: Math.round(Math.max(4, vw - (rect.left + curW)))
        };
        saveHudPosition("videoDock", updatedCoord);
      }
      try {
        chrome.storage.local.set({ globalSettings });
      } catch (err) {}
      renderFloatingVideoDock();
    };

    const drawerDirToggleBtn = shadow.getElementById("drawerDirToggleBtn");
    if (drawerDirToggleBtn) drawerDirToggleBtn.addEventListener("click", handleToggleVideoDockDirection);

    const handleResetVideoDockPos = (e) => {
      e.stopPropagation();
      if (suppressNextDockClick) return;
      saveHudPosition("videoDock", null);
      renderFloatingVideoDock();
    };

    const drawerResetPosBtn = shadow.getElementById("drawerResetPosBtn");
    if (drawerResetPosBtn) drawerResetPosBtn.addEventListener("click", handleResetVideoDockPos);

    if (pillEl) {
      pillEl.addEventListener("click", (e) => {
        if (suppressNextDockClick) {
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        if (pillEl.classList.contains("auto-dimmed")) {
          e.stopPropagation();
          e.preventDefault();
          wakePill();
          scheduleDockDim(Math.max(effectiveDimMs, 4000));
          return;
        }
        if (lastPointerDownOnBadge) {
          lastPointerDownOnBadge = false;
          e.stopPropagation();
          e.preventDefault();
          collapsePill();
        }
      }, true);
    }

    if (dimBadgeEl) {
      dimBadgeEl.addEventListener("click", (e) => {
        if (suppressNextDockClick) return;
        if (pillEl && !pillEl.classList.contains("auto-dimmed")) {
          lastPointerDownOnBadge = false;
          e.stopPropagation();
          e.preventDefault();
          collapsePill();
        }
      });
    }

    const playPauseBtn = shadow.getElementById("pillPlayPauseBtn");
    if (playPauseBtn && directVidEl) {
      playPauseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (suppressNextDockClick) return;
        wakePill();
        try {
          if (directVidEl.paused) {
            directVidEl.style.visibility = "visible";
            directVidEl.style.opacity = "1";
            directVidEl.play().catch(() => {});
          } else {
            directVidEl.pause();
          }
        } catch (err) {}
        setTimeout(renderFloatingVideoDock, 100);
      });
    }

    const listBtn = shadow.getElementById("pillListBtn");
    if (listBtn) {
      listBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (suppressNextDockClick) return;
        scanDomForVideos();
        videoDrawerOpen = !videoDrawerOpen;
        if (videoDrawerOpen) {
          videoDockManualExpanded = true;
          previewOpen = false;
        }
        renderFloatingVideoDock();
        if (isMiniPlayerActive) {
          requestAnimationFrame(updateMiniPlayerPosition);
        }
        if (isRenderingHud) renderTopManualHUD();
      });
    }

    const dlBtn = shadow.getElementById("pillDownloadBtn");
    if (dlBtn) {
      dlBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (suppressNextDockClick) return;
        wakePill();
        const targetStream = getActiveVideoTargetUrl();
        if (targetStream) {
          chrome.runtime.sendMessage({ type: "OPEN_FOREGROUND_TAB", url: targetStream });
        }
        scheduleDockDim(configuredDimMs);
      });
    }

    const pipBtn = shadow.getElementById("pillPipBtn");
    if (pipBtn) {
      pipBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (suppressNextDockClick) return;
        wakePill();
        await toggleSmartMinimizeOrPiP();
        scheduleDockDim(configuredDimMs);
      });
    }

    const fsBtn = shadow.getElementById("pillFullscreenBtn");
    if (fsBtn) {
      fsBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (suppressNextDockClick) return;
        wakePill();
        if (isMiniPlayerActive) disableMiniPlayer();
        const activeFs = getActiveFullscreenElement();
        if (activeFs) {
          if (isLandscapeViewport() && !isForcedPortrait) {
            await togglePortraitFullscreen();
          } else {
            if (isForcedPortrait) resetPortraitState();
            try {
              if (document.exitFullscreen) await document.exitFullscreen();
              else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            } catch (err) {}
          }
        } else {
          const target = findPrimaryVideoElement();
          if (target) {
            try {
              if (target.requestFullscreen) await target.requestFullscreen();
              else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
              else if (target.webkitEnterFullscreen) target.webkitEnterFullscreen();
            } catch (err) {}
          }
        }
        scheduleDockDim(configuredDimMs);
      });
    }

    shadow.querySelectorAll(".btn-vid-here").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const vUrl = btn.getAttribute("data-vid-here");
        if (vUrl) {
          promptQueue.length = 0;
          previewOpen = false;
          videoDrawerOpen = false;
          renderTopManualHUD();
          renderFloatingVideoDock();
          chrome.runtime.sendMessage({ type: "NAVIGATE_CURRENT_TAB", url: vUrl });
        }
      });
    });

    shadow.querySelectorAll(".btn-vid-tab").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const vUrl = btn.getAttribute("data-vid-tab");
        if (vUrl) {
          chrome.runtime.sendMessage({ type: "OPEN_GROUP_TAB", url: vUrl });
        }
      });
    });

    if (pillEl) {
      pillEl.addEventListener("mouseenter", () => {
        if (pillEl.classList.contains("auto-dimmed")) return;
        videoDockInteractionPaused = true;
        clearTimeout(videoDockDimTimer);
      });
      pillEl.addEventListener("mouseleave", () => {
        if (pillEl.classList.contains("auto-dimmed")) return;
        videoDockInteractionPaused = false;
        scheduleDockDim(2200);
      });
      pillEl.addEventListener("touchstart", () => {
        if (pillEl.classList.contains("auto-dimmed")) return;
        videoDockInteractionPaused = true;
        clearTimeout(videoDockDimTimer);
      }, { passive: true });
      pillEl.addEventListener("touchend", () => {
        if (pillEl.classList.contains("auto-dimmed")) return;
        videoDockInteractionPaused = false;
        scheduleDockDim(effectiveDimMs);
      }, { passive: true });
    }

    mountParent.appendChild(dockHost);
    updateFloatingVideoDockPosition();
    if (isMiniPlayerActive) {
      updateMiniPlayerPosition();
    }
    if (videoDockManualExpanded && !videoDrawerOpen) {
      scheduleDockDim(configuredDimMs);
    }
  }

  // =========================================================================
  // HUD KONFIRMASI REDIRECT / POPUP (DRAGGABLE & TUKAR POSISI TAB GRUP / BUKA)
  // =========================================================================
  function renderTopManualHUD() {
    if (window.top !== window.self) return;

    clearTimeout(hudAutoCloseTimer);
    purgeBlacklistedOrTrustedPrompts();
    const existing = document.getElementById("aegis-top-manual-hud");

    const hasPrompt = promptQueue.length > 0;

    if (!hasPrompt || globalSettings.hudEnabled === false) {
      if (globalSettings.hudEnabled === false) promptQueue.length = 0;
      isRenderingHud = false;
      previewOpen = false;
      hudInteractionPaused = false;
      if (existing) existing.remove();
      return;
    }

    isRenderingHud = true;

    const currentItem = promptQueue[0];
    const queueCount = promptQueue.length;

    let displayHost = currentItem.blockedUrl;
    try {
      if (currentItem.blockedUrl.startsWith("http")) {
        displayHost = new URL(currentItem.blockedUrl).hostname.replace(/^www\./, "");
      }
    } catch (e) {}

    if (existing) existing.remove();

    const hudDurSec = Math.max(0, Number(globalSettings.hudDurationSec ?? 4.5));
    const hudPos = globalSettings.hudPosition || "top-center";
    const hudOpacity = Math.max(0.5, Math.min(1.0, Number(globalSettings.hudOpacity ?? 0.95)));
    const hudScale = Math.max(0.75, Math.min(1.30, Number(globalSettings.hudScale ?? 1.0)));
    const hasCustomTopHudPos = Boolean(hudPositions && hudPositions.topHud);

    const showTrust = globalSettings.hudShowTrust !== false;
    const showGroup = globalSettings.hudShowGroup !== false;
    const showOpen = globalSettings.hudShowOpen !== false;
    const showBlock = globalSettings.hudShowBlock !== false;
    const showUrlDetail = globalSettings.hudShowUrlDetail !== false;
    const visibleActCount = [showTrust, showGroup, showOpen, showBlock].filter(Boolean).length;

    const presetPosStyles = {
      "top-center": { top: "12px", bottom: "auto", left: "50%", right: "auto", transform: "translateX(-50%)" },
      "top-left": { top: "12px", bottom: "auto", left: "12px", right: "auto", transform: "none" },
      "top-right": { top: "12px", bottom: "auto", left: "auto", right: "12px", transform: "none" },
      "bottom-center": { top: "auto", bottom: document.getElementById("aegis-video-bottom-dock") ? "64px" : "16px", left: "50%", right: "auto", transform: "translateX(-50%)" }
    }[hudPos] || { top: "12px", bottom: "auto", left: "50%", right: "auto", transform: "translateX(-50%)" };

    const hostEl = document.createElement("div");
    hostEl.id = "aegis-top-manual-hud";
    Object.assign(hostEl.style, {
      position: "fixed",
      ...presetPosStyles,
      zIndex: "2147483647",
      width: "calc(100% - 24px)",
      maxWidth: "440px",
      pointerEvents: "auto",
      opacity: String(hudOpacity),
      transition: "opacity 0.25s ease",
      touchAction: "none"
    });

    const shadow = hostEl.attachShadow({ mode: "closed" });

    shadow.innerHTML = `
      <style>
        * { box-sizing: border-box; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .card {
          background: rgba(15, 23, 42, 0.96);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          color: #f8fafc;
          border: 1px solid rgba(52, 211, 153, 0.38);
          border-radius: 14px;
          padding: 10px 12px 9px;
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(15, 23, 42, 0.8);
          font-size: 11.5px;
          transform: scale(${hudScale});
          transform-origin: top center;
        }
        .header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 6px;
          cursor: grab;
          user-select: none;
          touch-action: none;
        }
        .header-row:active {
          cursor: grabbing;
        }
        .status-group {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }
        .hud-drag-grip {
          color: ${hasCustomTopHudPos ? "#34d399" : "#94a3b8"};
          font-size: 12px;
          font-weight: 700;
          cursor: grab;
          user-select: none;
        }
        .shield-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
          flex-shrink: 0;
        }
        .title {
          font-weight: 700;
          color: #e2e8f0;
          font-size: 11.5px;
          white-space: nowrap;
        }
        .queue-pill {
          background: rgba(56, 189, 248, 0.14);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.35);
          border-radius: 999px;
          padding: 1px 7px;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }
        .head-actions {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        .reset-pos-btn,
        .close-x {
          background: rgba(148, 163, 184, 0.14);
          color: #94a3b8;
          border: none;
          border-radius: 999px;
          width: 22px;
          height: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s;
        }
        .reset-pos-btn {
          color: #93c5fd;
        }
        .reset-pos-btn:hover {
          background: rgba(56, 189, 248, 0.24);
          color: #e0f2fe;
        }
        .close-x:hover {
          background: rgba(239, 68, 68, 0.25);
          color: #fca5a5;
        }
        .target-box {
          display: ${showUrlDetail ? "flex" : "none"};
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          background: rgba(2, 6, 23, 0.65);
          border: 1px solid rgba(51, 65, 85, 0.7);
          border-radius: 8px;
          padding: 5px 8px;
          margin-bottom: 8px;
        }
        .target-domain {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
          font-weight: 600;
          color: #f8fafc;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }
        .url-toggle {
          background: transparent;
          border: none;
          color: #38bdf8;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          padding: 2px 4px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .url-toggle:hover {
          text-decoration: underline;
        }
        .action-grid {
          display: ${visibleActCount > 0 ? "grid" : "none"};
          grid-template-columns: repeat(${Math.max(1, visibleActCount)}, 1fr);
          gap: 5px;
        }
        .act-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 3px;
          border: none;
          border-radius: 8px;
          padding: 7px 4px;
          font-size: 10.5px;
          font-weight: 700;
          cursor: pointer;
          text-align: center;
          white-space: nowrap;
          transition: transform 0.1s ease, filter 0.15s ease;
        }
        .act-btn:hover { filter: brightness(1.08); }
        .act-btn:active { transform: scale(0.96); }
        .btn-trust {
          background: #10b981;
          color: #022c22;
        }
        .btn-redirect {
          background: #0284c7;
          color: #f0f9ff;
        }
        .btn-group {
          background: #334155;
          color: #f8fafc;
          border: 1px solid #475569;
        }
        .btn-block {
          background: rgba(185, 28, 28, 0.28);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.55);
        }
        .preview-box {
          display: ${showUrlDetail && previewOpen ? "block" : "none"};
          background: #020617;
          border: 1px solid #1e293b;
          border-radius: 8px;
          padding: 6px 8px;
          margin-top: 7px;
          font-family: ui-monospace, monospace;
          font-size: 10px;
          color: #93c5fd;
          word-break: break-all;
          max-height: 64px;
          overflow-y: auto;
        }
        .progress-track {
          height: 2.5px;
          background: rgba(51, 65, 85, 0.5);
          border-radius: 999px;
          overflow: hidden;
          margin-top: 8px;
          display: ${hudDurSec > 0 ? "block" : "none"};
        }
        .auto-bar {
          height: 100%;
          background: linear-gradient(90deg, #10b981, #38bdf8);
          width: 100%;
          transform-origin: left;
          animation: aegisShrink45s ${hudDurSec > 0 ? hudDurSec : 4.5}s linear forwards;
        }
        .card:hover .auto-bar,
        .auto-bar.paused {
          animation-play-state: paused;
        }
        @keyframes aegisShrink45s {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      </style>
      <div class="card" id="hudMainBar">
        <div class="header-row" id="hudDragHeader" title="Geser untuk memindahkan posisi HUD (Tersimpan otomatis)">
          <div class="status-group">
            <span class="hud-drag-grip">⠿</span>
            <span class="shield-dot"></span>
            <span class="title">${escapeHtml(currentItem.message)}</span>
            ${queueCount > 1 ? `<span class="queue-pill">1 dari ${queueCount}</span>` : ""}
          </div>
          <div class="head-actions">
            ${hasCustomTopHudPos ? `<button class="reset-pos-btn" data-act="reset-pos" title="Reset posisi HUD ke preset">↺</button>` : ""}
            <button class="close-x" data-act="no" title="Abaikan & Tutup">✕</button>
          </div>
        </div>

        <div class="target-box">
          <span class="target-domain" title="${escapeHtml(currentItem.blockedUrl)}">${escapeHtml(displayHost)}</span>
          <button class="url-toggle" data-act="preview">${previewOpen ? "Sembunyikan URL ▲" : "Detail URL ▼"}</button>
        </div>

        <div class="action-grid">
          ${showTrust ? `<button class="act-btn btn-trust" data-act="trust" title="Simpan ke Whitelist & buka sekarang">✓ Trust</button>` : ""}
          ${showGroup ? `<button class="act-btn btn-group" data-act="group" title="Buka di tab baru dalam grup">⊞ Tab Grup</button>` : ""}
          ${showOpen ? `<button class="act-btn btn-redirect" data-act="redirect" title="Buka sekali di tab ini">↗ Buka</button>` : ""}
          ${showBlock ? `<button class="act-btn btn-block" data-act="blacklist" title="Blokir domain ini secara permanen">🚫 Blokir</button>` : ""}
        </div>

        <div class="preview-box">${escapeHtml(currentItem.blockedUrl)}</div>
        <div class="progress-track">
          <div class="auto-bar ${previewOpen ? "paused" : ""}" id="autoProgressBar"></div>
        </div>
      </div>
    `;

    shadow.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const act = btn.getAttribute("data-act");

        if (act === "reset-pos") {
          saveHudPosition("topHud", null);
          renderTopManualHUD();
          return;
        }

        if (act === "preview") {
          previewOpen = !previewOpen;
          renderTopManualHUD();
          return;
        }

        const resolvedItem = promptQueue.shift();
        previewOpen = false;

        if (resolvedItem) {
          if (act === "trust") {
            addDomainToWhitelist(resolvedItem.blockedUrl, (trustedBase) => {
              for (let i = promptQueue.length - 1; i >= 0; i--) {
                try {
                  const h = getBaseDomain(new URL(promptQueue[i].blockedUrl).hostname.toLowerCase());
                  if (h === trustedBase) promptQueue.splice(i, 1);
                } catch (err) {}
              }
              chrome.runtime.sendMessage({
                type: "NAVIGATE_CURRENT_TAB",
                url: resolvedItem.blockedUrl
              });
              promptQueue.length = 0;
              renderTopManualHUD();
            });
            return;
          }

          if (act === "redirect") {
            chrome.runtime.sendMessage({
              type: "NAVIGATE_CURRENT_TAB",
              url: resolvedItem.blockedUrl
            });
            promptQueue.length = 0;
            renderTopManualHUD();
            return;
          }

          if (act === "group") {
            chrome.runtime.sendMessage({
              type: "OPEN_GROUP_TAB",
              url: resolvedItem.blockedUrl
            });
          }

          if (act === "blacklist") {
            addDomainToBlacklist(resolvedItem.blockedUrl, (blockedBase) => {
              for (let i = promptQueue.length - 1; i >= 0; i--) {
                try {
                  const h = getBaseDomain(new URL(promptQueue[i].blockedUrl).hostname.toLowerCase());
                  if (h === blockedBase) promptQueue.splice(i, 1);
                } catch (err) {}
              }
              renderTopManualHUD();
            });
            return;
          }
        }

        renderTopManualHUD();
      });
    });

    const barEl = shadow.querySelector(".card");
    const dragHeaderEl = shadow.getElementById("hudDragHeader");
    const autoBarEl = shadow.getElementById("autoProgressBar");

    const hudDurMs = hudDurSec * 1000;
    const scheduleAutoClosePrompt = (delayMs = hudDurMs) => {
      clearTimeout(hudAutoCloseTimer);
      if (hudDurMs <= 0 || delayMs <= 0) return;
      if (!hasPrompt || hudInteractionPaused || previewOpen || isDraggingTopHud) return;
      hudAutoCloseTimer = setTimeout(() => {
        if (!hasPrompt || hudInteractionPaused || previewOpen || isDraggingTopHud) return;
        promptQueue.shift();
        previewOpen = false;
        renderTopManualHUD();
      }, delayMs);
    };

    // Drag & Drop untuk Top Manual HUD
    if (dragHeaderEl) {
      let dragActive = false;
      let dragMoved = false;
      let sx = 0;
      let sy = 0;
      let sl = 0;
      let st = 0;

      dragHeaderEl.addEventListener("pointerdown", (e) => {
        if (e.target && e.target.closest && e.target.closest("button")) return;
        const rect = hostEl.getBoundingClientRect();
        dragActive = true;
        dragMoved = false;
        sx = e.clientX;
        sy = e.clientY;
        sl = rect.left;
        st = rect.top;
        hudInteractionPaused = true;
        clearTimeout(hudAutoCloseTimer);
        if (autoBarEl) autoBarEl.classList.add("paused");
        try { dragHeaderEl.setPointerCapture(e.pointerId); } catch (err) {}
      });

      dragHeaderEl.addEventListener("pointermove", (e) => {
        if (!dragActive) return;
        const dx = e.clientX - sx;
        const dy = e.clientY - sy;
        if (!dragMoved && Math.hypot(dx, dy) >= 4) {
          dragMoved = true;
          isDraggingTopHud = true;
        }
        if (dragMoved) {
          const rect = hostEl.getBoundingClientRect();
          const clamped = clampHudPosition(sl + dx, st + dy, rect.width || 360, rect.height || 130, 6);
          hostEl.style.left = `${clamped.left}px`;
          hostEl.style.top = `${clamped.top}px`;
          hostEl.style.right = "auto";
          hostEl.style.bottom = "auto";
          hostEl.style.transform = "none";
        }
      });

      const finishTopHudDrag = (e) => {
        if (!dragActive) return;
        dragActive = false;
        try { dragHeaderEl.releasePointerCapture(e.pointerId); } catch (err) {}
        if (dragMoved) {
          isDraggingTopHud = false;
          const rect = hostEl.getBoundingClientRect();
          saveHudPosition(
            "topHud",
            createSavedHudCoord(rect.left, rect.top, rect.width || 360, rect.height || 130, 6)
          );
          renderTopManualHUD();
        }
      };

      dragHeaderEl.addEventListener("pointerup", finishTopHudDrag);
      dragHeaderEl.addEventListener("pointercancel", finishTopHudDrag);
    }

    if (barEl) {
      barEl.addEventListener("mouseenter", () => {
        hudInteractionPaused = true;
        clearTimeout(hudAutoCloseTimer);
      });
      barEl.addEventListener("mouseleave", () => {
        hudInteractionPaused = false;
        scheduleAutoClosePrompt(2000);
      });
      barEl.addEventListener("touchstart", () => {
        hudInteractionPaused = true;
        clearTimeout(hudAutoCloseTimer);
      }, { passive: true });
    }

    (document.body || document.documentElement).appendChild(hostEl);
    if (hasCustomTopHudPos) {
      updateTopManualHudSavedPosition();
    }
    scheduleAutoClosePrompt(hudDurMs);
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // =========================================================================
  // v2.2.5: DETEKSI CTA SHORTLINK (GO TO LINK) & AUTO-BYPASS OVERLAY JEBAKAN KOSONG
  // =========================================================================
  function isShortlinkCtaElement(el, rawHref) {
    if (!el) return false;
    try {
      const hrefStr = String(rawHref || "").trim();
      const label = (
        (el.innerText || el.textContent || el.value || el.getAttribute("aria-label") || el.getAttribute("title") || "") +
        " " +
        (el.id || "")
      ).trim();

      if (hrefStr && SHORTLINK_CTA_HREF_REGEX.test(hrefStr)) {
        return true;
      }
      if (label && SHORTLINK_CTA_TEXT_REGEX.test(label)) {
        return true;
      }
      const cardContainer = el.closest(".card, [class*='redirect' i], [class*='download' i], [class*='shortlink' i], [id*='redirect' i]");
      if (cardContainer) {
        const cardText = (cardContainer.innerText || "").slice(0, 300);
        if (/(redirect\s*ready|please\s*wait|link\s*ready|link\s*siap|go\s*to\s*link|get\s*link)/i.test(cardText)) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  function signalShortlinkCtaClick(hrefUrl) {
    try {
      window.dispatchEvent(new CustomEvent("__AEGIS_SHORTLINK_CTA_CLICK__", {
        detail: { href: String(hrefUrl || "") }
      }));
    } catch (e) {}
    try {
      chrome.runtime.sendMessage({
        type: "USER_CLICKED_SHORTLINK_CTA",
        sourceUrl: location.href,
        href: String(hrefUrl || "")
      });
    } catch (e) {}
  }

  function isEmptyFullscreenTrapOverlay(el) {
    if (!el || el.nodeType !== 1) return false;
    if (
      el.id === "aegis-top-manual-hud" ||
      el.id === "aegis-video-bottom-dock" ||
      el.id === "aegis-miniplayer-dragbar" ||
      el.closest("#aegis-top-manual-hud, #aegis-video-bottom-dock, #aegis-miniplayer-dragbar")
    ) {
      return false;
    }
    if (el.matches("html, body, main, article, video, canvas, iframe, form, dialog, input, textarea, button")) {
      return false;
    }
    if (el.querySelector && el.querySelector("video, canvas, iframe, form, dialog, input, textarea, button, select, img, svg")) {
      return false;
    }
    const textLen = (el.innerText || el.textContent || "").trim().length;
    if (textLen > 0) return false;

    const st = window.getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || st.pointerEvents === "none") return false;
    if (st.position !== "fixed" && st.position !== "absolute") return false;

    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth || 360;
    const vh = window.innerHeight || 640;
    if (rect.width < vw * 0.65 || rect.height < vh * 0.65) return false;

    const bg = st.backgroundColor || "";
    const isTransparentOrLightBackdrop =
      parseFloat(st.opacity) < 0.25 ||
      bg === "transparent" ||
      bg === "rgba(0, 0, 0, 0)" ||
      /^rgba\([^,]+,[^,]+,[^,]+,\s*0(\.[0-4]\d*)?\s*\)$/i.test(bg);

    const idCls = ((el.id || "") + " " + (typeof el.className === "string" ? el.className : "")).toLowerCase();
    const isExplicitOverlayTrap = /(^|\b)(overlay|click-?overlay|ad-?overlay|pop-?overlay|backdrop-?trap)(\b|$)/i.test(idCls);

    return isTransparentOrLightBackdrop || isExplicitOverlayTrap;
  }

  function neutralizeEmptyTrapOverlays() {
    if (globalSettings.removeTransparentOverlay === false) return;
    const curHost = location.hostname.toLowerCase();
    if (
      isSameSafeEcosystem(curHost, curHost) ||
      isUrlInTrustedList(location.href)
    ) {
      return;
    }
    try {
      const hasInteractiveUnderneath = Boolean(document.querySelector("a[href], button, [role='button']"));
      if (!hasInteractiveUnderneath) return;

      const candidates = document.querySelectorAll(
        "#overlay, [id*='overlay' i], [class*='overlay' i], body > div, body > a"
      );
      candidates.forEach((el) => {
        if (isEmptyFullscreenTrapOverlay(el)) {
          el.style.setProperty("pointer-events", "none", "important");
          el.style.setProperty("display", "none", "important");
          el.style.setProperty("visibility", "hidden", "important");
          if (el.dataset.aegisTrapBypassed !== "1") {
            el.dataset.aegisTrapBypassed = "1";
            logAegisEvent(
              "BYPASS",
              "BYPASS_TRAP_OVERLAY",
              "",
              `Overlay jebakan kosong dinonaktifkan (#${el.id || "anon"})`
            );
          }
        }
      });
    } catch (e) {}
  }

  // =========================================================================
  // BYPASS ALL SHORTLINKS DEBLOATED ENGINE (BLOGGERPEMULA / AMM0NI4 PATTERN)
  // Ringan, tanpa bloat/donasi/telemetri, 100% terintegrasi keamanan AEGIS-AI
  // =========================================================================
  const SHORTLINK_QUERY_KEYS = [
    "url", "u", "to", "go", "link", "r", "o", "site", "target",
    "dest", "destination", "redirect", "k", "m", "d", "l", "data"
  ];
  let shortlinkDirectBypassTriggered = false;
  let shortlinkBypassActionTaken = false;
  let shortlinkCaptchaLoggedOnce = false;

  function safeShortlinkBase64Decode(raw) {
    try {
      const cleaned = String(raw || "").trim().replace(/-/g, "+").replace(/_/g, "/");
      if (cleaned.length < 8 || !/^[A-Za-z0-9+/=]+$/.test(cleaned)) return null;
      const padded = cleaned + "=".repeat((4 - (cleaned.length % 4)) % 4);
      const decoded = atob(padded);
      if (!decoded || /[\x00-\x08\x0E-\x1F]/.test(decoded)) return null;
      return decoded.trim();
    } catch {
      return null;
    }
  }

  function extractHttpUrlFromDecodedStr(raw) {
    if (!raw) return null;
    const trimmed = String(raw).trim();
    if (/^https?:\/\/[^\s"'<>]+$/i.test(trimmed)) return trimmed;
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const obj = JSON.parse(trimmed);
        const cand = obj.url || obj.link || obj.target || obj.to || obj.href || "";
        if (typeof cand === "string" && /^https?:\/\//i.test(cand.trim())) {
          return cand.trim();
        }
      } catch {}
    }
    return null;
  }

  function decodeShortlinkCandidateValue(rawValue) {
    if (!rawValue || String(rawValue).length < 8) return null;
    let uriDecoded = String(rawValue).trim();
    try {
      uriDecoded = decodeURIComponent(uriDecoded);
    } catch {}

    const direct = extractHttpUrlFromDecodedStr(uriDecoded);
    if (direct) return { url: direct, method: "QUERY_DIRECT" };

    const revPlain = uriDecoded.split("").reverse().join("");
    const revDirect = extractHttpUrlFromDecodedStr(revPlain);
    if (revDirect) return { url: revDirect, method: "QUERY_REVERSED" };

    const b64Once = safeShortlinkBase64Decode(uriDecoded);
    if (b64Once) {
      const fromOnce = extractHttpUrlFromDecodedStr(b64Once);
      if (fromOnce) return { url: fromOnce, method: "QUERY_BASE64" };
      const revB64 = extractHttpUrlFromDecodedStr(b64Once.split("").reverse().join(""));
      if (revB64) return { url: revB64, method: "QUERY_REVERSED" };
      const b64Twice = safeShortlinkBase64Decode(b64Once);
      if (b64Twice) {
        const fromTwice = extractHttpUrlFromDecodedStr(b64Twice);
        if (fromTwice) return { url: fromTwice, method: "QUERY_DOUBLE_BASE64" };
      }
    }

    const b64Rev = safeShortlinkBase64Decode(revPlain);
    if (b64Rev) {
      const fromRevB64 = extractHttpUrlFromDecodedStr(b64Rev);
      if (fromRevB64) return { url: fromRevB64, method: "QUERY_REVERSED" };
    }
    return null;
  }

  function isShortlinkBypassTargetSafe(candidateUrl) {
    try {
      const dest = new URL(candidateUrl, location.href);
      if (dest.protocol !== "http:" && dest.protocol !== "https:") {
        return { safe: false, reason: "Protokol non-HTTP ditolak" };
      }
      if (dest.href === location.href) {
        return { safe: false, reason: "URL sama dengan halaman saat ini" };
      }
      if (isUrlInDeniedList(dest.href)) {
        return { safe: false, reason: "Domain hasil decode ada di Blacklist" };
      }
      const host = dest.hostname.toLowerCase();
      const base = getBaseDomain(host);
      if (
        GAMBLING_REGEX.test(dest.href) ||
        COMMERCE_AFFILIATE_REGEX.test(dest.href) ||
        SEARCH_ARBITRAGE_PARAMS.test(dest.href) ||
        RANDOM_SHORT_DOMAIN_REGEX.test(base)
      ) {
        return { safe: false, reason: "URL hasil decode terindikasi iklan/judol/affiliate" };
      }
      return { safe: true, resolvedUrl: dest.href };
    } catch {
      return { safe: false, reason: "Format URL tidak valid" };
    }
  }

  function extractDirectShortlinkUrlFromPage() {
    try {
      const cur = new URL(location.href);

      // 1. Parameter query (WP Safelink / Blogger Safelink / Redirector)
      for (const key of SHORTLINK_QUERY_KEYS) {
        const val = cur.searchParams.get(key);
        if (!val) continue;
        const decoded = decodeShortlinkCandidateValue(val);
        if (decoded) {
          const check = isShortlinkBypassTargetSafe(decoded.url);
          if (check.safe) {
            return { found: true, url: check.resolvedUrl, method: decoded.method };
          }
          logAegisEvent("BLOCK", "BYPASS_DECODE_REJECTED", decoded.url, `Decode ${decoded.method} ditolak: ${check.reason}`);
          return { found: false };
        }
      }

      // 2. Hash fragment (#aHR0c...)
      const rawHash = (cur.hash || "").replace(/^#/, "").trim();
      if (rawHash.length >= 12) {
        const hashCand = rawHash.includes("=") ? rawHash.split("=").slice(1).join("=") : rawHash;
        const decoded = decodeShortlinkCandidateValue(hashCand);
        if (decoded) {
          const check = isShortlinkBypassTargetSafe(decoded.url);
          if (check.safe) {
            return { found: true, url: check.resolvedUrl, method: "HASH_BASE64" };
          }
          logAegisEvent("BLOCK", "BYPASS_DECODE_REJECTED", decoded.url, `Decode HASH ditolak: ${check.reason}`);
          return { found: false };
        }
      }

      // 3. Hidden input WP/Blogger Safelink (newwpsafelink, go, url, link, target)
      if (document.body) {
        const hiddenInputs = document.querySelectorAll(
          "input[type='hidden'][name], input[name*='safelink' i], input[name='go'], input[name='url'], input[name='link']"
        );
        for (const inp of hiddenInputs) {
          const nm = String(inp.name || "").toLowerCase();
          if (!/(safelink|newwpsafelink|go|url|link|target|dest|data|redirect)/i.test(nm)) continue;
          const decoded = decodeShortlinkCandidateValue(inp.value || "");
          if (decoded) {
            const check = isShortlinkBypassTargetSafe(decoded.url);
            if (check.safe) {
              return { found: true, url: check.resolvedUrl, method: "HIDDEN_INPUT_PAYLOAD" };
            }
            logAegisEvent("BLOCK", "BYPASS_DECODE_REJECTED", decoded.url, `Decode hidden input (${nm}) ditolak: ${check.reason}`);
            return { found: false };
          }
        }
      }

      // 4. <meta http-equiv="refresh" content="5;url=https://...">
      const metaRefresh = document.querySelector("meta[http-equiv='refresh' i]");
      if (metaRefresh) {
        const content = metaRefresh.getAttribute("content") || "";
        const m = content.match(/url\s*=\s*['"]?([^'"\s;>]+)['"]?/i);
        if (m && m[1]) {
          const check = isShortlinkBypassTargetSafe(m[1]);
          if (check.safe) {
            return { found: true, url: check.resolvedUrl, method: "META_REFRESH" };
          }
        }
      }
    } catch (e) {}
    return { found: false };
  }

  function isShortlinkBypassAllowedOnCurrentHost() {
    if (globalSettings.shortlinkBypassEnabled === false) return false;
    const curHost = location.hostname.toLowerCase();
    if (
      isSameSafeEcosystem(curHost, curHost) ||
      SAFE_MEDIA_HOST_REGEX.test(curHost) ||
      SEARCH_ENGINE_HOST_REGEX.test(curHost) ||
      MESSENGER_OR_SOCIAL_ENTRY_REGEX.test(curHost) ||
      isUrlInTrustedList(location.href) ||
      isAuthUrlStr(location.href)
    ) {
      return false;
    }
    return true;
  }

  function showShortlinkBypassToast(targetUrl, method) {
    try {
      const mountParent = document.body || document.documentElement;
      if (!mountParent) return;
      const existing = document.getElementById("aegis-shortlink-bypass-toast");
      if (existing) existing.remove();

      let targetHost = "";
      try {
        targetHost = new URL(targetUrl, location.href).hostname.replace(/^www\./, "");
      } catch (e) {}

      const hostEl = document.createElement("div");
      hostEl.id = "aegis-shortlink-bypass-toast";
      Object.assign(hostEl.style, {
        position: "fixed",
        right: "16px",
        bottom: "18px",
        zIndex: "2147483647",
        pointerEvents: "none",
        maxWidth: "min(340px, calc(100vw - 32px))"
      });

      const shadow = hostEl.attachShadow({ mode: "closed" });
      shadow.innerHTML = `
        <style>
          @keyframes aegisToastIn {
            from { opacity: 0; transform: translateY(8px) scale(0.97); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          .toast {
            display: flex;
            flex-direction: column;
            gap: 2px;
            background: rgba(15, 23, 42, 0.96);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(52, 211, 153, 0.55);
            border-radius: 12px;
            padding: 9px 13px;
            box-shadow: 0 10px 28px rgba(0, 0, 0, 0.65);
            font-family: system-ui, -apple-system, sans-serif;
            animation: aegisToastIn 0.18s ease-out forwards;
          }
          .title {
            font-size: 12px;
            font-weight: 700;
            color: #34d399;
            letter-spacing: 0.01em;
          }
          .sub {
            font-size: 10.5px;
            color: #cbd5e1;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        </style>
        <div class="toast" role="status" aria-live="polite">
          <span class="title">⚡ AEGIS Bypass: Melompati Safelink...</span>
          <span class="sub">${escapeHtml(targetHost ? `→ ${targetHost} (${method || "DIRECT"})` : `Metode: ${method || "DIRECT"}`)}</span>
        </div>
      `;
      mountParent.appendChild(hostEl);
    } catch (e) {}
  }

  function tryEarlyDirectShortlinkBypass() {
    if (window.top !== window.self || shortlinkDirectBypassTriggered) return false;
    if (!isShortlinkBypassAllowedOnCurrentHost()) return false;

    const extracted = extractDirectShortlinkUrlFromPage();
    if (!extracted.found || !extracted.url) return false;

    shortlinkDirectBypassTriggered = true;
    shortlinkBypassActionTaken = true;
    signalShortlinkCtaClick(extracted.url);
    showShortlinkBypassToast(extracted.url, extracted.method);
    logAegisEvent(
      "BYPASS",
      `BYPASS_${extracted.method}`,
      extracted.url,
      `Bypass Shortlink Debloated mengekstrak URL tujuan langsung (${extracted.method}) — menampilkan toast & redirect`
    );

    const startTs = Date.now();
    let didRedirect = false;
    const executeRedirect = () => {
      if (didRedirect) return;
      didRedirect = true;
      try {
        location.replace(extracted.url);
      } catch {
        location.href = extracted.url;
      }
    };
    const fallbackTimer = setTimeout(executeRedirect, 1100);

    try {
      chrome.runtime.sendMessage(
        {
          type: "ALLOW_SHORTLINK_BYPASS_NAV",
          url: extracted.url,
          sourceUrl: location.href,
          method: extracted.method
        },
        () => {
          const remainingMs = Math.max(0, 800 - (Date.now() - startTs));
          clearTimeout(fallbackTimer);
          setTimeout(executeRedirect, remainingMs);
        }
      );
    } catch {
      clearTimeout(fallbackTimer);
      setTimeout(executeRedirect, 800);
    }
    return true;
  }

  function hasVisibleUnsolvedCaptcha() {
    const captchaNodes = document.querySelectorAll(
      ".g-recaptcha, .h-captcha, .cf-turnstile, iframe[src*='recaptcha'], iframe[src*='hcaptcha'], iframe[src*='challenges.cloudflare.com']"
    );
    for (const node of captchaNodes) {
      const rect = node.getBoundingClientRect();
      if (rect.width > 20 && rect.height > 20) {
        const resp = document.querySelector(
          "textarea[name='g-recaptcha-response'], textarea[name='h-captcha-response'], input[name='cf-turnstile-response']"
        );
        if (!resp || !String(resp.value || "").trim()) {
          return true;
        }
      }
    }
    return false;
  }

  function runShortlinkDebloatedBypassStep() {
    if (window.top !== window.self || shortlinkDirectBypassTriggered) return shortlinkBypassActionTaken;
    if (!isShortlinkBypassAllowedOnCurrentHost()) return false;
    if (globalSettings.shortlinkAutoClick === false) return false;

    // Coba decode ulang jika DOM baru menyuntikkan hidden input safelink
    if (tryEarlyDirectShortlinkBypass()) return true;

    // Pastikan tidak pernah mengganggu halaman login atau halaman dengan CAPTCHA yang belum diselesaikan
    if (document.querySelector("input[type='password']")) return false;
    if (hasVisibleUnsolvedCaptcha()) {
      if (!shortlinkCaptchaLoggedOnce) {
        shortlinkCaptchaLoggedOnce = true;
        logAegisEvent("WARN", "BYPASS_WAIT_CAPTCHA", "", "CAPTCHA terdeteksi — Bypass Shortlink menunggu verifikasi pengguna");
      }
      return false;
    }

    neutralizeEmptyTrapOverlays();

    // 1. Cek form AdLinkFly / WP Safelink siap submit (tanpa CAPTCHA)
    const adlinkForm = document.querySelector(
      "form#go-link, form[name='wpsafelink'], form.go-link, form[action*='wpsafelink' i]"
    );
    if (adlinkForm && adlinkForm.dataset.aegisBypassSubmitted !== "1") {
      const submitBtn = adlinkForm.querySelector("button[type='submit'], input[type='submit'], button.get-link");
      const isDisabled = submitBtn && (submitBtn.disabled || submitBtn.classList.contains("disabled"));
      if (!isDisabled) {
        adlinkForm.dataset.aegisBypassSubmitted = "1";
        shortlinkBypassActionTaken = true;
        signalShortlinkCtaClick(adlinkForm.getAttribute("action") || location.href);
        logAegisEvent("BYPASS", "BYPASS_FORM_SUBMIT", adlinkForm.getAttribute("action") || location.href, "Form shortlink AdLinkFly/Safelink dikirim otomatis");
        try {
          if (submitBtn) submitBtn.click();
          else adlinkForm.submit();
        } catch (e) {}
        return true;
      }
    }

    // 2. Cek tombol CTA shortlink populer yang sudah siap (tidak disabled & countdown selesai)
    const ctaSelectors = [
      "a.get-link[href]",
      "#wpsafe-link a[href]",
      "a#wpsafe-generate[href]",
      "a#btn-main[href]",
      "a#gotolink[href]",
      "a#getlink[href]",
      "a#babay[href]",
      ".card a[href*='download=']",
      "a.btn-download[href]",
      "button#wpsafe-generate",
      "button#btn-main"
    ];

    for (const sel of ctaSelectors) {
      const el = document.querySelector(sel);
      if (!el || el.dataset.aegisBypassClicked === "1") continue;
      if (isRealAdSlotContainer(el) || isInsideUserPostContent(el)) continue;

      const st = window.getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || parseFloat(st.opacity) < 0.1) continue;

      const cls = typeof el.className === "string" ? el.className : "";
      const isDisabled =
        el.disabled ||
        el.hasAttribute("disabled") ||
        /\bdisabled\b/i.test(cls) ||
        el.getAttribute("aria-disabled") === "true";
      if (isDisabled) continue;

      const rawHref = el.getAttribute("href") || "";
      if (el.tagName === "A") {
        if (!rawHref || rawHref === "#" || /^javascript:/i.test(rawHref)) continue;
        let absHref = "";
        try {
          absHref = new URL(rawHref, location.href).href;
        } catch {
          continue;
        }
        if (isUrlInDeniedList(absHref)) {
          logAegisEvent("BLOCK", "BYPASS_CTA_BLACKLIST_SKIP", absHref, "Tombol CTA tujuan ada di Blacklist — tidak diklik otomatis");
          continue;
        }
        const sameOrigin = new URL(absHref).origin === location.origin;
        if (!sameOrigin) {
          const check = isShortlinkBypassTargetSafe(absHref);
          if (!check.safe) {
            logAegisEvent("BLOCK", "BYPASS_CTA_UNSAFE_SKIP", absHref, `Tombol CTA dilewati: ${check.reason}`);
            continue;
          }
        }
        el.dataset.aegisBypassClicked = "1";
        shortlinkBypassActionTaken = true;
        signalShortlinkCtaClick(absHref);
        logAegisEvent(
          "BYPASS",
          "BYPASS_AUTO_CLICK_CTA",
          absHref,
          `Tombol tujuan "${(el.innerText || el.id || sel).trim().slice(0, 40)}" diklik otomatis oleh Bypass Debloated`
        );
        try {
          el.click();
        } catch (e) {}
        return true;
      } else {
        el.dataset.aegisBypassClicked = "1";
        shortlinkBypassActionTaken = true;
        signalShortlinkCtaClick(location.href);
        logAegisEvent(
          "BYPASS",
          "BYPASS_AUTO_CLICK_BTN",
          location.href,
          `Tombol langkah "${(el.innerText || el.id || sel).trim().slice(0, 40)}" diklik otomatis`
        );
        try {
          el.click();
        } catch (e) {}
        return true;
      }
    }

    return false;
  }

  let trapOverlayDebounce = null;
  const trapOverlayObserver = new MutationObserver(() => {
    if (globalSettings.removeTransparentOverlay === false) return;
    clearTimeout(trapOverlayDebounce);
    trapOverlayDebounce = setTimeout(neutralizeEmptyTrapOverlays, 120);
  });

  if (document.documentElement) {
    trapOverlayObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"]
    });
  }

  // =========================================================================
  // CLICK GUARD & AI DOM AUDIT (AMAN UNTUK TOMBOL LOGIN, FORM & PENGATURAN)
  // =========================================================================
  document.addEventListener(
    "click",
    (e) => {
      if (
        e.target &&
        (e.target.id === "aegis-top-manual-hud" || e.target.id === "aegis-video-bottom-dock")
      ) return;

      if (window.top === window.self && (videoDockManualExpanded || videoDrawerOpen)) {
        videoDockManualExpanded = false;
        videoDrawerOpen = false;
        renderFloatingVideoDock();
      }

      const target = e.target;
      if (!target) return;

      const sitePipBtn = target.closest("[aria-label*='Picture-in-Picture' i], [title*='Picture-in-Picture' i], [class*='pip-button' i], [class*='vjs-picture-in-picture-control' i], .jw-icon-pip");
      if (sitePipBtn && window.top === window.self) {
        e.preventDefault();
        e.stopImmediatePropagation();
        toggleSmartMinimizeOrPiP();
        return;
      }

      const curHost = location.hostname.toLowerCase();
      if (isSameSafeEcosystem(curHost, curHost) || isUrlInTrustedList(location.href)) {
        return;
      }

      const spoilerOrToggle = target.closest(
        ".bbCodeSpoiler, .bbCodeSpoiler-button, .bbCodeSpoiler-content, [class*='spoiler' i], [id*='spoiler' i], [data-xf-click*='toggle' i], [data-xf-click*='spoiler' i], [data-toggle], [data-bs-toggle], [aria-expanded], details, summary"
      );
      if (spoilerOrToggle) {
        return;
      }

      const clickableOrForm = target.closest("button, a, [role='button'], input, label, form, [data-xf-click], [class*='login' i], [id*='login' i], [class*='signin' i], [id*='signin' i], [class*='auth' i], [id*='auth' i], [class*='oauth' i]");
      if (clickableOrForm) {
        const label = (
          (clickableOrForm.innerText || clickableOrForm.value || clickableOrForm.getAttribute("aria-label") || clickableOrForm.getAttribute("title") || "") +
          " " +
          (clickableOrForm.id || "") +
          " " +
          (typeof clickableOrForm.className === "string" ? clickableOrForm.className : "") +
          " " +
          (clickableOrForm.getAttribute("data-xf-click") || "")
        );
        const hasPasswordInput = Boolean(document.querySelector("input[type='password']"));
        if (AUTH_BUTTON_REGEX.test(label) || (hasPasswordInput && clickableOrForm.matches("button, input, form, [role='button']"))) {
          try { chrome.runtime.sendMessage({ type: "AUTH_FLOW_STARTED" }); } catch (err) {}
          return;
        }
      }

      if (globalSettings.removeTransparentOverlay !== false && isEmptyFullscreenTrapOverlay(target)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        target.style.setProperty("pointer-events", "none", "important");
        target.style.setProperty("display", "none", "important");
        target.dataset.aegisTrapBypassed = "1";
        // Teruskan klik pengguna langsung ke tombol CTA di bawah overlay kosong
        try {
          const underneath = document.elementFromPoint(e.clientX, e.clientY);
          if (underneath && underneath !== target) {
            const underAnchor = underneath.closest("a[href], button, [role='button']");
            if (underAnchor && isShortlinkCtaElement(underAnchor, underAnchor.getAttribute("href") || "")) {
              signalShortlinkCtaClick(underAnchor.getAttribute("href") || location.href);
              underAnchor.click();
            }
          }
        } catch (err) {}
        return;
      }

      const style = window.getComputedStyle(target);
      const isTransparentOverlay =
        (style.position === "fixed" || style.position === "absolute") &&
        (parseFloat(style.opacity) === 0 || style.backgroundColor === "transparent" || style.backgroundColor === "rgba(0, 0, 0, 0)") &&
        target.offsetWidth > window.innerWidth * 0.65 &&
        target.offsetHeight > window.innerHeight * 0.65;

      const isProtectedUiElement = Boolean(
        target.closest("form, dialog, [role='dialog'], [role='menu'], [aria-modal='true'], nav, header, video, canvas, input, textarea, .overlay-container, [class*='player'], [id*='player'], [class*='video'], [id*='video'], [class*='vjs-'], [class*='jw-'], [class*='plyr'], [class*='modal'], [class*='drawer'], [class*='popup'], [class*='settings'], [class*='login' i], [id*='login' i], [class*='auth' i], [id*='auth' i]")
      );

      if (globalSettings.removeTransparentOverlay !== false && isTransparentOverlay && !isProtectedUiElement) {
        e.preventDefault();
        e.stopImmediatePropagation();
        target.remove();
        return;
      }

      const anchor = target.closest("a");
      if (anchor) {
        const rawHref = anchor.getAttribute("href") || anchor.href || "";
        if (rawHref && isAuthUrlStr(rawHref)) {
          try { chrome.runtime.sendMessage({ type: "AUTH_FLOW_STARTED" }); } catch (err) {}
          return;
        }
        if (rawHref && isVideoUrl(rawHref)) {
          registerDetectedVideo(rawHref);
        }
        if (rawHref) {
          const verdict = classifyContentLinkOrImage(anchor, rawHref);
          if (verdict.shouldAllowDirectly) {
            if (verdict.category === "SAFE_MEDIA_OR_UGC" && verdict.resolvedUrl.startsWith("http")) {
              try {
                chrome.runtime.sendMessage({
                  type: "ALLOW_USER_CONTENT_NAVIGATION",
                  url: verdict.resolvedUrl
                });
              } catch (err) {}
            } else if (verdict.category === "AUTH_OR_SAME_ORIGIN" && isShortlinkCtaElement(anchor, rawHref)) {
              // v2.2.5+: Tombol CTA shortlink same-origin (misal ?download=1&t=... "Go To Link") -> beri grace window untuk HTTP 302 tujuan!
              signalShortlinkCtaClick(verdict.resolvedUrl);
              logAegisEvent(
                "ALLOW",
                "CLICK_SHORTLINK_CTA_SIGNAL",
                verdict.resolvedUrl,
                `Klik CTA shortlink same-origin ("${(anchor.innerText || anchor.id || "CTA").trim().slice(0, 35)}") -> izinkan HTTP 302`
              );
            }
            return;
          }
          // Domain yang sudah ada di Blacklist pengguna diblokir secara SENYAP tanpa memunculkan HUD Block Menu
          if (verdict.shouldSilentBlock || isUrlInDeniedList(verdict.resolvedUrl)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            logAegisEvent(
              "BLOCK",
              "CLICK_GUARD_SILENT_BLACKLIST",
              verdict.resolvedUrl,
              "Klik tautan diblokir senyap (domain ada di Blacklist)"
            );
            return;
          }
          if (verdict.shouldHoldInHud) {
            e.preventDefault();
            e.stopImmediatePropagation();
            logAegisEvent(
              "BLOCK",
              "CLICK_GUARD_HOLD_HUD",
              verdict.resolvedUrl,
              `Klik tautan ditahan ke HUD | kategori=${verdict.category} | alasan=${verdict.reason}`
            );
            enqueueManualPrompt({
              blockedUrl: verdict.resolvedUrl,
              kind: anchor.target === "_blank" ? "popup" : "redirect",
              message: verdict.reason || "Tautan iklan/affiliate ditahan"
            });
          }
        }
        return;
      }

      // Tombol CTA shortlink non-anchor (button / role="button") yang memicu redirect JS/form
      const ctaButton = target.closest("button, [role='button'], input[type='submit'], input[type='button']");
      if (ctaButton && isShortlinkCtaElement(ctaButton, "")) {
        signalShortlinkCtaClick(location.href);
      }
    },
    true
  );

  function runAiDomAudit() {
    const curHost = location.hostname.toLowerCase();
    const elements = Array.from(document.querySelectorAll("a[href], button, [role='button']"));
    if (elements.length === 0) return;

    // Daftarkan video link yang terdeteksi tanpa pernah mematikan pointer-events gambar/konten pengguna
    elements.forEach((el) => {
      const href = el.getAttribute("href") || "";
      if (href && isVideoUrl(href)) {
        registerDetectedVideo(href);
      }
    });

    // Jangan jalankan audit tombol jebakan shortlink pada domain tepercaya atau ekosistem aman
    if (
      isSameSafeEcosystem(curHost, curHost) ||
      isUrlInTrustedList(location.href)
    ) {
      return;
    }

    // Efisiensi kuota Gemini API (v2.2.7):
    // Hanya jalankan AI DOM Audit sebagai fallback cerdas jika auto-click shortlink dimatikan
    // ATAU jika runShortlinkDebloatedBypassStep() tidak menemukan CTA/form untuk di-bypass.
    if (shortlinkDirectBypassTriggered) return;
    if (globalSettings.shortlinkAutoClick !== false) {
      if (shortlinkBypassActionTaken || runShortlinkDebloatedBypassStep()) {
        return;
      }
    }

    const pageText = document.body ? document.body.innerText.toLowerCase() : "";
    const isShortlink = /(get link|continue to link|verify human|generate link|menuju link|link siap dalam)/i.test(pageText);
    if (!isShortlink) return;

    const candidates = [];
    const elementMap = [];

    elements.forEach((el) => {
      const text = (el.innerText || el.value || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ");
      const href = el.getAttribute("href") || "";
      if ((!text && !href) || text.length > 60) return;

      if (
        AUTH_BUTTON_REGEX.test(text) ||
        (href && isAuthUrlStr(href)) ||
        isInsideUserPostContent(el) ||
        Boolean(el.querySelector && el.querySelector("img")) ||
        /spoiler/i.test(text + " " + (el.className || "")) ||
        el.closest(".bbCodeSpoiler, [class*='spoiler' i], [data-xf-click*='toggle' i]")
      ) {
        return;
      }

      if (candidates.length < 25) {
        candidates.push({
          idx: candidates.length,
          tag: el.tagName.toLowerCase(),
          text: text.slice(0, 40),
          href: href.slice(0, 90)
        });
        elementMap.push(el);
      }
    });

    if (candidates.length < 2) return;

    const applyAuditResult = (data) => {
      if (!data) return;
      const { realIndex, blockedIndices } = data;

      if (Array.isArray(blockedIndices)) {
        blockedIndices.forEach((idx) => {
          const badEl = elementMap[idx];
          if (badEl) {
            const btnTxt = (badEl.innerText || badEl.value || "").trim();
            if (AUTH_BUTTON_REGEX.test(btnTxt) || isInsideUserPostContent(badEl)) return;
            badEl.style.opacity = "0.35";
            badEl.style.textDecoration = "line-through";
          }
        });
      }

      if (typeof realIndex === "number" && realIndex >= 0 && elementMap[realIndex]) {
        const goodEl = elementMap[realIndex];
        goodEl.style.outline = "3px solid #00e676";
        goodEl.style.boxShadow = "0 0 12px rgba(0, 230, 118, 0.85)";
      }
    };

    const cacheKey = `${location.hostname.toLowerCase()}::${candidates.length}`;
    const ttlMs = 24 * 60 * 60 * 1000;

    chrome.storage.local.get(["aiAuditCache"], (store) => {
      const cache = store.aiAuditCache && typeof store.aiAuditCache === "object" ? store.aiAuditCache : {};
      const hit = cache[cacheKey];
      if (hit && hit.ts && (Date.now() - hit.ts) < ttlMs && hit.data) {
        applyAuditResult(hit.data);
        return;
      }

      chrome.runtime.sendMessage(
        {
          type: "ANALYZE_CANDIDATES",
          payload: { title: document.title, pageUrl: location.href, candidates }
        },
        (res) => {
          if (!res || !res.success || !res.data) return;
          applyAuditResult(res.data);

          chrome.storage.local.get(["aiAuditCache"], (latestStore) => {
            const nextCache = latestStore.aiAuditCache && typeof latestStore.aiAuditCache === "object" ? { ...latestStore.aiAuditCache } : {};
            const now = Date.now();
            Object.keys(nextCache).forEach((k) => {
              if (!nextCache[k] || !nextCache[k].ts || (now - nextCache[k].ts) >= ttlMs) {
                delete nextCache[k];
              }
            });
            nextCache[cacheKey] = { ts: now, data: res.data };
            chrome.storage.local.set({ aiAuditCache: nextCache });
          });
        }
      );
    });
  }

  // =========================================================================
  // KONTROL ORIENTASI POTRET / LANDSCAPE SAAT FULLSCREEN
  // =========================================================================
  let isForcedPortrait = false;
  let portraitStyleEl = null;

  function ensurePortraitStyle() {
    if (portraitStyleEl && document.head.contains(portraitStyleEl)) return;
    portraitStyleEl = document.createElement("style");
    portraitStyleEl.id = "aegis-portrait-fs-style";
    portraitStyleEl.textContent = `
      html.__aegis_portrait_fs__,
      body.__aegis_portrait_fs__ {
        background: #000 !important;
        overflow: hidden !important;
      }
      .__aegis_portrait_target__ {
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        width: 100vh !important;
        height: 100vw !important;
        max-width: none !important;
        max-height: none !important;
        transform: translate(-50%, -50%) rotate(90deg) !important;
        transform-origin: center center !important;
        z-index: 2147483640 !important;
        background: #000 !important;
        object-fit: contain !important;
      }
      video.__aegis_portrait_target__ {
        width: 100vh !important;
        height: 100vw !important;
        object-fit: contain !important;
      }
    `;
    (document.head || document.documentElement).appendChild(portraitStyleEl);
  }

  function getActiveFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function isLandscapeViewport() {
    return window.innerWidth > window.innerHeight;
  }

  async function togglePortraitFullscreen() {
    const fsEl = getActiveFullscreenElement();
    if (!fsEl) return;

    if (!isForcedPortrait) {
      let lockedNative = false;
      try {
        if (screen.orientation && typeof screen.orientation.lock === "function") {
          await screen.orientation.lock("portrait");
          lockedNative = true;
        }
      } catch (e) {
        lockedNative = false;
      }

      if (!lockedNative || window.innerWidth > window.innerHeight) {
        ensurePortraitStyle();
        document.documentElement.classList.add("__aegis_portrait_fs__");
        if (document.body) document.body.classList.add("__aegis_portrait_fs__");
        fsEl.classList.add("__aegis_portrait_target__");
      }

      isForcedPortrait = true;
    } else {
      resetPortraitState();
      try {
        if (screen.orientation && typeof screen.orientation.lock === "function") {
          await screen.orientation.lock("landscape");
        }
      } catch (e) {}
    }

    if (window.top === window.self) {
      renderFloatingVideoDock();
    }
  }

  function resetPortraitState() {
    isForcedPortrait = false;
    document.documentElement.classList.remove("__aegis_portrait_fs__");
    if (document.body) document.body.classList.remove("__aegis_portrait_fs__");
    document.querySelectorAll(".__aegis_portrait_target__").forEach((el) => {
      el.classList.remove("__aegis_portrait_target__");
    });
    try {
      if (screen.orientation && typeof screen.orientation.unlock === "function") {
        screen.orientation.unlock();
      }
    } catch (e) {}
  }

  document.addEventListener("fullscreenchange", () => {
    const fsEl = getActiveFullscreenElement();
    if (!fsEl && isForcedPortrait) resetPortraitState();
    if (window.top === window.self) {
      setTimeout(renderFloatingVideoDock, 120);
    }
  });
  document.addEventListener("webkitfullscreenchange", () => {
    const fsEl = getActiveFullscreenElement();
    if (!fsEl && isForcedPortrait) resetPortraitState();
    if (window.top === window.self) {
      setTimeout(renderFloatingVideoDock, 120);
    }
  });
})();
