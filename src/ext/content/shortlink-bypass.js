// @ts-check
/**
 * AEGIS-AI Shield v3.2.1 — Smart Shortlink Bypass Debloated, Fake-CTA Scoring
 * & Reversible All-Frames CAPTCHA Kill-Switch (with automatic recovery when solved)
 */
import { TIMINGS } from "../shared/constants.js";
import { detectCaptchaState, isCaptchaChallengeUrl } from "../shared/captcha-guard.js";
import { safeTry } from "../shared/debug.js";
import { isSameSafeEcosystem } from "../shared/domain-utils.js";
import {
  extractDirectShortlinkFromInputs,
  scoreShortlinkButtonCandidate
} from "../shared/shortlink-decoder.js";
import { showShortlinkBypassToast } from "./hud-manager.js";
import {
  clearLocalCaptchaKillSwitch,
  isTempAllowActiveHere,
  isUrlInTrustedList,
  logAegisEvent,
  runtimeState,
  signalShortlinkCtaToMainWorld,
  triggerLocalCaptchaKillSwitch
} from "./state.js";

let earlyBypassExecuted = false;
let lastAutoStepTs = 0;
let captchaBroadcastSent = false;
let captchaRecoveryTimer = null;

function stopCaptchaRecoveryMonitor() {
  if (captchaRecoveryTimer !== null) {
    clearInterval(captchaRecoveryTimer);
    captchaRecoveryTimer = null;
  }
}

function startCaptchaRecoveryMonitor() {
  if (captchaRecoveryTimer !== null) return;
  captchaRecoveryTimer = setInterval(() => {
    if (document.hidden) return;
    if (!runtimeState.captchaDetected && !captchaBroadcastSent) {
      stopCaptchaRecoveryMonitor();
      return;
    }
    const st = detectCaptchaState(document);
    if (!st.active) {
      stopCaptchaRecoveryMonitor();
      captchaBroadcastSent = false;
      clearLocalCaptchaKillSwitch();
      safeTry("shortlink.broadcastCaptchaCleared", () => {
        chrome.runtime.sendMessage({ type: "CAPTCHA_CLEARED_IN_FRAME" });
      });
      logAegisEvent(
        "ALLOW",
        "CAPTCHA_RECOVERED",
        location.href,
        st.solved
          ? "CAPTCHA telah diselesaikan -> proteksi AEGIS aktif kembali"
          : "Widget CAPTCHA tidak lagi aktif -> proteksi AEGIS aktif kembali"
      );
    }
  }, TIMINGS.CAPTCHA_RECOVERY_POLL_MS);
}

export function isShortlinkBypassAllowedHere() {
  if (window !== window.top) return false;
  if (runtimeState.globalSettings.shortlinkBypassEnabled === false) return false;
  if (isTempAllowActiveHere()) return false;
  if (runtimeState.captchaDetected || isCaptchaChallengeUrl(location.href)) return false;
  const host = (location.hostname || "").toLowerCase();
  if (!host || isSameSafeEcosystem(host, host) || isUrlInTrustedList(location.href)) return false;
  return true;
}

/**
 * Detect active unsolved CAPTCHA/Turnstile/hCaptcha/Arkose in ANY frame (top frame OR iframe),
 * activate all-frames kill-switch, and monitor for safe recovery once solved/removed.
 * @returns {boolean}
 */
export function checkAndBroadcastCaptchaStatus() {
  if (runtimeState.globalSettings.captchaKillSwitchEnabled === false) {
    if (runtimeState.captchaDetected) {
      stopCaptchaRecoveryMonitor();
      captchaBroadcastSent = false;
      clearLocalCaptchaKillSwitch();
    }
    return false;
  }

  const st = detectCaptchaState(document);
  if (st.active) {
    triggerLocalCaptchaKillSwitch();
    startCaptchaRecoveryMonitor();
    if (!captchaBroadcastSent) {
      captchaBroadcastSent = true;
      safeTry("shortlink.broadcastCaptcha", () => {
        chrome.runtime.sendMessage({ type: "CAPTCHA_DETECTED_IN_FRAME" });
      });
      logAegisEvent(
        "ALLOW",
        "BYPASS_WAIT_CAPTCHA",
        location.href,
        `CAPTCHA (${st.provider || "widget"}) aktif -> kill-switch aktif sementara di semua frame`
      );
    }
    return true;
  }

  if (runtimeState.captchaDetected && captchaBroadcastSent) {
    stopCaptchaRecoveryMonitor();
    captchaBroadcastSent = false;
    clearLocalCaptchaKillSwitch();
    safeTry("shortlink.broadcastCaptchaCleared", () => {
      chrome.runtime.sendMessage({ type: "CAPTCHA_CLEARED_IN_FRAME" });
    });
  }

  return runtimeState.captchaDetected;
}

export function signalShortlinkCtaClick(hrefUrl) {
  if (runtimeState.captchaDetected) return;
  signalShortlinkCtaToMainWorld();
  safeTry("shortlink.signalCtaClick", () => {
    chrome.runtime.sendMessage({
      type: "USER_CLICKED_SHORTLINK_CTA",
      sourceUrl: location.href,
      href: hrefUrl ? String(hrefUrl) : ""
    });
  });
}

export function extractDirectShortlinkUrlFromPage() {
  const hiddenValues = [];
  safeTry("shortlink.readHiddenInputs", () => {
    if (document.forms.length > 0 || document.querySelector("input[type='hidden']")) {
      document
        .querySelectorAll(
          "input[name='newwpsafelink'], input[name='go'], input[name='linkr'], input[name='url'], input[name='data'], input[type='hidden'][value]"
        )
        .forEach((inp) => {
          const val = /** @type {HTMLInputElement} */ (inp).value || inp.getAttribute("value") || "";
          if (val && val.length >= 8 && val.length <= 2400) hiddenValues.push(val);
        });
    }
  });

  const metaEl = document.head
    ? document.head.querySelector("meta[http-equiv='refresh' i][content]")
    : document.querySelector("meta[http-equiv='refresh' i][content]");
  const metaRefreshContent = metaEl ? metaEl.getAttribute("content") || "" : "";

  return extractDirectShortlinkFromInputs({
    pageUrl: location.href,
    hiddenValues,
    metaRefreshContent,
    deniedList: runtimeState.deniedDomains
  });
}

/**
 * Attempt early direct (and multi-layer nested) URL extraction; displays isolated Toast (~800ms) before location.replace().
 * @returns {boolean}
 */
export function tryEarlyDirectShortlinkBypass() {
  if (earlyBypassExecuted || !isShortlinkBypassAllowedHere()) return false;
  if (checkAndBroadcastCaptchaStatus()) return false;

  const extracted = extractDirectShortlinkUrlFromPage();
  if (!extracted.found || !extracted.url) return false;

  earlyBypassExecuted = true;
  runtimeState.shortlinkBypassActionTaken = true;
  showShortlinkBypassToast(extracted.url, extracted.method);
  logAegisEvent(
    "BYPASS",
    `BYPASS_${extracted.method}`,
    extracted.url,
    `Bypass Shortlink Debloated melompati safelink (${extracted.method}${extracted.layers && extracted.layers > 1 ? `, ${extracted.layers} lapis` : ""})`
  );

  const startTs = Date.now();
  let redirected = false;
  const performReplace = () => {
    if (redirected) return;
    redirected = true;
    safeTry("shortlink.locationReplace", () => {
      location.replace(extracted.url);
    });
  };

  const safetyTimer = setTimeout(performReplace, TIMINGS.BYPASS_TOAST_MAX_WAIT_MS);
  safeTry(
    "shortlink.allowBypassNavMsg",
    () => {
      chrome.runtime.sendMessage(
        {
          type: "ALLOW_SHORTLINK_BYPASS_NAV",
          url: extracted.url,
          sourceUrl: location.href,
          method: extracted.method
        },
        (res) => {
          if (res && res.ok === false) {
            clearTimeout(safetyTimer);
            redirected = true;
            return;
          }
          const remaining = Math.max(0, TIMINGS.BYPASS_TOAST_MS - (Date.now() - startTs));
          setTimeout(() => {
            clearTimeout(safetyTimer);
            performReplace();
          }, remaining);
        }
      );
    },
    undefined
  );

  return true;
}

/**
 * Run automated AdLinkFly / WP Safelink step using CTA scoring to pick the highest-confidence
 * real button while skipping fake ad/affiliate/Google-Search buttons.
 * @returns {boolean}
 */
export function runShortlinkDebloatedBypassStep() {
  if (!isShortlinkBypassAllowedHere()) return false;
  if (runtimeState.globalSettings.shortlinkAutoClick !== true) return false;
  if (checkAndBroadcastCaptchaStatus()) return false;

  const now = Date.now();
  if (now - lastAutoStepTs < 1200) return false;

  let actionTaken = false;

  safeTry("shortlink.autoStep", () => {
    // 1. AdLinkFly form#go-link
    const goForm = /** @type {HTMLFormElement | null} */ (
      document.querySelector("form#go-link, form[action*='/links/go']")
    );
    if (goForm && goForm.dataset.aegisSubmitted !== "1") {
      const submitBtn = /** @type {HTMLButtonElement | null} */ (
        goForm.querySelector("button[type='submit'], input[type='submit'], a.get-link")
      );
      const isDisabled =
        submitBtn &&
        (submitBtn.disabled ||
          submitBtn.classList.contains("disabled") ||
          submitBtn.getAttribute("aria-disabled") === "true");
      if (!isDisabled) {
        goForm.dataset.aegisSubmitted = "1";
        lastAutoStepTs = now;
        runtimeState.shortlinkBypassActionTaken = true;
        actionTaken = true;
        signalShortlinkCtaClick(goForm.action || location.href);
        logAegisEvent(
          "BYPASS",
          "BYPASS_ADLINKFLY_FORM",
          goForm.action || location.href,
          "Auto-submit form AdLinkFly (form#go-link)"
        );
        if (submitBtn) submitBtn.click();
        else goForm.submit();
        return;
      }
    }

    // 2. Score all visible ready CTA buttons and pick the highest-scoring legitimate CTA
    const ctaCandidates = document.querySelectorAll(
      "a#babay, a.get-link, a#wpsafe-link, a.btn-download, a[href*='download='], a[href*='&t='], button.get-link"
    );
    const bodySnippet = document.body ? (document.body.innerText || "").slice(0, 500) : "";

    /** @type {{ el: HTMLElement, rawHref: string, score: number } | null} */
    let bestCandidate = null;

    for (const node of ctaCandidates) {
      const el = /** @type {HTMLElement} */ (node);
      if (el.dataset.aegisAutoClicked === "1") continue;
      if (el.offsetParent === null) continue;
      const isDisabled =
        /** @type {HTMLButtonElement} */ (el).disabled ||
        el.classList.contains("disabled") ||
        el.getAttribute("aria-disabled") === "true";
      if (isDisabled) continue;

      const rawHref = el.getAttribute("href") || "";
      const scored = scoreShortlinkButtonCandidate({
        rawHref,
        text: el.innerText || el.textContent || "",
        id: el.id || "",
        className: typeof el.className === "string" ? el.className : "",
        cardText: bodySnippet,
        pageUrl: location.href,
        deniedList: runtimeState.deniedDomains
      });

      if (scored.isFakeAd || scored.score < 4) continue;
      if (!bestCandidate || scored.score > bestCandidate.score) {
        bestCandidate = { el, rawHref, score: scored.score };
      }
    }

    if (bestCandidate) {
      bestCandidate.el.dataset.aegisAutoClicked = "1";
      lastAutoStepTs = now;
      runtimeState.shortlinkBypassActionTaken = true;
      actionTaken = true;
      signalShortlinkCtaClick(bestCandidate.rawHref || location.href);
      logAegisEvent(
        "BYPASS",
        "BYPASS_AUTO_CLICK_CTA",
        bestCandidate.rawHref || location.href,
        `Auto-klik CTA terverifikasi (score=${bestCandidate.score}, ${(bestCandidate.el.innerText || bestCandidate.el.id || "CTA").trim().slice(0, 40)})`
      );
      bestCandidate.el.click();
    }
  });

  return actionTaken;
}

export function cleanupShortlinkBypassLifecycle() {
  stopCaptchaRecoveryMonitor();
}
