// @ts-check
/**
 * AEGIS-AI Shield v3.2.3 — Isolated-World Anti-Anti-Adblock Modal Neutralizer
 * Detects and removes adblock-detection overlays (including randomized IDs like AntiAdBlock Core)
 * and restores page scroll lock without touching DropLink flow state or whitelisted/CAPTCHA pages.
 */
import {
  classifyAntiAdblockOverlay,
  shouldRunAntiAdblockNeutralizer
} from "../shared/anti-adblock.js";
import { isCaptchaChallengeUrl } from "../shared/captcha-guard.js";
import { safeTry } from "../shared/debug.js";
import {
  isSiteShieldBypassed,
  logAegisEvent,
  runtimeState
} from "./state.js";

let lastSweepTs = 0;
let unlockTimer = null;
/** @type {WeakMap<Element, string>} */
const inspectedCache = new WeakMap();

function canRunAntiAdblock() {
  return (
    !isSiteShieldBypassed() &&
    shouldRunAntiAdblockNeutralizer({
      enabled: runtimeState.globalSettings.antiAntiAdblock !== false,
      isCaptchaUrl: isCaptchaChallengeUrl(location.href)
    })
  );
}

function restorePageScrollLock() {
  safeTry("aa.s", () => {
    for (const node of [document.documentElement, document.body]) {
      if (!node) continue;
      const el = /** @type {HTMLElement} */ (node);
      if (el.style.overflow === "hidden") el.style.overflow = "";
      if (el.style.overflowY === "hidden") el.style.overflowY = "";
      if (el.style.pointerEvents === "none") el.style.pointerEvents = "";
      const cs = window.getComputedStyle(el);
      if (cs && cs.overflowY === "hidden") {
        el.style.setProperty("overflow-y", "auto", "important");
      }
    }
  });
}

function scheduleScrollUnlockFollowup() {
  clearTimeout(unlockTimer);
  unlockTimer = setTimeout(() => {
    unlockTimer = null;
    if (canRunAntiAdblock()) restorePageScrollLock();
  }, 450);
}

function resolveOutermostModalRoot(el, vw, vh) {
  let root = el;
  let cur = el.parentElement;
  for (let depth = 0; cur && depth < 4; depth++) {
    if (cur === document.body || cur === document.documentElement) break;
    if (cur.querySelector("video, form input[type='password']")) break;
    const cs = window.getComputedStyle(cur);
    const rect = cur.getBoundingClientRect();
    if (cs && cs.position === "fixed" && rect.width >= vw * 0.72 && rect.height >= vh * 0.65) {
      root = cur;
    }
    cur = cur.parentElement;
  }
  return root;
}

export function neutralizeAntiAdblockOverlays(force = false) {
  if (window !== window.top || !canRunAntiAdblock()) return false;

  const now = Date.now();
  if (!force && now - lastSweepTs < 550) return false;
  lastSweepTs = now;

  let neutralizedCount = 0;

  safeTry("aa.n", () => {
    const vw = Math.max(window.innerWidth || 1, 1);
    const vh = Math.max(window.innerHeight || 1, 1);
    /** @type {Set<HTMLElement>} */
    const candidates = new Set();

    const addCandidate = (node) => {
      if (node && node.nodeType === 1 && candidates.size < 25) {
        candidates.add(/** @type {HTMLElement} */ (node));
      }
    };

    document
      .querySelectorAll("[role='dialog'], [role='alertdialog'], [aria-modal='true'], a[href*='antiadblockcore']")
      .forEach((node) => {
        const el = /** @type {HTMLElement} */ (node);
        addCandidate(el.tagName === "A" ? el.closest("[role='dialog'], div[style*='fixed']") || el.parentElement : el);
      });

    for (const parent of [document.body, document.documentElement]) {
      if (!parent) continue;
      for (const child of parent.children) {
        if (child.nodeType !== 1) continue;
        const tag = child.tagName;
        if (tag === "DIV" || tag === "SECTION" || tag === "ASIDE" || tag === "DIALOG") {
          addCandidate(child);
        }
      }
    }

    for (const el of candidates) {
      if (!el.isConnected) continue;
      const text = (el.innerText || el.textContent || "").trim();
      const cacheKey = `${text.length}:${el.id || ""}`;
      if (inspectedCache.get(el) === cacheKey) continue;
      inspectedCache.set(el, cacheKey);

      const cs = window.getComputedStyle(el);
      if (!cs) continue;
      const rect = el.getBoundingClientRect();
      const hrefs = Array.from(el.querySelectorAll("a[href]"))
        .slice(0, 8)
        .map((a) => a.getAttribute("href") || "");

      const verdict = classifyAntiAdblockOverlay({
        id: el.id || "",
        className: typeof el.className === "string" ? el.className : "",
        role: el.getAttribute("role") || "",
        ariaModal: el.getAttribute("aria-modal") === "true",
        tagName: el.tagName,
        text,
        linkHrefs: hrefs,
        position: cs.position,
        display: cs.display,
        visibility: cs.visibility,
        pointerEvents: cs.pointerEvents,
        widthRatio: rect.width / vw,
        heightRatio: rect.height / vh,
        zIndex: Number.parseInt(cs.zIndex, 10) || 0,
        hasPasswordInput: Boolean(el.querySelector("input[type='password']")),
        hasCaptcha: Boolean(
          el.querySelector(
            ".cf-turnstile, .g-recaptcha, .h-captcha, #px-captcha, #arkose, iframe[src*='captcha'], iframe[src*='turnstile']"
          )
        ),
        hasVideo: Boolean(el.querySelector("video"))
      });

      if (!verdict.isAntiAdblock) continue;

      const targetRoot = resolveOutermostModalRoot(el, vw, vh);
      targetRoot.style.setProperty("display", "none", "important");
      targetRoot.style.setProperty("pointer-events", "none", "important");
      targetRoot.remove();
      neutralizedCount += 1;

      logAegisEvent(
        "BYPASS",
        "BYPASS_ANTI_ADBLOCK_MODAL",
        location.href,
        `Modal Anti-Adblock (#${targetRoot.id || el.id || "overlay"}) dinetralkan (${verdict.reason})`
      );
    }

    if (neutralizedCount > 0) {
      restorePageScrollLock();
      scheduleScrollUnlockFollowup();
    }
  });

  return neutralizedCount > 0;
}

export function cleanupAntiAdblockLifecycle() {
  clearTimeout(unlockTimer);
  unlockTimer = null;
}
