// @ts-check
/**
 * AEGIS-AI Shield v3.2.3 — Anti-Anti-Adblock Modal Classifier & Guard
 * Pure decision logic shared between isolated content scripts, unit tests, and the sandbox UI.
 */

const VENDOR_HREF_REGEX = /(antiadblockcore\.com|blockadblock\.com|getadmiral\.com|fuckadblock)/i;
const VENDOR_TEXT_REGEX = /powered\s+by\s+antiadblock\s*core/i;

const PRIMARY_ADBLOCK_MSG_REGEX =
  /\b(ad\s*blocker|adblock(er)?|pemblokir\s+iklan)\s+(detected|terdeteksi|active|aktif|enabled)\b|please\s+(disable|turn\s+off|pause)\s+(your\s+)?(ad\s*blocker|adblock(er)?)|disable\s+(your\s+)?(ad\s*blocker|adblock(er)?)\s+(for|on)\s+this\s+(site|domain|page)|we\s+rely\s+on\s+ads\s+to\s+keep|(matikan|nonaktifkan)\s+(ad\s*block(er)?|pemblokir\s+iklan)/i;

const SECONDARY_ADBLOCK_SIGNAL_REGEX =
  /(how\s+to\s+disable\s+(your\s+)?ad\s*blocker|ublock\s+origin|adblock\s+plus|adguard|brave\s+shields?|shields\s+down|i['’]?ve\s+disabled\s+it|whitelist\s+this\s+site|pause\s+on\s+this\s+site|reload\s+page|muat\s+ulang\s+halaman)/i;

const CONSENT_BANNER_REGEX =
  /(cookie\s*(policy|settings|preferences|consent)|gdpr|ccpa|we\s+value\s+your\s+privacy|manage\s+consent|accept\s+all\s+cookies|kebijakan\s+privasi|kebijakan\s+cookie)/i;

const AEGIS_OWN_HOST_ID_REGEX =
  /^aegis-(top-manual-hud|video-bottom-dock|bypass-toast-host|mini-pip-drag-bar)$/i;

/**
 * Determine whether the Anti-Anti-Adblock neutralizer may execute in the current context.
 * Strictly disabled when toggled OFF or during Whitelist, Temp-Allow (Safe Mode), or CAPTCHA.
 * @param {{
 *   enabled?: boolean,
 *   isWhitelisted?: boolean,
 *   tempAllowActive?: boolean,
 *   captchaDetected?: boolean,
 *   isCaptchaUrl?: boolean
 * }} ctx
 * @returns {boolean}
 */
export function shouldRunAntiAdblockNeutralizer(ctx = {}) {
  if (ctx.enabled === false) return false;
  if (ctx.isWhitelisted) return false;
  if (ctx.tempAllowActive) return false;
  if (ctx.captchaDetected || ctx.isCaptchaUrl) return false;
  return true;
}

/**
 * Classify whether a visible overlay/modal is an Anti-Adblock wall while excluding
 * legitimate login dialogs, GDPR/cookie banners, CAPTCHA challenges, and media players.
 * @param {{
 *   id?: string,
 *   className?: string,
 *   role?: string,
 *   ariaModal?: boolean,
 *   tagName?: string,
 *   text?: string,
 *   linkHrefs?: string[],
 *   position?: string,
 *   display?: string,
 *   visibility?: string,
 *   pointerEvents?: string,
 *   widthRatio?: number,
 *   heightRatio?: number,
 *   zIndex?: number,
 *   hasPasswordInput?: boolean,
 *   hasCaptcha?: boolean,
 *   hasVideo?: boolean
 * }} input
 * @returns {{ isAntiAdblock: boolean, reason: string }}
 */
export function classifyAntiAdblockOverlay(input = {}) {
  const id = String(input.id || "");
  if (AEGIS_OWN_HOST_ID_REGEX.test(id)) {
    return { isAntiAdblock: false, reason: "aegis_own_ui" };
  }
  if (input.hasPasswordInput || input.hasCaptcha || input.hasVideo) {
    return { isAntiAdblock: false, reason: "protected_functional_modal" };
  }

  const display = String(input.display || "").toLowerCase();
  const visibility = String(input.visibility || "").toLowerCase();
  const pointerEvents = String(input.pointerEvents || "").toLowerCase();
  if (display === "none" || visibility === "hidden" || pointerEvents === "none") {
    return { isAntiAdblock: false, reason: "not_visible_or_non_blocking" };
  }

  const position = String(input.position || "").toLowerCase();
  if (position !== "fixed" && position !== "sticky") {
    return { isAntiAdblock: false, reason: "not_fixed_overlay" };
  }

  const widthRatio = Number(input.widthRatio) || 0;
  const heightRatio = Number(input.heightRatio) || 0;
  const zIndex = Number(input.zIndex) || 0;
  const role = String(input.role || "").toLowerCase();
  const isDialog = role === "dialog" || role === "alertdialog" || input.ariaModal === true;
  const isFullscreenBackdrop = widthRatio >= 0.72 && heightRatio >= 0.65;
  const isBlockingCard = widthRatio >= 0.28 && heightRatio >= 0.22 && zIndex >= 999;
  const isBlocking =
    isFullscreenBackdrop ||
    (isDialog && (widthRatio >= 0.25 || heightRatio >= 0.2 || zIndex >= 100)) ||
    isBlockingCard;

  if (!isBlocking) {
    return { isAntiAdblock: false, reason: "non_blocking_dimensions" };
  }

  const text = String(input.text || "").slice(0, 2500);
  if (!text.trim()) {
    return { isAntiAdblock: false, reason: "empty_text" };
  }

  const hasPrimary = PRIMARY_ADBLOCK_MSG_REGEX.test(text);
  const hrefs = Array.isArray(input.linkHrefs) ? input.linkHrefs.join(" ") : "";
  const hasVendor = VENDOR_HREF_REGEX.test(hrefs) || VENDOR_TEXT_REGEX.test(text);

  if (CONSENT_BANNER_REGEX.test(text) && !hasPrimary && !hasVendor) {
    return { isAntiAdblock: false, reason: "cookie_consent_excluded" };
  }

  const hasSecondary = SECONDARY_ADBLOCK_SIGNAL_REGEX.test(text);
  if (hasVendor && (hasPrimary || hasSecondary)) {
    return { isAntiAdblock: true, reason: "vendor_anti_adblock_modal" };
  }
  if (hasPrimary && (hasSecondary || isDialog || isFullscreenBackdrop)) {
    return { isAntiAdblock: true, reason: "multi_signal_anti_adblock_modal" };
  }

  return { isAntiAdblock: false, reason: "no_adblock_signature" };
}
