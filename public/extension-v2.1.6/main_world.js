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

  const legitCommunityHostRegex = /(^|\.)(semprot\.com|kaskus\.co\.id|reddit\.com)$/i;

  try {
    const initialHost = (location.hostname || "").toLowerCase();
    if (legitCommunityHostRegex.test(initialHost) || earlySafeEcosystemRegex.test(initialHost)) {
      return;
    }
  } catch (e) {}

  window.__AEGIS_TRUSTED__ = [];
  window.__AEGIS_DENIED__ = [];
  window.__AEGIS_STRICT_CROSS__ = true;
  window.__AEGIS_AUTO_SKIP__ = true;
  window.__AEGIS_ANTI_HISTORY__ = true;
  window.__AEGIS_AD_SKIP_SPEED__ = "16";
  window.__AEGIS_LAST_USER_CLICK__ = 0;
  window.__AEGIS_LAST_AUTH_CLICK__ = 0;

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
      }
    }
  });

  const blockRegex = /(slot|gacor|maxwin|zeus|pragmatic|togel|judol|casino|betting|scatter|rtp|deposit|wd|bonus100|situsresmi|linkalternatif|sbobet|poker|judi|bandar)/i;
  const badTld = /\.(cfd|xyz|top|cyou|icu|buzz|click|link|monster|quest|rest|sbs|shop|site|tokyo|vip|wang|win|work|wtf|zone|live|asia|online|store|fun|pro|club|cam|cc|me|pw|tk|ml|ga|cf|gq)$/i;
  const commerceRegex = /(shopee\.|shope\.ee|tokopedia\.|lazada\.|blibli\.|bukalapak\.|tiktok\.com\/t\/|invol\.co|accesstrade|admitad|ecotrack|go2cloud|onclickalgo|popads|popcash|propellerads|adsterra|hilltopads|exoclick|juicyads|trafficjunky|monetag|richads)/i;
  const randomShortDomain = /^[a-z0-9]{2,4}[0-9][a-z0-9]{1,4}\.(com|net|org|co|id|io|info|biz)$/i;
  const arbitrageParams = /(utm_source=.*ad|utm_medium=affiliate|af_siteid=|af_sub|clickid=|click_id=|subid=|sub_id=|aff_id=|zoneid=|bannerid=|popunder|redirect|gclid=)/i;
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

  function isHostTrusted(urlStr) {
    try {
      const h = new URL(urlStr, location.href).hostname.toLowerCase();
      const b = getBase(h);
      return window.__AEGIS_TRUSTED__.includes(h) || window.__AEGIS_TRUSTED__.includes(b);
    } catch { return false; }
  }

  function isHostDenied(urlStr) {
    try {
      const h = new URL(urlStr, location.href).hostname.toLowerCase();
      const b = getBase(h);
      return window.__AEGIS_DENIED__.includes(h) || window.__AEGIS_DENIED__.includes(b);
    } catch { return false; }
  }

  function shouldBlockDestination(urlStr, isUserEvent = false) {
    if (!urlStr) return true;
    const raw = String(urlStr).trim();
    if (/^(intent|shopeeid|tokopedia|lazada|market):/i.test(raw)) return true;

    try {
      const dest = new URL(raw, location.href);
      if (!dest.protocol.startsWith("http")) return false;
      const curHost = location.hostname.toLowerCase();
      const destHost = dest.hostname.toLowerCase();
      const destBase = getBase(destHost);
      const curBase = getBase(curHost);

      if (destBase === curBase) return false;
      if (isSameSafeEcosystem(curHost, destHost)) return false;
      if (cfChallengeHostRegex.test(destHost)) return false;
      if (isHostTrusted(dest.href)) return false;
      if (isHostDenied(dest.href)) return true;

      const isSearchHijack = destHost.includes("google.") && dest.pathname === "/search";
      const isBadPattern =
        blockRegex.test(dest.href) ||
        badTld.test(destHost) ||
        commerceRegex.test(dest.href) ||
        randomShortDomain.test(destBase) ||
        arbitrageParams.test(dest.href);

      if (isSearchHijack || isBadPattern) return true;

      const now = Date.now();
      const hasRecentUserGesture = isUserEvent || (now - window.__AEGIS_LAST_USER_CLICK__) < 1800;
      const hasRecentAuthGesture = (now - window.__AEGIS_LAST_AUTH_CLICK__) < 6000;

      if (hasRecentUserGesture && (isAuthUrl(dest) || hasRecentAuthGesture)) {
        return false;
      }

      if (!hasRecentUserGesture || window.__AEGIS_STRICT_CROSS__) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  function nukeTimers() {
    const maxId = setTimeout(() => {}, 0);
    for (let i = Math.max(0, maxId - 60); i <= maxId; i++) {
      clearInterval(i);
      clearTimeout(i);
    }
  }

  function emitBlocked(url, kind) {
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

  const origFetch = window.fetch;
  window.fetch = maskAsNative(function(input) {
    const reqUrl = typeof input === "string" ? input : (input && input.url ? input.url : "");
    reportVideoCandidate(reqUrl, false);
    const p = origFetch.apply(this, arguments);
    if (p && typeof p.then === "function") {
      p.then((res) => {
        try {
          if (res && res.headers) {
            const ct = res.headers.get("content-type") || "";
            if (videoMimeRegex.test(ct)) {
              reportVideoCandidate(res.url || reqUrl, true);
            }
          }
        } catch (e) {}
      }).catch(() => {});
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
        if (shouldBlockDestination(destUrl, recentGesture)) {
          if (event.cancelable) {
            event.preventDefault();
            nukeTimers();
            emitBlocked(destUrl, "redirect");
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

    if (!resolved || shouldBlockDestination(resolved, recentGesture)) {
      emitBlocked(resolved || location.href, "popup");
      return null;
    }
    return origOpen.apply(this, arguments);
  }, origOpen);

  const origAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function() {
    try {
      const href = this.getAttribute("href") || this.href || "";
      const recentGesture = (Date.now() - window.__AEGIS_LAST_USER_CLICK__) < 1800;
      if (href && shouldBlockDestination(href, recentGesture)) {
        const abs = new URL(href, location.href).href;
        emitBlocked(abs, this.target === "_blank" ? "popup" : "redirect");
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

  function has5to30CountdownOnPage() {
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
      !legitCommunityHostRegex.test(curHost) &&
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
      !legitCommunityHostRegex.test(curHost) &&
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
