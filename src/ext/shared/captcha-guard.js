// @ts-check
/**
 * AEGIS-AI Shield v3.2.0 — Precision CAPTCHA / Anti-Bot Challenge Guard with State Recovery
 * Accurately detects visible, unsolved CAPTCHA widgets while ignoring invisible reCAPTCHA v3
 * badges and normal site forms, and reports resolution so protection can safely re-engage.
 */
import { CHALLENGE_HOST_REGEX } from "./constants.js";
import { safeTry } from "./debug.js";

export const CAPTCHA_DOM_SELECTORS = [
  "iframe[src*='recaptcha']",
  "iframe[src*='hcaptcha']",
  "iframe[src*='challenges.cloudflare.com']",
  "iframe[src*='turnstile']",
  "iframe[src*='arkoselabs']",
  "iframe[src*='funcaptcha']",
  "iframe[src*='captcha-delivery.com']",
  "iframe[src*='datadome']",
  "iframe[src*='perimeterx']",
  "script[src*='/cdn-cgi/challenge-platform/']",
  ".g-recaptcha",
  ".h-captcha",
  ".cf-turnstile",
  "#cf-turnstile",
  "#px-captcha",
  "#arkose",
  "[data-arkose]",
  "[data-hcaptcha-widget-id]",
  "[data-sitekey]",
  "[name='cf-turnstile-response']",
  "textarea[name='h-captcha-response']",
  "textarea[name='g-recaptcha-response']"
].join(", ");

/**
 * Determine if a URL is a known CAPTCHA or anti-bot interstitial challenge page.
 * @param {string} urlStr
 * @returns {boolean}
 */
export function isCaptchaChallengeUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") return false;
  return safeTry(
    "cg.u",
    () => {
      const u = new URL(urlStr);
      if (u.protocol !== "http:" && u.protocol !== "https:") return false;
      const host = u.hostname.toLowerCase();
      if (CHALLENGE_HOST_REGEX.test(host)) return true;
      const pathAndQuery = (u.pathname + u.search).toLowerCase();
      if (
        pathAndQuery.includes("/cdn-cgi/challenge-platform/") ||
        pathAndQuery.includes("__cf_chl_tk=") ||
        pathAndQuery.includes("__cf_chl_rt_tk=") ||
        pathAndQuery.includes("__cf_chl_f_tk=") ||
        pathAndQuery.includes("/recaptcha/api2/") ||
        pathAndQuery.includes("/recaptcha/enterprise/") ||
        pathAndQuery.includes("/hcaptcha") ||
        pathAndQuery.includes("/fc/gc/")
      ) {
        return true;
      }
      return false;
    },
    false
  );
}

/**
 * Determine whether an element is visually hidden or an invisible reCAPTCHA v3 badge.
 * @param {any} el
 * @returns {boolean}
 */
function isHiddenOrInvisibleCaptchaBadge(el) {
  if (!el) return true;
  const cls = typeof el.className === "string" ? el.className.toLowerCase() : "";
  if (cls.includes("grecaptcha-badge")) return true;
  if (typeof el.closest === "function" && el.closest(".grecaptcha-badge")) return true;
  if (typeof el.getAttribute === "function") {
    const size = (el.getAttribute("data-size") || "").toLowerCase();
    if (size === "invisible") return true;
  }
  if (typeof window !== "undefined" && typeof window.getComputedStyle === "function" && el.nodeType === 1) {
    const st = window.getComputedStyle(el);
    if (st && (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0)) {
      return true;
    }
  }
  return false;
}

/**
 * Inspect the document and return detailed CAPTCHA state (active, solved, provider).
 * Distinguishes active unsolved interactive challenges from normal site forms or solved widgets.
 * @param {Document | any} [doc]
 * @returns {{ active: boolean, solved: boolean, provider: string }}
 */
export function detectCaptchaState(doc) {
  if (!doc) return { active: false, solved: false, provider: "" };
  return safeTry(
    "cg.d",
    () => {
      if (doc.location && isCaptchaChallengeUrl(doc.location.href)) {
        return { active: true, solved: false, provider: "challenge_url" };
      }
      if (typeof window !== "undefined" && /** @type {any} */ (window)._cf_chl_opt) {
        return { active: true, solved: false, provider: "cloudflare_chl" };
      }

      if (typeof doc.querySelectorAll !== "function") {
        return { active: false, solved: false, provider: "" };
      }

      const widgets = doc.querySelectorAll(CAPTCHA_DOM_SELECTORS);
      let sawSolvedWidget = false;

      for (const el of widgets) {
        const tag = String(el.tagName || "").toUpperCase();

        // Active Cloudflare challenge interstitial script
        if (tag === "SCRIPT") {
          const src = (typeof el.getAttribute === "function" ? el.getAttribute("src") : "") || "";
          if (!src || src.includes("/cdn-cgi/challenge-platform/")) {
            return { active: true, solved: false, provider: "cloudflare_script" };
          }
          continue;
        }

        // Hidden response fields: only count as active if paired with a visible widget or unsolved challenge
        if (tag === "INPUT" || tag === "TEXTAREA") {
          const name = (typeof el.getAttribute === "function" ? el.getAttribute("name") : "") || "";
          if (
            name === "cf-turnstile-response" ||
            name === "h-captcha-response" ||
            name === "g-recaptcha-response"
          ) {
            const val = String(/** @type {HTMLInputElement} */ (el).value || "").trim();
            if (val.length > 10) {
              sawSolvedWidget = true;
              continue;
            }
            // Only treat an empty response field as active if its container is not an invisible badge
            const parent = el.parentElement;
            if (parent && isHiddenOrInvisibleCaptchaBadge(parent)) continue;
            // Require a visible parent container if getBoundingClientRect exists
            if (parent && typeof parent.getBoundingClientRect === "function") {
              const pr = parent.getBoundingClientRect();
              if (pr.width < 20 && pr.height < 20) continue;
            }
            return { active: true, solved: false, provider: name };
          }
          continue;
        }

        if (isHiddenOrInvisibleCaptchaBadge(el)) continue;

        // Avoid false positives on arbitrary non-CAPTCHA [data-sitekey] elements
        const hasSiteKeyOnly =
          typeof el.getAttribute === "function" &&
          Boolean(el.getAttribute("data-sitekey")) &&
          tag !== "IFRAME";
        if (hasSiteKeyOnly) {
          const sig = `${el.id || ""} ${typeof el.className === "string" ? el.className : ""}`.toLowerCase();
          const hasCaptchaHint = /(captcha|turnstile|arkose|challenge|verify|cf-)/i.test(sig);
          const hasCaptchaChild =
            typeof el.querySelector === "function" &&
            Boolean(
              el.querySelector(
                "iframe[src*='captcha'], iframe[src*='turnstile'], textarea[name*='captcha'], input[name*='turnstile']"
              )
            );
          if (!hasCaptchaHint && !hasCaptchaChild) continue;
        }

        const rect = typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;
        if (!rect || rect.width < 20 || rect.height < 20) continue;

        const responseField =
          typeof el.querySelector === "function" &&
          el.querySelector(
            "textarea[name='g-recaptcha-response'], textarea[name='h-captcha-response'], input[name='cf-turnstile-response']"
          );
        if (
          responseField &&
          /** @type {HTMLTextAreaElement} */ (responseField).value &&
          /** @type {HTMLTextAreaElement} */ (responseField).value.trim().length > 10
        ) {
          sawSolvedWidget = true;
          continue;
        }

        return { active: true, solved: false, provider: tag === "IFRAME" ? "captcha_iframe" : "captcha_widget" };
      }

      return { active: false, solved: sawSolvedWidget, provider: "" };
    },
    { active: false, solved: false, provider: "" }
  );
}

/**
 * Boolean convenience wrapper for checking if an active unsolved CAPTCHA is present.
 * @param {Document | any} [doc]
 * @returns {boolean}
 */
export function hasVisibleCaptchaInDocument(doc) {
  return detectCaptchaState(doc).active;
}
