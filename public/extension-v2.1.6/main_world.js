(() => {
  "use strict";

  if (window.__AEGIS_LOCKED__) return;
  window.__AEGIS_LOCKED__ = true;

  const earlySafeEcosystemRegex = /(^|\.)(yandex\.(com|ru|kz|by|uz|ua|tr|net)|ya\.ru|yastatic\.net|google\.(com|co\.id|com\.sg|com\.my)|googleapis\.com|gstatic\.com|youtube\.com|youtu\.be|microsoft\.com|live\.com|bing\.com|msn\.com|microsoftonline\.com|login\.windows\.net|apple\.com|icloud\.com|github\.com|githubusercontent\.com|facebook\.com|fb\.com|instagram\.com|discord\.com|discordapp\.com)$/i;

  const isCloudflareChallengePage = () => {
    try {
      const proto = location.protocol || "";
      const host = (location.hostname || "").toLowerCase();
      if (proto !== "http:" && proto !== "https:") return true;
      if (!host || window.origin === "null") return true;
      return Boolean(
        window._cf_chl_opt ||
        location.pathname.includes("/cdn-cgi/challenge-platform/") ||
        location.search.includes("__cf_chl_tk=") ||
        location.search.includes("__cf_chl_rt_tk=") ||
        location.search.includes("__cf_chl_f_tk=") ||
        /(challenges\.cloudflare\.com|cloudflarecaptcha\.com|hcaptcha\.com|recaptcha\.net)/i.test(host)
      );
    } catch {
      return true;
    }
  };

  if (isCloudflareChallengePage()) {
    return;
  }

  try {
    const initialHost = (location.hostname || "").toLowerCase();
    if (earlySafeEcosystemRegex.test(initialHost)) {
      return;
    }
  } catch (e) {}

  window.__AEGIS_TRUSTED__ = [];
  window.__AEGIS_DENIED__ = [];
  window.__AEGIS_STRICT_CROSS__ = true;
  window.__AEGIS_AUTO_SKIP__ = true;
  window.__AEGIS_ANTI_HISTORY__ = true;
  window.__AEGIS_AD_SKIP_SPEED__ = "16";
  window.__AEGIS_LOGGING_ENABLED__ = true;
  window.__AEGIS_SHORTLINK_BYPASS__ = true;
  window.__AEGIS_LAST_USER_CLICK__ = 0;
  window.__AEGIS_LAST_AUTH_CLICK__ = 0;
  window.__AEGIS_LAST_SHORTLINK_CTA__ = 0;

  window.addEventListener("__AEGIS_SHORTLINK_CTA_CLICK__", () => {
    window.__AEGIS_LAST_SHORTLINK_CTA__ = Date.now();
  });

  function emitAegisLog(level, code, toUrl, detail) {
    if (!window.__AEGIS_LOGGING_ENABLED__) return;
    try {
      window.dispatchEvent(new CustomEvent("__AEGIS_LOG_EVENT__", {
        detail: {
          level: level || "WARN",
          source: "main_world",
          code: code || "MAIN_WORLD_EVENT",
          fromUrl: location.href,
          toUrl: toUrl ? String(toUrl) : "",
          detail: detail ? String(detail) : ""
        }
      }));
    } catch (e) {}
  }

  const authButtonRegex = /\b(log\s?in|sign\s?in|masuk|daftar|register|sign\s?up|sso|oauth|continue with|lanjutkan dengan|google|microsoft|apple|github|facebook|yandex|discord)\b/i;
  const authUrlRegex = /(\/(login|signin|sign-in|log-in|auth|oauth|oauth2|sso|saml|openid|oidc|authorize|callback|session|account|accounts|passport|idp|cas|connect\/authorize|v2\/auth)(\/|$)|[?&](client_id|redirect_uri|response_type|state|scope|openid|code_challenge|samlrequest|return_to|continue|_xfRedirect)=)/i;
  const authSubdomainRegex = /^(accounts|auth|login|signin|sso|id|oauth|passport|idp|iam)\./i;

  function recordUserGesture(ev) {
    const now = Date.now();
    window.__AEGIS_LAST_USER_CLICK__ = now;
    try {
      const target = ev && ev.target;
      if (target && target.closest) {
        const clickable = target.closest("button, a, [role='button'], input[type='submit'], input[type='button'], form, [data-xf-click]");
        if (clickable) {
          const label = (
            (clickable.innerText || clickable.value || clickable.getAttribute("aria-label") || clickable.getAttribute("title") || "") +
            " " +
            (clickable.id || "") +
            " " +
            (typeof clickable.className === "string" ? clickable.className : "") +
            " " +
            (clickable.getAttribute("href") || clickable.getAttribute("action") || clickable.getAttribute("data-xf-click") || "")
          );
          const hasPasswordField = Boolean(document.querySelector("input[type='password']"));
          if (authButtonRegex.test(label) || (hasPasswordField && clickable.matches("button, input[type='submit'], [role='button'], form"))) {
            window.__AEGIS_LAST_AUTH_CLICK__ = now;
            window.dispatchEvent(new CustomEvent("__AEGIS_AUTH_GESTURE__"));
          }
        }
      }
    } catch (e) {}
  }

  document.addEventListener("pointerdown", recordUserGesture, true);
  document.addEventListener("click", recordUserGesture, true);
  document.addEventListener("keydown", (ev) => {
    window.__AEGIS_LAST_USER_CLICK__ = Date.now();
    if (ev.key === "Enter" && document.querySelector("input[type='password']")) {
      window.__AEGIS_LAST_AUTH_CLICK__ = Date.now();
      window.dispatchEvent(new CustomEvent("__AEGIS_AUTH_GESTURE__"));
    }
  }, true);
  document.addEventListener("submit", () => {
    window.__AEGIS_LAST_USER_CLICK__ = Date.now();
    window.__AEGIS_LAST_AUTH_CLICK__ = Date.now();
    window.dispatchEvent(new CustomEvent("__AEGIS_AUTH_GESTURE__"));
  }, true);

  window.addEventListener("__AEGIS_SYNC_RULES__", (ev) => {
    if (ev.detail) {
      window.__AEGIS_TRUSTED__ = Array.isArray(ev.detail.trusted) ? ev.detail.trusted : [];
      window.__AEGIS_DENIED__ = Array.isArray(ev.detail.denied) ? ev.detail.denied : [];
      window.__AEGIS_STRICT_CROSS__ = ev.detail.strictCrossOrigin !== false;
      window.__AEGIS_AUTO_SKIP__ = ev.detail.autoSkipCountdown !== false;
      if (ev.detail.globalSettings) {
        window.__AEGIS_ANTI_HISTORY__ = ev.detail.globalSettings.antiHistoryTrap !== false;
        window.__AEGIS_AD_SKIP_SPEED__ = String(ev.detail.globalSettings.adSkipSpeed || "16");
        window.__AEGIS_LOGGING_ENABLED__ = ev.detail.globalSettings.loggingEnabled !== false;
        window.__AEGIS_SHORTLINK_BYPASS__ = ev.detail.globalSettings.shortlinkBypassEnabled !== false;
      }
    }
  });

  const blockRegex = /(slot|gacor|maxwin|zeus|pragmatic|togel|judol|casino|betting|scatter|rtp|deposit|wd|bonus100|situsresmi|linkalternatif|sbobet|poker|judi|bandar|pascol4d|dewadora|toto4d)/i;
  const badTld = /\.(cfd|xyz|top|cyou|icu|buzz|click|link|monster|quest|rest|sbs|shop|site|tokyo|vip|wang|win|work|wtf|zone|live|asia|online|store|fun|pro|club|cam|cc|me|pw|tk|ml|ga|cf|gq)$/i;
  const commerceRegex = /(shopee\.|shope\.ee|tokopedia\.|lazada\.|blibli\.|bukalapak\.|tiktok\.com\/t\/|invol\.co|accesstrade|admitad|ecotrack|go2cloud|onclickalgo|popads|popcash|propellerads|adsterra|hilltopads|exoclick|juicyads|trafficjunky|monetag|richads|wpadmngr|clickadu)/i;
  const randomShortDomain = /^[a-z0-9]{2,4}[0-9][a-z0-9]{1,4}\.(com|net|org|co|id|io|info|biz)$/i;
  const arbitrageParams = /(utm_source=.*ad|utm_medium=affiliate|af_siteid=|af_sub|clickid=|click_id=|subid=|sub_id=|aff_id=|zoneid=|bannerid=|popunder|redirect|gclid=)/i;
  const safeMediaHostRegex = /(^|\.)(ibb\.co|ibb\.co\.com|imgur\.com|postimg\.cc|pixhost\.to|imgbox\.com|imagebam\.com|prnt\.sc|prntscr\.com|gyazo\.com|flickr\.com|staticflickr\.com|wikimedia\.org|tenor\.com|giphy\.com|redgifs\.com|catbox\.moe|bunkr\.(si|ru|is|la|sk|ax|ac|black|red|media|site)|cyberdrop\.(me|to|cc)|pixeldrain\.com|gofile\.io|mega\.nz|mediafire\.com|drive\.google\.com|docs\.google\.com|dropbox\.com)$/i;
  const knownAdShortenerRegex = /(^|\.)(optional\.me|see\.optional\.me|rebrand\.ly|bit\.ly|t\.ly|tinyurl\.com|is\.gd|v\.gd|cutt\.ly|shorturl\.at|ouo\.io|shrinkme\.io|exe\.io|bc\.vc|adf\.ly|linkvertise\.com)$/i;
  const antiAdblockProbeHostRegex = /(^|\.)(wpadmngr\.com|googletagmanager\.com|googlesyndication\.com|doubleclick\.net|google-analytics\.com|adservice\.google\.com|adsterra\.com|propellerads\.com|onclickalgo\.com|clickadu\.com|popads\.net|popcash\.net)$/i;
  const nonVideoAssetRegex = /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|avif|css|js|json|woff2?|ttf|eot|vtt|srt)(\?|#|$)/i;
  const videoRegex = /\.(mp4|m3u8|mkv|webm|mov|avi|flv|ts|mpd)(\?|#|$)/i;
  const videoStreamHintRegex = /(\/pass_md5\/|\/hls\/|\/stream\/|\/get_video|mime=video|videoplayback|master\.txt|index\.txt|doodcdn|cloudcdn|vidcdn|\/token\/|\/delivery\/)/i;
  const videoMimeRegex = /^(video\/|application\/(vnd\.apple\.mpegurl|x-mpegurl|dash\+xml))/i;
  const cfChallengeHostRegex = /(challenges\.cloudflare\.com|cloudflarecaptcha\.com|hcaptcha\.com|recaptcha\.net|dnstest\.dev)/i;

  const safeEcosystemGroups = [
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
    return safeEcosystemGroups.some((rx) => rx.test(hostA) && rx.test(hostB));
  }

  function isAuthUrl(urlObj) {
    if (!urlObj) return false;
    const h = urlObj.hostname.toLowerCase();
    return authSubdomainRegex.test(h) || authUrlRegex.test(urlObj.pathname + urlObj.search);
  }

  function getBase(host) {
    const p = host.split(".").filter(Boolean);
    if (p.length <= 2) return host;
    const s = p[p.length - 2];
    if (["co", "com", "net", "org", "ac", "go", "or", "web", "sch"].includes(s) && p.length >= 3) {
      return p.slice(-3).join(".");
    }
    return p.slice(-2).join(".");
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

  function isHostMatchedInArray(urlStr, list) {
    if (!urlStr || !Array.isArray(list) || list.length === 0) return false;
    try {
      const h = new URL(urlStr, location.href).hostname.toLowerCase().replace(/^www\./, "");
      if (!h) return false;
      const b = getBase(h);
      for (const item of list) {
        const rule = normalizeRuleDomain(item);
        if (!rule) continue;
        const ruleBase = getBase(rule);
        if (
          h === rule ||
          b === rule ||
          h === ruleBase ||
          b === ruleBase ||
          h.endsWith("." + rule) ||
          h.endsWith("." + ruleBase)
        ) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  function isHostTrusted(urlStr) {
    return isHostMatchedInArray(urlStr, window.__AEGIS_TRUSTED__);
  }

  function isHostDenied(urlStr) {
    return isHostMatchedInArray(urlStr, window.__AEGIS_DENIED__);
  }

  function diagnoseDestinationBlock(urlStr, isUserEvent = false) {
    if (!urlStr) return { block: true, reason: "empty_url" };
    const raw = String(urlStr).trim();
    if (/^(intent|shopeeid|tokopedia|lazada|market):/i.test(raw)) return { block: true, reason: "deep_link_app" };

    try {
      const dest = new URL(raw, location.href);
      if (!dest.protocol.startsWith("http")) return { block: false, reason: "non_http" };
      const curHost = location.hostname.toLowerCase();
      const destHost = dest.hostname.toLowerCase();
      const destBase = getBase(destHost);
      const curBase = getBase(curHost);

      if (destBase === curBase) return { block: false, reason: "same_base_domain" };
      if (isSameSafeEcosystem(curHost, destHost)) return { block: false, reason: "safe_ecosystem" };
      if (cfChallengeHostRegex.test(destHost)) return { block: false, reason: "cf_challenge" };
      if (isHostTrusted(dest.href)) return { block: false, reason: "trusted_whitelist" };
      if (isHostDenied(dest.href)) return { block: true, reason: "denied_blacklist" };

      const isSearchHijack = destHost.includes("google.") && dest.pathname === "/search";
      const isHardBadPattern =
        blockRegex.test(dest.href) ||
        commerceRegex.test(dest.href) ||
        randomShortDomain.test(destBase) ||
        arbitrageParams.test(dest.href) ||
        knownAdShortenerRegex.test(destHost);

      if (isSearchHijack) return { block: true, reason: "search_hijack" };
      if (isHardBadPattern) return { block: true, reason: "hard_ad_or_gambling_pattern" };

      const now = Date.now();
      const hasRecentUserGesture = isUserEvent || (now - window.__AEGIS_LAST_USER_CLICK__) < 1800;
      const hasRecentAuthGesture = (now - window.__AEGIS_LAST_AUTH_CLICK__) < 6000;
      const hasRecentShortlinkCta = (now - window.__AEGIS_LAST_SHORTLINK_CTA__) < 7000;

      if (hasRecentUserGesture && safeMediaHostRegex.test(destHost)) {
        return { block: false, reason: "safe_media_host" };
      }

      if (hasRecentShortlinkCta && !isHardBadPattern && !isSearchHijack) {
        return { block: false, reason: "shortlink_cta_grace" };
      }

      if (badTld.test(destHost)) return { block: true, reason: "suspicious_tld" };

      if (hasRecentUserGesture && (isAuthUrl(dest) || hasRecentAuthGesture)) {
        return { block: false, reason: "auth_flow" };
      }

      if (!hasRecentUserGesture) {
        return { block: true, reason: "no_recent_user_gesture" };
      }
      if (window.__AEGIS_STRICT_CROSS__) {
        return { block: true, reason: "strict_cross_origin" };
      }
      return { block: false, reason: "allowed" };
    } catch {
      return { block: false, reason: "parse_error" };
    }
  }

  function shouldBlockDestination(urlStr, isUserEvent = false) {
    return diagnoseDestinationBlock(urlStr, isUserEvent).block;
  }

  function emitBlocked(url, kind) {
    if (url && isHostDenied(url)) {
      return;
    }
    window.dispatchEvent(new CustomEvent("__AEGIS_BLOCKED_EVENT__", {
      detail: { url: String(url || ""), kind }
    }));
  }

  function reportVideoCandidate(rawUrl, isConfirmedMime = false) {
    try {
      if (!rawUrl) return;
      const rawStr = String(rawUrl).trim();
      if (rawStr.startsWith("data:") || rawStr.startsWith("blob:") || rawStr.startsWith("javascript:")) return;
      const absUrl = new URL(rawStr, location.href).href;
      if (!absUrl.startsWith("http")) return;
      if (nonVideoAssetRegex.test(absUrl)) return;
      if (isConfirmedMime || videoRegex.test(absUrl) || videoStreamHintRegex.test(absUrl)) {
        window.dispatchEvent(new CustomEvent("__AEGIS_VIDEO_DETECTED__", {
          detail: { url: absUrl, confirmed: isConfirmedMime }
        }));
      }
    } catch (e) {}
  }

  function isAntiAdblockFetchProbe(reqUrl, initObj) {
    if (!reqUrl) return false;
    try {
      const u = new URL(reqUrl, location.href);
      const host = u.hostname.toLowerCase();
      if (!antiAdblockProbeHostRegex.test(host) && !isHostDenied(u.href)) return false;
      const mode = initObj && typeof initObj === "object" ? String(initObj.mode || "").toLowerCase() : "";
      if (mode === "no-cors") return true;
      if (antiAdblockProbeHostRegex.test(host) && (u.pathname === "/" || u.search.includes("t="))) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  const origFetch = window.fetch;
  window.fetch = maskAsNative(function(input, init) {
    const reqUrl = typeof input === "string" ? input : (input && input.url ? input.url : "");
    reportVideoCandidate(reqUrl, false);
    const isAdblockProbe = isAntiAdblockFetchProbe(reqUrl, init);
    const p = origFetch.apply(this, arguments);
    if (p && typeof p.then === "function") {
      const handled = p.then((res) => {
        try {
          if (res && res.headers) {
            const ct = res.headers.get("content-type") || "";
            if (videoMimeRegex.test(ct)) {
              reportVideoCandidate(res.url || reqUrl, true);
            }
          }
        } catch (e) {}
        return res;
      });

      if (isAdblockProbe) {
        // v2.2.5+: Netralkan probe anti-adblock (misal fetch no-cors ke googletagmanager / js.wpadmngr.com)
        // agar jika diblokir DNR/adblocker, halaman TIDAK menghapus body dengan "Disable Adblock"!
        return handled.catch(() => {
          emitAegisLog("BYPASS", "BYPASS_ANTI_ADBLOCK_FETCH", reqUrl, "Probe anti-adblock fetch(no-cors) dinetralkan -> respons 200 OK palsu");
          try {
            return new Response("", { status: 200, statusText: "OK" });
          } catch {
            return { ok: true, status: 200, type: "opaque", text: async () => "" };
          }
        });
      }
      return handled;
    }
    return p;
  }, origFetch);

  const origXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    try {
      this.__aegisXhrUrl = url ? String(url) : "";
      reportVideoCandidate(this.__aegisXhrUrl, false);
      this.addEventListener("readystatechange", function() {
        try {
          if (this.readyState >= 2) {
            const ct = this.getResponseHeader("content-type") || "";
            if (videoMimeRegex.test(ct)) {
              reportVideoCandidate(this.responseURL || this.__aegisXhrUrl, true);
            }
          }
        } catch (e) {}
      });
    } catch (e) {}
    return origXhrOpen.apply(this, arguments);
  };

  if (window.navigation) {
    window.navigation.addEventListener("navigate", (event) => {
      try {
        const destUrl = event.destination.url;
        const recentGesture = Boolean(event.userInitiated) || (Date.now() - window.__AEGIS_LAST_USER_CLICK__) < 1800;
        const diag = diagnoseDestinationBlock(destUrl, recentGesture);
        if (diag.block) {
          if (event.cancelable) {
            event.preventDefault();
            emitAegisLog(
              "BLOCK",
              "BLOCK_MAIN_NAVIGATE",
              destUrl,
              `window.navigation.navigate ditahan | reason=${diag.reason} | userGesture=${recentGesture} | strictCross=${window.__AEGIS_STRICT_CROSS__}`
            );
            if (!isHostDenied(destUrl)) {
              emitBlocked(destUrl, "redirect");
            }
          }
        }
      } catch (err) {}
    });
  }

  const origOpen = window.open;
  window.open = maskAsNative(function(url) {
    const resolved = url ? new URL(url, location.href).href : "";
    const now = Date.now();
    const recentGesture = (now - window.__AEGIS_LAST_USER_CLICK__) < 1800;
    const recentAuth = (now - window.__AEGIS_LAST_AUTH_CLICK__) < 6000;

    if (resolved && isHostDenied(resolved)) {
      emitAegisLog("BLOCK", "BLOCK_WINDOW_OPEN_BLACKLIST", resolved, "window.open diblokir senyap (Blacklist)");
      return null;
    }

    if (resolved) {
      try {
        const curHost = location.hostname.toLowerCase();
        const destObj = new URL(resolved);
        const destHost = destObj.hostname.toLowerCase();
        if (isHostTrusted(resolved) || isSameSafeEcosystem(curHost, destHost)) {
          return origOpen.apply(this, arguments);
        }
        if (recentGesture && (isAuthUrl(destObj) || recentAuth) && !shouldBlockDestination(resolved, true)) {
          return origOpen.apply(this, arguments);
        }
      } catch (e) {}
    } else if (recentGesture && recentAuth) {
      return origOpen.apply(this, arguments);
    }

    const diag = diagnoseDestinationBlock(resolved, recentGesture);
    if (!resolved || diag.block) {
      emitAegisLog(
        "BLOCK",
        "BLOCK_WINDOW_OPEN",
        resolved || location.href,
        `window.open ditahan | reason=${diag.reason} | userGesture=${recentGesture}`
      );
      if (!resolved || !isHostDenied(resolved)) {
        emitBlocked(resolved || location.href, "popup");
      }
      return null;
    }
    return origOpen.apply(this, arguments);
  }, origOpen);

  const origAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function() {
    try {
      const href = this.getAttribute("href") || this.href || "";
      const recentGesture = (Date.now() - window.__AEGIS_LAST_USER_CLICK__) < 1800;
      const diag = href ? diagnoseDestinationBlock(href, recentGesture) : { block: false, reason: "" };
      if (href && diag.block) {
        const abs = new URL(href, location.href).href;
        emitAegisLog(
          "BLOCK",
          "BLOCK_ANCHOR_JS_CLICK",
          abs,
          `HTMLAnchorElement.click() ditahan | reason=${diag.reason} | userGesture=${recentGesture}`
        );
        if (!isHostDenied(abs)) {
          emitBlocked(abs, this.target === "_blank" ? "popup" : "redirect");
        }
        return;
      }
    } catch (e) {}
    return origAnchorClick.apply(this, arguments);
  };

  let pushStateSpamCount = 0;
  let lastPushStateTime = 0;
  const origPushState = history.pushState;
  history.pushState = maskAsNative(function(state, title, url) {
    if (!window.__AEGIS_ANTI_HISTORY__) {
      return origPushState.apply(this, arguments);
    }
    try {
      const curHost = location.hostname.toLowerCase();
      if (isSameSafeEcosystem(curHost, curHost) || isHostTrusted(location.href)) {
        return origPushState.apply(this, arguments);
      }
      const now = Date.now();
      if ((now - window.__AEGIS_LAST_AUTH_CLICK__) < 6000) {
        return origPushState.apply(this, arguments);
      }
      const targetUrl = url ? new URL(String(url), location.href).href : location.href;
      const isSamePagePath = (() => {
        try {
          const cur = new URL(location.href);
          const nxt = new URL(targetUrl);
          return cur.origin === nxt.origin && cur.pathname === nxt.pathname;
        } catch { return true; }
      })();

      const hasRecentUserInput = (now - window.__AEGIS_LAST_USER_CLICK__) < 1500;

      if (!hasRecentUserInput || isSamePagePath) {
        if (now - lastPushStateTime < 5000) {
          pushStateSpamCount += 1;
        } else {
          pushStateSpamCount = 1;
        }
        lastPushStateTime = now;

        if (!hasRecentUserInput || pushStateSpamCount > 1) {
          return;
        }
      }
    } catch (e) {}
    return origPushState.apply(this, arguments);
  }, origPushState);

  try {
    const mediaDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src");
    if (mediaDesc && mediaDesc.set) {
      Object.defineProperty(HTMLMediaElement.prototype, "src", {
        configurable: true,
        enumerable: true,
        get: mediaDesc.get,
        set: function(val) {
          try {
            if (val) {
              const s = String(val);
              if (s.startsWith("blob:")) {
                window.dispatchEvent(new CustomEvent("__AEGIS_VIDEO_DETECTED__", {
                  detail: { url: location.href, confirmed: true }
                }));
              } else {
                reportVideoCandidate(s, false);
              }
            }
          } catch (e) {}
          return mediaDesc.set.call(this, val);
        }
      });
    }
  } catch (e) {}

  try {
    if (window.MediaSource && MediaSource.prototype.addSourceBuffer) {
      const origAddSB = MediaSource.prototype.addSourceBuffer;
      MediaSource.prototype.addSourceBuffer = function(mimeType) {
        try {
          if (mimeType && String(mimeType).toLowerCase().includes("video")) {
            window.dispatchEvent(new CustomEvent("__AEGIS_VIDEO_DETECTED__", {
              detail: { url: location.href, confirmed: true }
            }));
          }
        } catch (e) {}
        return origAddSB.apply(this, arguments);
      };
    }
  } catch (e) {}

  const origSetInterval = window.setInterval;
  const origSetTimeout = window.setTimeout;

  function isProtectedFrameworkCallback(fn) {
    if (typeof fn !== "function") return true;
    try {
      const src = Function.prototype.toString.call(fn);
      return /(hls|dash|mediaSource|sourceBuffer|fragment|segment|bitrate|bandwidth|plyr|videojs|jwplayer|artplayer|dplayer|levelLoaded|fragLoaded|abort|xhr|ajax|overlay|xenforo|xf\.|fetch|timeout|reject|server|respond)/i.test(src);
    } catch {
      return true;
    }
  }

  function isServerTokenShortlinkPage() {
    try {
      if (document.querySelector("video")) return false;
      const tokenLink = document.querySelector(
        "a[href*='download='], a[href*='&t='], a[href*='?t='], a[href*='token='], a[href*='hash='], a#babay, a.btn-download"
      );
      if (tokenLink) return true;
      const bodyText = document.body ? (document.body.innerText || "").slice(0, 600) : "";
      return /(redirect\s*ready|go\s*to\s*link|link\s*ready|please\s*wait\s*a\s*moment)/i.test(bodyText);
    } catch {
      return false;
    }
  }

  function has5to30CountdownOnPage() {
    if (isServerTokenShortlinkPage()) return false;
    const nodes = document.querySelectorAll(
      "[id*='count'], [class*='count'], [id*='timer'], [class*='timer'], [id*='wait'], [class*='wait'], [class*='skip'], [id*='skip'], [class*='ad-text'], [class*='preroll'], [class*='seconds'], [id*='seconds']"
    );
    for (const el of nodes) {
      if (el.offsetParent === null) continue;
      const txt = (el.innerText || "").trim();
      if (!txt || txt.length > 80) continue;
      if (/\b([5-9]|[12][0-9]|30)\b/.test(txt) && /(detik|sec|second|wait|tunggu|skip|lewati|iklan|ad|link|siap|ready|please|harap|^([5-9]|[12][0-9]|30)s?$)/i.test(txt)) {
        return true;
      }
    }
    return false;
  }

  function maskAsNative(wrapperFn, nativeFn) {
    try {
      const nativeStr = Function.prototype.toString.call(nativeFn);
      Object.defineProperty(wrapperFn, "toString", {
        value: function() { return nativeStr; },
        writable: true,
        configurable: true
      });
    } catch (e) {}
    return wrapperFn;
  }

  window.setInterval = maskAsNative(function(fn, delay) {
    let d = Number(delay);
    const curHost = location.hostname.toLowerCase();
    if (
      window.__AEGIS_AUTO_SKIP__ &&
      !isHostTrusted(location.href) &&
      !isSameSafeEcosystem(curHost, curHost) &&
      !isProtectedFrameworkCallback(fn)
    ) {
      if (Number.isFinite(d) && d >= 800 && d <= 1250 && has5to30CountdownOnPage()) {
        d = 40;
      }
    }
    return origSetInterval.call(this, fn, d);
  }, origSetInterval);

  window.setTimeout = maskAsNative(function(fn, delay) {
    if (window._cf_chl_opt) {
      return origSetTimeout.apply(this, arguments);
    }
    let d = Number(delay);
    const curHost = location.hostname.toLowerCase();
    if (
      window.__AEGIS_AUTO_SKIP__ &&
      !isHostTrusted(location.href) &&
      !isSameSafeEcosystem(curHost, curHost) &&
      !isProtectedFrameworkCallback(fn)
    ) {
      if (Number.isFinite(d) && d >= 5000 && d <= 30500 && has5to30CountdownOnPage()) {
        d = 300;
      } else if (Number.isFinite(d) && d >= 800 && d <= 1250 && has5to30CountdownOnPage()) {
        d = 40;
      }
    }
    return origSetTimeout.call(this, fn, d);
  }, origSetTimeout);

  function isVideoElementAnAd(v) {
    if (!v) return false;
    if (v.closest(".ad-showing, .ad-interrupting, .ima-ad-container, .vast-ad, [class*='preroll'], [id*='preroll'], [class*='video-ad'], [id*='video-ad']")) {
      return true;
    }
    const idCls = ((v.id || "") + " " + (typeof v.className === "string" ? v.className : "")).toLowerCase();
    const src = (v.currentSrc || v.src || "").toLowerCase();
    if (/(preroll|vast|ima-ad|ad-video|doubleclick|googlesyndication)/i.test(idCls + " " + src)) {
      return true;
    }
    return false;
  }

  function restoreNativeApisIfTurnstileDetected() {
    if (isCloudflareChallengePage() || document.querySelector("script[src*='/cdn-cgi/challenge-platform/'], iframe[src*='challenges.cloudflare.com']")) {
      try {
        window.setTimeout = origSetTimeout;
        window.setInterval = origSetInterval;
        window.fetch = origFetch;
        window.open = origOpen;
        history.pushState = origPushState;
      } catch (e) {}
      return true;
    }
    return false;
  }

  function runAutoSkipSweep() {
    if (restoreNativeApisIfTurnstileDetected()) return;
    if (!window.__AEGIS_AUTO_SKIP__) return;
    if (isHostTrusted(location.href)) return;

    let didSkipAction = false;

    try {
      document.querySelectorAll("video").forEach((v) => {
        try {
          if (isVideoElementAnAd(v) && v.duration && Number.isFinite(v.duration) && v.duration >= 4 && v.duration <= 36) {
            if (!v.ended && v.currentTime < v.duration - 0.25) {
              v.muted = true;
              const mode = window.__AEGIS_AD_SKIP_SPEED__;
              if (mode === "instant") {
                v.currentTime = Math.max(0, v.duration - 0.1);
              } else {
                v.playbackRate = Number(mode) || 16;
                if (v.duration - v.currentTime > 1.5) {
                  v.currentTime = Math.max(v.currentTime, v.duration - 1.2);
                }
              }
              didSkipAction = true;
            }
          }
        } catch (e) {}
      });

      const skipSelectors = [
        ".ytp-ad-skip-button",
        ".ytp-ad-skip-button-modern",
        ".ytp-skip-ad-button",
        ".jw-skip",
        ".vjs-skip-ad-button",
        "[class*='skip-ad']",
        "[class*='skipAd']",
        "[id*='skip-ad']",
        "[id*='skipAd']"
      ];
      skipSelectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((btn) => {
          try {
            if (btn.dataset.aegisAutoClicked === "1") return;
            const txt = (btn.innerText || btn.textContent || btn.getAttribute("aria-label") || "").trim();
            if (txt && txt.length > 35) return;
            btn.dataset.aegisAutoClicked = "1";
            btn.disabled = false;
            btn.removeAttribute("disabled");
            btn.style.display = "block";
            btn.style.visibility = "visible";
            btn.click();
            didSkipAction = true;
          } catch (e) {}
        });
      });

      document.querySelectorAll("div, section, aside").forEach((el) => {
        try {
          if (el.id === "aegis-top-manual-hud" || el.closest("#aegis-top-manual-hud")) return;
          if (el.id === "aegis-video-bottom-dock" || el.closest("#aegis-video-bottom-dock")) return;
          if (el.querySelector("video, iframe, canvas")) return;
          const idCls = ((el.id || "") + " " + (typeof el.className === "string" ? el.className : "")).toLowerCase();
          if (/(play|poster|control|vjs-|jw-|plyr|art-|dplayer|player-ui|overlay-play)/i.test(idCls)) return;
          if (/(ima-ad-container|vast-blocker|preroll-overlay|video-ad-overlay|ad-countdown-overlay)/i.test(idCls)) {
            el.remove();
            didSkipAction = true;
          }
        } catch (e) {}
      });
    } catch (e) {}

    if (didSkipAction) {
      window.dispatchEvent(new CustomEvent("__AEGIS_AUTO_SKIPPED__"));
    }
  }

  origSetInterval.call(window, runAutoSkipSweep, 800);

  let skipMutationTimer = null;
  const skipObserver = new MutationObserver(() => {
    if (!window.__AEGIS_AUTO_SKIP__) return;
    clearTimeout(skipMutationTimer);
    skipMutationTimer = origSetTimeout.call(window, runAutoSkipSweep, 200);
  });

  if (document.documentElement) {
    skipObserver.observe(document.documentElement, { childList: true, subtree: true });
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      if (document.documentElement) {
        skipObserver.observe(document.documentElement, { childList: true, subtree: true });
      }
      runAutoSkipSweep();
    });
  }

  window.dispatchEvent(new CustomEvent("__AEGIS_REQUEST_RULES__"));
})();
