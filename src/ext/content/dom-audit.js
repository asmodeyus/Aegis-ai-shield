// @ts-check
/**
 * AEGIS-AI Shield v3.2.1 — AI DOM Audit v2 (Opt-In Assistant + Local Rule Fallback)
 * P5 Security Invariant:
 *  - Content scripts NEVER read geminiApiKey or access chrome.storage.session.
 *  - Sending candidate DOM summaries to background/Gemini is STRICTLY opt-in
 *    (globalSettings.geminiAuditEnabled === true, default OFF).
 *  - Local deterministic neutralization still runs offline with zero external calls.
 */
import { safeTry } from "../shared/debug.js";
import { pruneDomCandidatesForAudit } from "../shared/gemini-audit.js";
import { isSearchEngineHijackUrl } from "../shared/url-classifier.js";
import {
  isTempAllowActiveHere,
  isUrlInDeniedList,
  isUrlInTrustedList,
  logAegisEvent,
  runtimeState
} from "./state.js";

let auditAlreadyRan = false;

export function runAiDomAuditFallback() {
  if (auditAlreadyRan || window !== window.top) return;
  if (
    runtimeState.captchaDetected ||
    isTempAllowActiveHere() ||
    isUrlInTrustedList(location.href)
  ) {
    return;
  }

  // Quota Rule: skip Gemini API if opt-in shortlink auto-bypass already succeeded
  if (
    runtimeState.globalSettings.shortlinkAutoClick === true &&
    runtimeState.shortlinkBypassActionTaken
  ) {
    return;
  }

  auditAlreadyRan = true;

  safeTry("domAudit.collectAndAnalyze", () => {
    const els = Array.from(document.querySelectorAll("a[href], button")).slice(0, 60);
    const rawCandidates = els
      .map((el, index) => {
        const htmlEl = /** @type {HTMLElement} */ (el);
        if (htmlEl.offsetParent === null) return null;
        return {
          index,
          tag: el.tagName.toLowerCase(),
          text: (htmlEl.innerText || htmlEl.textContent || "").trim(),
          href: el.getAttribute("href") || "",
          id: el.id || "",
          cls: typeof htmlEl.className === "string" ? htmlEl.className : ""
        };
      })
      .filter(Boolean);

    const { pruned, localBlockedIndices, needsGeminiCall } = pruneDomCandidatesForAudit(
      /** @type {any[]} */ (rawCandidates),
      18
    );

    // Immediately neutralize locally-confirmed gambling/affiliate fake buttons without spending API quota
    for (const idx of localBlockedIndices) {
      const badEl = /** @type {HTMLElement | undefined} */ (els[idx]);
      if (badEl) {
        badEl.style.pointerEvents = "none";
        badEl.style.opacity = "0.25";
      }
    }

    // P5: Only contact background/Gemini when user has explicitly opted into AI DOM Audit
    if (runtimeState.globalSettings.geminiAuditEnabled !== true) return;
    if (!needsGeminiCall || pruned.length === 0) return;

    chrome.runtime.sendMessage(
      {
        type: "ANALYZE_CANDIDATES",
        payload: {
          title: document.title || "",
          pageUrl: location.href,
          candidates: pruned
        }
      },
      (res) => {
        if (document.hidden || runtimeState.captchaDetected) return;
        if (!res || !res.success || !res.data) return;
        const { realIndex, blockedIndices, source } = res.data;
        if (Array.isArray(blockedIndices)) {
          blockedIndices.forEach((idx) => {
            const badEl = /** @type {HTMLElement | undefined} */ (els[idx]);
            if (badEl) {
              badEl.style.pointerEvents = "none";
              badEl.style.opacity = "0.25";
            }
          });
        }
        if (typeof realIndex === "number" && realIndex >= 0 && els[realIndex]) {
          const realEl = /** @type {HTMLElement} */ (els[realIndex]);
          const targetHref = realEl.getAttribute("href") || "";
          // Final client-side defense-in-depth check before highlighting any AI-picked CTA
          if (targetHref && !targetHref.startsWith("#") && !targetHref.startsWith("javascript:")) {
            const absHref = safeTry("domAudit.resolveHref", () => new URL(targetHref, location.href).href, "");
            if (absHref && (isUrlInDeniedList(absHref) || isSearchEngineHijackUrl(absHref, location.href))) {
              return;
            }
          }
          realEl.style.outline = "2px solid #10b981";
          realEl.style.outlineOffset = "2px";
          logAegisEvent(
            "BYPASS",
            "AI_DOM_AUDIT_HIGHLIGHT",
            targetHref || location.href,
            `DOM Audit menandai tombol tujuan asli (source=${source || "gemini"}, index=${realIndex}, pruned=${pruned.length})`
          );
        }
      }
    );
  });
}
