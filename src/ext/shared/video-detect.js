// @ts-check
/**
 * AEGIS-AI Shield v3.2.2 — Pure Video Stream & Embed Iframe Detection Helpers
 */
import {
  AD_SLOT_CLASS_ID_REGEX,
  DISGUISED_AD_CLASS_REGEX,
  NON_VIDEO_ASSET_REGEX,
  VIDEO_EXT_REGEX,
  VIDEO_STREAM_HINT_REGEX
} from "./constants.js";

export const VIDEO_EMBED_URL_REGEX =
  /(\/(embed|e)\/[a-z0-9_-]{5,}|youtube(-nocookie)?\.com\/embed\/|player\.vimeo\.com\/video\/|dailymotion\.com\/embed\/|playmogo\.com\/|dood[a-z0-9-]*\.[a-z]+\/|abyss\.to\/|hydrax\.net\/|streamtape\.[a-z]+\/|filemoon\.[a-z]+\/|mixdrop\.[a-z]+\/|voe\.sx\/)/i;

const VIDEO_WRAPPER_HINT_REGEX =
  /\b(video[-_]?(wrapper|container|player|area|box)|player[-_]?(wrapper|container|box))\b/i;

const IFRAME_AD_HINT_REGEX =
  /\b(ad[-_]?banner|banner[-_]?ad|ad[-_]?frame|ads[-_]?box|ad[-_]?wrapper|sponsor(ed)?)\b/i;

/**
 * Check whether a URL is a direct video file or stream URL.
 * @param {string} urlStr
 * @param {boolean} [isConfirmedMime]
 * @returns {boolean}
 */
export function isVideoStreamUrl(urlStr, isConfirmedMime = false) {
  if (!urlStr) return false;
  const s = String(urlStr).trim();
  if (s.startsWith("data:") || s.startsWith("blob:") || s.startsWith("javascript:")) return false;
  if (NON_VIDEO_ASSET_REGEX.test(s)) return false;
  return Boolean(isConfirmedMime || VIDEO_EXT_REGEX.test(s) || VIDEO_STREAM_HINT_REGEX.test(s));
}

/**
 * Format a detected stream or embed URL into a non-empty, human-readable label
 * for the Floating Video Dock drawer list.
 * @param {string} urlStr
 * @returns {string}
 */
export function formatVideoStreamLabel(urlStr) {
  const safeUrl = String(urlStr || "").trim();
  if (!safeUrl) return "stream-video";
  try {
    const u = new URL(safeUrl);
    const host = u.hostname.replace(/^www\./i, "");
    const segs = u.pathname.split("/").filter(Boolean);
    const tail = segs.length > 0 ? segs[segs.length - 1] : "";
    if (tail) return `${host}/${tail}`.slice(0, 38);
    if (u.search) return `${host}${u.search}`.slice(0, 38);
    return host.slice(0, 38) || safeUrl.slice(0, 38);
  } catch {
    return (safeUrl.split("/").filter(Boolean).pop()?.split("?")[0] || safeUrl).slice(0, 38);
  }
}

/**
 * Guard against accidental/ghost clicks landing on newly expanded pill action buttons
 * (e.g., #vpFs Layar Penuh) immediately after tapping 🎬(N).
 * @param {number} nowTs
 * @param {number} guardUntilTs
 * @returns {boolean}
 */
export function shouldAcceptPillActionClick(nowTs, guardUntilTs) {
  return Number(nowTs) >= Number(guardUntilTs || 0);
}

/**
 * Determine whether an <iframe> element is a legitimate visible video player embed
 * (and NOT an ad banner, hidden tracker, blacklisted host, or CAPTCHA frame).
 * @param {{
 *   src?: string,
 *   width?: number,
 *   height?: number,
 *   visible?: boolean,
 *   allowfullscreen?: boolean,
 *   allow?: string,
 *   id?: string,
 *   className?: string,
 *   parentSig?: string,
 *   isDenied?: boolean,
 *   isHardMalicious?: boolean,
 *   isCaptcha?: boolean
 * }} info
 * @returns {boolean}
 */
export function isVideoEmbedIframeCandidate(info) {
  if (!info || !info.src) return false;
  const src = String(info.src).trim();
  if (!/^https?:\/\//i.test(src)) return false;
  if (info.isDenied || info.isHardMalicious || info.isCaptcha) return false;
  if (info.visible === false) return false;
  if (Number(info.width) < 220 || Number(info.height) < 120) return false;

  const sig = `${info.id || ""} ${info.className || ""} ${info.parentSig || ""}`;
  if (
    AD_SLOT_CLASS_ID_REGEX.test(sig) ||
    DISGUISED_AD_CLASS_REGEX.test(sig) ||
    IFRAME_AD_HINT_REGEX.test(sig)
  ) {
    return false;
  }

  if (VIDEO_EMBED_URL_REGEX.test(src)) return true;

  const hasFullscreen = Boolean(info.allowfullscreen || /fullscreen/i.test(info.allow || ""));
  return Boolean(hasFullscreen && VIDEO_WRAPPER_HINT_REGEX.test(info.parentSig || ""));
}
