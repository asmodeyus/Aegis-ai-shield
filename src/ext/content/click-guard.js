// @ts-check
/**
 * AEGIS-AI Shield v3.2.1 — AI Smart UGC Classifier, Trusted Auth & Media-Tap Gesture Guard,
 * Click Guard, Throttled Overlay Cleaner & Malicious Meta-Refresh / Iframe Neutralizer
 */
import {
  AD_SLOT_CLASS_ID_REGEX,
  DISGUISED_AD_CLASS_REGEX,
  SAFE_MEDIA_HOST_REGEX,
  SUSPICIOUS_TLD,
  TIMINGS
} from "../shared/constants.js";
import { isCaptchaChallengeUrl } from "../shared/captcha-guard.js";
import { safeTry } from "../shared/debug.js";
import { getBaseDomain, getHostname, isSameSafeEcosystem } from "../shared/domain-utils.js";
import { isShortlinkCtaCandidate } from "../shared/shortlink-decoder.js";
import {
  hasSpecificGamblingHostname,
  isAuthFlowUrl,
  isHardMaliciousUrl,
  isSearchEngineHijackUrl
} from "../shared/url-classifier.js";
import { enqueueManualPrompt } from "./hud-manager.js";
import { signalShortlinkCtaClick } from "./shortlink-bypass.js";
import {
  isTempAllowActiveHere,
  isUrlInDeniedList,
  isUrlInTrustedList,
  logAegisEvent,
  runtimeState
} from "./state.js";

const AUTH_GESTURE_TEXT_REGEX =
  /(sign\s*in|log\s*in|masuk|daftar|register|continue\s*with|lanjutkan\s*dengan|google|github|apple|microsoft|facebook|sso|oauth|verify|verifikasi|otp|2fa|two.?factor)/i;

let lastOverlaySweepTs = 0;
const checkedTrapOverlays = new WeakSet();
const neutralizedIframes = new WeakSet();

function hasDisguisedAdCssClass(el) {
  let cur = el;
  for (let depth = 0; cur && depth < 4; depth++) {
    const sig = `${cur.id || ""} ${typeof cur.className === "string" ? cur.className : ""}`;
    if (DISGUISED_AD_CLASS_REGEX.test(sig)) return true;
    cur = cur.parentElement;
  }
  return false;
}

function isRealAdSlotContainer(el) {
  let cur = el;
  for (let depth = 0; cur && depth < 6; depth++) {
    const sig = `${cur.id || ""} ${typeof cur.className === "string" ? cur.className : ""}`;
    if (AD_SLOT_CLASS_ID_REGEX.test(sig)) return true;
    cur = cur.parentElement;
  }
  return false;
}

function isInsideUserPostContent(el) {
  if (!el || !el.closest) return false;
  return Boolean(
    el.closest(
      ".bbWrapper, .message-body, .message-content, article, .post-content, .entry-content, .comment-body, .thread-content, [data-testid='post-container']"
    )
  );
}

/**
 * Classify a clicked anchor/image element using AI Smart UGC rules.
 * @param {HTMLAnchorElement} anchorEl
 * @param {string} rawHref
 * @returns {{ action: "allow" | "hold_hud" | "silent_block", resolvedUrl: string, reason: string }}
 */
export function classifyContentLinkOrImage(anchorEl, rawHref) {
  if (!rawHref) return { action: "allow", resolvedUrl: "", reason: "empty_href" };
  const resolved = safeTry("clickGuard.resolveUrl", () => new URL(rawHref, location.href), null);
  if (!resolved) {
    return { action: "allow", resolvedUrl: rawHref, reason: "invalid_url" };
  }
  if (!resolved.protocol.startsWith("http")) {
    return { action: "allow", resolvedUrl: resolved.href, reason: "non_http" };
  }

  const destUrl = resolved.href;
  const curHost = location.hostname.toLowerCase();
  const destHost = resolved.hostname.toLowerCase();

  // 1. Explicit Blacklist -> Silent Block (never HUD)
  if (isUrlInDeniedList(destUrl)) {
    return { action: "silent_block", resolvedUrl: destUrl, reason: "Domain Blacklist diblokir senyap" };
  }

  // 2. Search Engine Hijack trap (e.g., shortlink/ad site hijacking user to Google/Bing search)
  if (!isTempAllowActiveHere() && isSearchEngineHijackUrl(destUrl, location.href)) {
    return {
      action: "hold_hud",
      resolvedUrl: destUrl,
      reason: "Search Hijack (alihan paksa mesin pencari) ditahan"
    };
  }

  // 3. Temporary Allow / Whitelist / Same base domain / Safe ecosystem / P2 Auth flow -> Direct Allow
  if (
    isTempAllowActiveHere() ||
    isUrlInTrustedList(destUrl) ||
    getBaseDomain(destHost) === getBaseDomain(curHost) ||
    isSameSafeEcosystem(curHost, destHost) ||
    (isAuthFlowUrl(destUrl) && !hasSpecificGamblingHostname(destUrl))
  ) {
    return { action: "allow", resolvedUrl: destUrl, reason: "trusted_or_same_domain" };
  }

  const disguisedAd = hasDisguisedAdCssClass(anchorEl);
  const inAdSlot = isRealAdSlotContainer(anchorEl);
  const hardMalicious = isHardMaliciousUrl(destUrl, runtimeState.deniedDomains);

  // 4. Hard malicious / disguised ad CSS class / real ad slot -> Hold in HUD
  if (hardMalicious || disguisedAd || inAdSlot) {
    return {
      action: "hold_hud",
      resolvedUrl: destUrl,
      reason: disguisedAd
        ? "Elemen iklan terselubung (CSS/shortener) ditahan"
        : "Tautan iklan/affiliate/judol ditahan"
    };
  }

  // 5. Smart UGC Sense: Safe media host inside user post opens directly even with anti-adblock bait classes
  if (runtimeState.globalSettings.smartUgcSense !== false && SAFE_MEDIA_HOST_REGEX.test(destHost)) {
    return { action: "allow", resolvedUrl: destUrl, reason: "safe_ugc_media_host" };
  }

  // 6. Suspicious TLD (.click, .top, etc.) -> Hold in HUD so user can decide
  if (SUSPICIOUS_TLD.test(destHost)) {
    const insideUgc = isInsideUserPostContent(anchorEl);
    return {
      action: "hold_hud",
      resolvedUrl: destUrl,
      reason: insideUgc
        ? "Konten eksternal (.click/.top) ditahan — Pilih ↗ Buka jika aman"
        : "Domain TLD mencurigakan ditahan"
    };
  }

  // 7. Balanced vs Strict mode
  const isStrict =
    runtimeState.globalSettings.protectionMode === "strict" ||
    (runtimeState.globalSettings.protectionMode !== "balanced" && runtimeState.strictCrossOrigin);
  if (isStrict) {
    return {
      action: "hold_hud",
      resolvedUrl: destUrl,
      reason: "Lintas-domain (Mode Strict) ditahan"
    };
  }

  return { action: "allow", resolvedUrl: destUrl, reason: "balanced_user_click_allowed" };
}

/**
 * Check whether an element is a fullscreen empty trap overlay (e.g. <div id="overlay" style="display:flex"></div>)
 * while strictly preserving legitimate modals (role="dialog", aria-modal="true", or interactive children).
 * @param {HTMLElement} el
 * @returns {boolean}
 */
export function isEmptyFullscreenTrapOverlay(el) {
  if (!el || el.nodeType !== 1) return false;
  if (
    el.id === "aegis-top-manual-hud" ||
    el.id === "aegis-video-bottom-dock" ||
    el.id === "aegis-bypass-toast-host" ||
    el.id === "aegis-mini-pip-drag-bar"
  ) {
    return false;
  }
  const role = (el.getAttribute("role") || "").toLowerCase();
  if (role === "dialog" || role === "alertdialog" || el.getAttribute("aria-modal") === "true") {
    return false;
  }
  if ((el.innerText || "").trim().length > 0) return false;
  if (el.querySelector("a, button, input, select, textarea, video, iframe, canvas, form")) {
    return false;
  }
  const style = window.getComputedStyle(el);
  if (!style || style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") {
    return false;
  }
  if (style.position !== "fixed" && style.position !== "absolute") return false;
  const rect = el.getBoundingClientRect();
  const vw = Math.max(window.innerWidth || 1, 1);
  const vh = Math.max(window.innerHeight || 1, 1);
  if (rect.width / vw < 0.72 || rect.height / vh < 0.65) return false;

  const bg = (style.backgroundColor || "").toLowerCase();
  const opacity = Number(style.opacity);
  return (
    opacity <= 0.15 ||
    bg === "transparent" ||
    bg === "rgba(0, 0, 0, 0)" ||
    el.id.toLowerCase() === "overlay"
  );
}

/**
 * Throttled trap overlay cleaner with WeakSet cache + element cap to prevent layout thrashing on large DOMs.
 */
export function neutralizeEmptyTrapOverlays() {
  if (
    runtimeState.globalSettings.removeTransparentOverlay === false ||
    runtimeState.captchaDetected ||
    isTempAllowActiveHere() ||
    isUrlInTrustedList(location.href)
  ) {
    return;
  }
  const now = Date.now();
  if (now - lastOverlaySweepTs < TIMINGS.OVERLAY_SWEEP_THROTTLE_MS) return;
  lastOverlaySweepTs = now;

  safeTry("clickGuard.neutralizeOverlays", () => {
    const candidates = document.querySelectorAll(
      "div#overlay, div[class*='overlay'], div[id*='overlay'], div[style*='position: fixed'], div[style*='position:fixed']"
    );
    let inspected = 0;
    for (const node of candidates) {
      if (inspected >= 25) break;
      const el = /** @type {HTMLElement} */ (node);
      if (checkedTrapOverlays.has(el)) continue;
      inspected += 1;
      if (isEmptyFullscreenTrapOverlay(el)) {
        checkedTrapOverlays.add(el);
        el.style.pointerEvents = "none";
        el.style.display = "none";
        logAegisEvent(
          "BYPASS",
          "BYPASS_TRAP_OVERLAY",
          location.href,
          `Overlay jebakan transparan (${el.id || el.className || "div"}) dinonaktifkan`
        );
      }
    }
  });
}

/**
 * Neutralize malicious <meta http-equiv="refresh"> tags and hidden malicious redirect iframes
 * pointing to blacklisted, gambling/affiliate, or search-hijack destinations.
 */
export function neutralizeMaliciousMetaRefreshAndIframes() {
  if (runtimeState.captchaDetected || isTempAllowActiveHere() || isUrlInTrustedList(location.href)) {
    return;
  }

  safeTry("clickGuard.metaAndIframeGuard", () => {
    // 1. Meta refresh guard
    const metas = document.querySelectorAll("meta[http-equiv='refresh' i][content]");
    metas.forEach((meta) => {
      const content = meta.getAttribute("content") || "";
      const match = content.match(/url\s*=\s*['"]?(https?:\/\/[^'";\s]+)/i);
      if (!match || !match[1]) return;
      const targetUrl = match[1].trim();
      const denied = isUrlInDeniedList(targetUrl);
      const searchHijack = isSearchEngineHijackUrl(targetUrl, location.href);
      const malicious = isHardMaliciousUrl(targetUrl, runtimeState.deniedDomains);

      if (denied || searchHijack || malicious) {
        meta.remove();
        logAegisEvent(
          "BLOCK",
          denied ? "META_REFRESH_BLACKLIST" : "META_REFRESH_MALICIOUS",
          targetUrl,
          "Tag <meta http-equiv='refresh'> berbahaya dihapus sebelum redirect"
        );
        if (!denied) {
          enqueueManualPrompt({
            blockedUrl: targetUrl,
            message: searchHijack ? "Meta-Refresh Search Hijack ditahan" : "Meta-Refresh iklan/berbahaya ditahan",
            kind: "redirect"
          });
        }
      }
    });

    // 2. Hidden / zero-pixel malicious redirect iframe guard (never touches CAPTCHA iframes)
    const iframes = document.querySelectorAll("iframe[src]");
    let checked = 0;
    for (const node of iframes) {
      if (checked >= 20) break;
      const iframe = /** @type {HTMLIFrameElement} */ (node);
      if (neutralizedIframes.has(iframe)) continue;
      checked += 1;
      const src = iframe.getAttribute("src") || "";
      if (!src || !src.startsWith("http")) continue;
      if (isCaptchaChallengeUrl(src)) continue;

      const denied = isUrlInDeniedList(src);
      const malicious = isHardMaliciousUrl(src, runtimeState.deniedDomains);
      if (denied || malicious) {
        neutralizedIframes.add(iframe);
        iframe.removeAttribute("src");
        iframe.style.display = "none";
        logAegisEvent(
          "BLOCK",
          denied ? "IFRAME_BLACKLIST_BLOCK" : "IFRAME_MALICIOUS_BLOCK",
          src,
          "Iframe redirect/iklan berbahaya dinetralkan"
        );
      }
    }
  });
}

function signalTrustedAuthFlow() {
  runtimeState.lastTrustedAuthTs = Date.now();
  safeTry("clickGuard.signalAuth", () => {
    chrome.runtime.sendMessage({ type: "AUTH_FLOW_STARTED" });
  });
}

/**
 * Determine whether an isolated-world tap target is a video/audio element or player surface
 * (excluding real <a href> navigation links).
 * @param {HTMLElement | null} target
 * @returns {boolean}
 */
function isMediaTapTarget(target) {
  if (!target || !target.closest) return false;
  if (target.closest("a[href]")) return false;
  if (target.tagName === "VIDEO" || target.tagName === "AUDIO") return true;
  if (target.closest("video, audio")) return true;
  const area = target.closest(
    ".video-area, #videoArea, .video-wrapper, .video-container, .player-wrapper, .plyr, .video-js, .jwplayer"
  );
  return Boolean(area && area.querySelector("video, audio"));
}

function recordIsolatedGesture(ev) {
  if (!ev || !ev.isTrusted) return;
  const target = /** @type {HTMLElement | null} */ (ev.target);
  if (!target || !target.closest) return;
  const now = Date.now();
  if (isMediaTapTarget(target)) {
    runtimeState.lastTrustedMediaTapTs = now;
    return;
  }
  if (target.closest("a[href], button, input[type='submit'], [role='button']")) {
    runtimeState.lastTrustedLinkClickTs = now;
  }
}

export function attachClickGuardListener() {
  // Record genuine isolated-world gestures (pointerdown/touchstart) for P3 & Video-Tap Hijack re-validation
  document.addEventListener("pointerdown", recordIsolatedGesture, true);
  document.addEventListener("touchstart", recordIsolatedGesture, { capture: true, passive: true });

  // Trusted Auth Gesture Detection in ISOLATED world (pages cannot forge ev.isTrusted === true)
  document.addEventListener(
    "submit",
    (ev) => {
      if (!ev.isTrusted) return;
      runtimeState.lastTrustedLinkClickTs = Date.now();
      const form = /** @type {HTMLFormElement | null} */ (ev.target);
      if (!form || !form.querySelector) return;
      if (
        form.querySelector("input[type='password'], input[autocomplete*='one-time-code'], input[name*='otp' i]") ||
        isAuthFlowUrl(form.action || location.href)
      ) {
        signalTrustedAuthFlow();
      }
    },
    true
  );

  document.addEventListener(
    "keydown",
    (ev) => {
      if (!ev.isTrusted || ev.key !== "Enter") return;
      const target = /** @type {HTMLInputElement | null} */ (ev.target);
      if (target && target.tagName === "INPUT" && target.type === "password") {
        signalTrustedAuthFlow();
      }
    },
    true
  );

  document.addEventListener(
    "click",
    (ev) => {
      safeTry("clickGuard.onClick", () => {
        if (!ev.isTrusted) return;
        recordIsolatedGesture(ev);
        const target = /** @type {HTMLElement | null} */ (ev.target);
        if (!target || !target.closest) return;

        // Detect trusted user click on Login/OAuth/SSO button -> grant short auth grace window
        const interactive = /** @type {HTMLElement | null} */ (
          target.closest("a, button, input[type='submit'], [role='button']")
        );
        if (interactive) {
          const btnText = (
            interactive.innerText ||
            interactive.textContent ||
            interactive.getAttribute("aria-label") ||
            ""
          ).slice(0, 120);
          const hrefAttr = interactive.getAttribute("href") || "";
          if (
            AUTH_GESTURE_TEXT_REGEX.test(btnText) ||
            (hrefAttr && isAuthFlowUrl(hrefAttr)) ||
            (interactive.closest("form") && interactive.closest("form")?.querySelector("input[type='password']"))
          ) {
            signalTrustedAuthFlow();
          }
        }

        const anchor = /** @type {HTMLAnchorElement | null} */ (target.closest("a[href]"));
        if (!anchor) return;
        const rawHref = anchor.getAttribute("href") || "";
        if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("javascript:")) return;

        // Detect same-origin Shortlink CTA click (e.g., ?download=1&t=... "Go To Link") -> grant HTTP 302 grace
        const resolvedHost = getHostname(rawHref, location.href);
        if (resolvedHost && getBaseDomain(resolvedHost) === getBaseDomain(location.hostname)) {
          const cardText = anchor.closest(".card, main, section, body")?.textContent?.slice(0, 400) || "";
          if (
            isShortlinkCtaCandidate({
              rawHref,
              text: anchor.innerText || anchor.textContent || "",
              id: anchor.id || "",
              className: typeof anchor.className === "string" ? anchor.className : "",
              cardText,
              pageUrl: location.href,
              deniedList: runtimeState.deniedDomains
            })
          ) {
            signalShortlinkCtaClick(rawHref);
            return;
          }
        }

        const verdict = classifyContentLinkOrImage(anchor, rawHref);
        if (verdict.action === "allow") {
          chrome.runtime.sendMessage({ type: "ALLOW_USER_CONTENT_NAVIGATION", url: verdict.resolvedUrl });
          return;
        }

        ev.preventDefault();
        ev.stopPropagation();

        if (verdict.action === "silent_block") {
          logAegisEvent("BLOCK", "CLICK_BLACKLIST_SILENT", verdict.resolvedUrl, verdict.reason);
          return;
        }

        logAegisEvent("BLOCK", "CLICK_HOLD_HUD", verdict.resolvedUrl, verdict.reason);
        enqueueManualPrompt({
          blockedUrl: verdict.resolvedUrl,
          message: verdict.reason,
          kind: anchor.target === "_blank" ? "popup" : "redirect"
        });
      });
    },
    true
  );
}
