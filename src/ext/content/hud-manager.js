// @ts-check
/**
 * AEGIS-AI Shield v3.2.1 — Top Manual HUD & Shortlink Bypass Toast Manager
 * P3 Anti-Spoof & Anti-Flood Hardening:
 *  - Uses CLOSED Shadow DOM so page scripts cannot inspect or synthesize clicks inside HUD.
 *  - Requires ev.isTrusted === true on all HUD action buttons.
 *  - Makes "Buka Sekali" (allow once) the primary default action and requires explicit 2-step
 *    confirmation displaying the full exact domain before permanent Whitelist ("Trust").
 *  - Enforces per-minute (8/min) and per-page (20/page) HUD prompt rate limits.
 */
import { TIMINGS } from "../shared/constants.js";
import { safeTry } from "../shared/debug.js";
import { getHostname, normalizeDomainEntry } from "../shared/domain-utils.js";
import {
  attachPointerDrag,
  createSavedHudCoord,
  resolveSavedHudCoord,
  saveHudPosition
} from "./position-manager.js";
import {
  addDomainToBlacklist,
  addDomainToWhitelist,
  isUrlInDeniedList,
  isUrlInTrustedList,
  purgeBlacklistedOrTrustedPrompts,
  runtimeState
} from "./state.js";

const TOP_HUD_ID = "aegis-top-manual-hud";
const TOAST_ID = "aegis-bypass-toast-host";

/** Private closed ShadowRoot reference (inaccessible to webpage scripts) */
const closedHudRoots = new WeakMap();

let topHudHideTimer = null;

// P3: Per-minute & per-page HUD prompt budget (blocks malicious event flooding)
let hudPromptPageTotal = 0;
/** @type {number[]} */
let hudPromptMinuteTimestamps = [];

function canAcceptNewHudPrompt(now = Date.now()) {
  if (hudPromptPageTotal >= TIMINGS.HUD_MAX_PROMPTS_PER_PAGE) return false;
  hudPromptMinuteTimestamps = hudPromptMinuteTimestamps.filter((ts) => now - ts < 60000);
  return hudPromptMinuteTimestamps.length < TIMINGS.HUD_MAX_PROMPTS_PER_MIN;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Enqueue a blocked redirect/popup item for the Top Manual HUD (never for Blacklist/Whitelist).
 * Enforces P3 per-page and per-minute caps so flooded events cannot spam the UI.
 * @param {{ blockedUrl: string, message?: string, kind?: string }} item
 * @returns {boolean}
 */
export function enqueueManualPrompt(item) {
  if (!item || !item.blockedUrl) return false;
  if (isUrlInDeniedList(item.blockedUrl) || isUrlInTrustedList(item.blockedUrl)) return false;

  const exists = runtimeState.manualPromptQueue.some((p) => p.blockedUrl === item.blockedUrl);
  if (!exists) {
    const now = Date.now();
    if (!canAcceptNewHudPrompt(now)) return false;
    hudPromptPageTotal += 1;
    hudPromptMinuteTimestamps.push(now);

    runtimeState.manualPromptQueue.push({
      blockedUrl: item.blockedUrl,
      message: item.message || "Redirect/popup ditahan",
      kind: item.kind || "redirect"
    });
    if (runtimeState.manualPromptQueue.length > 6) {
      runtimeState.manualPromptQueue.shift();
    }
  }
  renderTopManualHUD();
  return true;
}

export function updateTopManualHudSavedPosition() {
  const host = document.getElementById(TOP_HUD_ID);
  if (!host) return;
  const saved = runtimeState.hudPositions.topHud;
  if (!saved) return;
  const rect = host.getBoundingClientRect();
  const resolved = resolveSavedHudCoord(saved, rect.width || 360, rect.height || 130, 8);
  if (resolved) {
    host.style.left = `${resolved.left}px`;
    host.style.top = `${resolved.top}px`;
    host.style.right = "auto";
    host.style.bottom = "auto";
    host.style.transform = `scale(${Number(runtimeState.globalSettings.hudScale) || 1.0})`;
  }
}

export function renderTopManualHUD() {
  if (window !== window.top) return;
  purgeBlacklistedOrTrustedPrompts();

  const existing = document.getElementById(TOP_HUD_ID);
  if (
    runtimeState.globalSettings.hudEnabled === false ||
    runtimeState.manualPromptQueue.length === 0
  ) {
    if (existing) existing.remove();
    clearTimeout(topHudHideTimer);
    return;
  }

  const current = runtimeState.manualPromptQueue[0];
  const fullHost = getHostname(current.blockedUrl) || current.blockedUrl;
  const trustDomain = normalizeDomainEntry(current.blockedUrl) || fullHost;
  const g = runtimeState.globalSettings;
  const hudScale = Math.max(0.75, Math.min(1.3, Number(g.hudScale) || 1.0));
  const hudOpacity = Math.max(0.5, Math.min(1.0, Number(g.hudOpacity) || 0.95));
  const hudDurationSec = Math.max(0, Math.min(15, Number(g.hudDurationSec ?? 4.5)));

  let hostEl = existing;
  if (!hostEl) {
    hostEl = document.createElement("div");
    hostEl.id = TOP_HUD_ID;
    hostEl.style.cssText =
      "position:fixed;z-index:2147483647;pointer-events:auto;max-width:calc(100vw - 16px);";
    (document.documentElement || document.body).appendChild(hostEl);
  }

  const saved = runtimeState.hudPositions.topHud;
  hostEl.style.opacity = String(hudOpacity);
  if (saved) {
    const resolved = resolveSavedHudCoord(saved, 360, 130, 8);
    hostEl.style.left = `${resolved ? resolved.left : 12}px`;
    hostEl.style.top = `${resolved ? resolved.top : 12}px`;
    hostEl.style.right = "auto";
    hostEl.style.bottom = "auto";
    hostEl.style.transformOrigin = "top left";
    hostEl.style.transform = `scale(${hudScale})`;
  } else {
    const preset = g.hudPosition || "top-center";
    hostEl.style.left = preset === "top-left" ? "12px" : preset === "top-right" ? "auto" : "50%";
    hostEl.style.right = preset === "top-right" ? "12px" : "auto";
    hostEl.style.top = preset === "bottom-center" ? "auto" : "12px";
    hostEl.style.bottom = preset === "bottom-center" ? "16px" : "auto";
    hostEl.style.transformOrigin =
      preset === "top-left"
        ? "top left"
        : preset === "top-right"
        ? "top right"
        : preset === "bottom-center"
        ? "bottom center"
        : "top center";
    hostEl.style.transform =
      preset === "top-left" || preset === "top-right"
        ? `scale(${hudScale})`
        : `translateX(-50%) scale(${hudScale})`;
  }

  let shadow = closedHudRoots.get(hostEl);
  if (!shadow) {
    shadow = hostEl.attachShadow({ mode: "closed" });
    closedHudRoots.set(hostEl, shadow);
  }

  const queueBadge =
    runtimeState.manualPromptQueue.length > 1
      ? `<span class="q-badge">1/${runtimeState.manualPromptQueue.length}</span>`
      : "";
  const timerBadge = `<span class="t-badge">⏱ ${hudDurationSec === 0 ? "∞" : hudDurationSec.toFixed(1) + "d"}</span>`;

  shadow.innerHTML = `<style>*{box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}.card{width:356px;max-width:calc(100vw - 16px);background:rgba(15,23,42,.96);color:#f8fafc;border:1px solid rgba(52,211,153,.45);border-radius:14px;padding:11px 12px;box-shadow:0 14px 36px rgba(0,0,0,.55);backdrop-filter:blur(10px)}.head{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:8px;cursor:grab;user-select:none;touch-action:none}.head:active{cursor:grabbing}.title-wrap{display:flex;align-items:center;gap:6px;min-width:0}.grip{color:#34d399;font-weight:800;font-size:13px}.msg{font-size:11.5px;font-weight:700;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.q-badge{font-size:10px;font-weight:700;color:#38bdf8;flex-shrink:0}.t-badge{font-size:9.5px;font-family:ui-monospace,monospace;font-weight:700;color:#6ee7b7;background:rgba(16,185,129,.16);border:1px solid rgba(16,185,129,.35);border-radius:4px;padding:1px 5px;flex-shrink:0}.close-btn{width:20px;height:20px;border-radius:999px;border:none;background:#1e293b;color:#94a3b8;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0}.close-btn:hover{background:#7f1d1d;color:#fecaca}.url-box{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#020617;border:1px solid #1e293b;border-radius:8px;padding:6px 8px;margin-bottom:8px}.host{font-family:ui-monospace,monospace;font-size:11px;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.detail-toggle{background:none;border:none;color:#38bdf8;font-size:10px;font-weight:700;cursor:pointer;flex-shrink:0}.full-url{display:none;font-family:ui-monospace,monospace;font-size:9.5px;color:#94a3b8;background:#020617;border:1px solid #1e293b;border-radius:6px;padding:6px;margin-bottom:8px;word-break:break-all;max-height:70px;overflow-y:auto}.full-url.open{display:block}.actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(70px,1fr));gap:5px}.btn{border:none;border-radius:8px;padding:6px;font-size:10.5px;font-weight:700;cursor:pointer;white-space:nowrap}.btn-open{background:#10b981;color:#022c22}.btn-group{background:#334155;color:#f8fafc}.btn-trust{background:#1e293b;color:#6ee7b7;border:1px solid rgba(52,211,153,.45)}.btn-block{background:rgba(127,29,29,.85);color:#fca5a5;border:1px solid rgba(239,68,68,.45)}.trust-confirm{display:none;margin-top:8px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.55);border-radius:8px;padding:7px 8px;font-size:10px;color:#fde68a}.trust-confirm.open{display:block}.trust-domain{font-family:ui-monospace,monospace;font-weight:800;color:#fff;word-break:break-all;display:block;margin:3px 0 6px}.confirm-row{display:grid;grid-template-columns:1fr auto;gap:5px}.btn-confirm-yes{background:#f59e0b;color:#0f172a;border:none;border-radius:6px;padding:5px 8px;font-size:10px;font-weight:800;cursor:pointer}.btn-confirm-no{background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:6px;padding:5px 8px;font-size:10px;font-weight:700;cursor:pointer}</style><div class="card"><div class="head" id="dragHead" title="Geser untuk memindahkan HUD"><div class="title-wrap"><span class="grip">⠿</span><span class="msg">${escapeHtml(current.message)}</span>${queueBadge}${timerBadge}</div><button class="close-btn" id="dismissBtn" title="Tutup">✕</button></div><div class="url-box"><span class="host" title="${escapeHtml(fullHost)}">${escapeHtml(fullHost)}</span>${g.hudShowUrlDetail !== false ? `<button class="detail-toggle" id="toggleUrlBtn">Detail URL ▼</button>` : ""}</div><div class="full-url" id="fullUrlBox">${escapeHtml(current.blockedUrl)}</div><div class="actions">${g.hudShowOpen !== false ? `<button class="btn btn-open" id="btnOpen">↗ Buka Sekali</button>` : ""}${g.hudShowGroup !== false ? `<button class="btn btn-group" id="btnGroup">⊞ Tab Grup</button>` : ""}${g.hudShowTrust !== false ? `<button class="btn btn-trust" id="btnTrust">✓ Trust...</button>` : ""}${g.hudShowBlock !== false ? `<button class="btn btn-block" id="btnBlock">🚫 Blokir</button>` : ""}</div><div class="trust-confirm" id="trustConfirmBox"><div>Tambahkan domain ini ke <strong>Whitelist permanen</strong>?</div><span class="trust-domain">${escapeHtml(trustDomain)}</span><div class="confirm-row"><button class="btn-confirm-yes" id="btnConfirmTrustYes">✓ Ya, Percayai Permanen</button><button class="btn-confirm-no" id="btnConfirmTrustNo">Batal</button></div></div></div>`;

  const advanceQueue = () => {
    runtimeState.manualPromptQueue.shift();
    renderTopManualHUD();
  };

  const resetHideTimer = () => {
    clearTimeout(topHudHideTimer);
    if (hudDurationSec > 0) {
      topHudHideTimer = setTimeout(() => {
        runtimeState.manualPromptQueue = [];
        const el = document.getElementById(TOP_HUD_ID);
        if (el) el.remove();
      }, hudDurationSec * 1000);
    }
  };

  // P3: Enforce ev.isTrusted === true on every HUD button so page scripts cannot synthesize clicks
  const dismissBtn = shadow.getElementById("dismissBtn");
  if (dismissBtn) {
    dismissBtn.addEventListener("click", (ev) => {
      if (!ev.isTrusted) return;
      advanceQueue();
    });
  }

  const toggleUrlBtn = shadow.getElementById("toggleUrlBtn");
  const fullUrlBox = shadow.getElementById("fullUrlBox");
  if (toggleUrlBtn && fullUrlBox) {
    toggleUrlBtn.addEventListener("click", (ev) => {
      if (!ev.isTrusted) return;
      const open = fullUrlBox.classList.toggle("open");
      toggleUrlBtn.textContent = open ? "Sembunyikan ▲" : "Detail URL ▼";
      if (open) clearTimeout(topHudHideTimer);
      else resetHideTimer();
    });
  }

  // Primary default action: Allow once (does NOT modify permanent Whitelist)
  const btnOpen = shadow.getElementById("btnOpen");
  if (btnOpen) {
    btnOpen.addEventListener("click", (ev) => {
      if (!ev.isTrusted) return;
      chrome.runtime.sendMessage({ type: "NAVIGATE_CURRENT_TAB", url: current.blockedUrl });
      advanceQueue();
    });
  }

  const btnGroup = shadow.getElementById("btnGroup");
  if (btnGroup) {
    btnGroup.addEventListener("click", (ev) => {
      if (!ev.isTrusted) return;
      chrome.runtime.sendMessage({ type: "OPEN_GROUP_TAB", url: current.blockedUrl });
      advanceQueue();
    });
  }

  // P3: Permanent Whitelist requires 2-step explicit confirmation showing the full exact domain
  const btnTrust = shadow.getElementById("btnTrust");
  const trustConfirmBox = shadow.getElementById("trustConfirmBox");
  const btnConfirmTrustYes = shadow.getElementById("btnConfirmTrustYes");
  const btnConfirmTrustNo = shadow.getElementById("btnConfirmTrustNo");
  if (btnTrust && trustConfirmBox) {
    btnTrust.addEventListener("click", (ev) => {
      if (!ev.isTrusted) return;
      const open = trustConfirmBox.classList.toggle("open");
      if (open) clearTimeout(topHudHideTimer);
      else resetHideTimer();
    });
  }
  if (btnConfirmTrustYes) {
    btnConfirmTrustYes.addEventListener("click", (ev) => {
      if (!ev.isTrusted) return;
      addDomainToWhitelist(current.blockedUrl, () => {
        chrome.runtime.sendMessage({ type: "NAVIGATE_CURRENT_TAB", url: current.blockedUrl });
      });
      advanceQueue();
    });
  }
  if (btnConfirmTrustNo && trustConfirmBox) {
    btnConfirmTrustNo.addEventListener("click", (ev) => {
      if (!ev.isTrusted) return;
      trustConfirmBox.classList.remove("open");
      resetHideTimer();
    });
  }

  const btnBlock = shadow.getElementById("btnBlock");
  if (btnBlock) {
    btnBlock.addEventListener("click", (ev) => {
      if (!ev.isTrusted) return;
      addDomainToBlacklist(current.blockedUrl, () => {
        purgeBlacklistedOrTrustedPrompts();
        renderTopManualHUD();
      });
    });
  }

  // Zero-leak pointer-capture drag on dragHead
  const dragHead = shadow.getElementById("dragHead");
  if (dragHead) {
    attachPointerDrag(dragHead, {
      targetEl: hostEl,
      margin: 8,
      requireTrusted: true,
      onStart: (_e, initLeft, initTop) => {
        hostEl.style.left = `${initLeft}px`;
        hostEl.style.top = `${initTop}px`;
        hostEl.style.right = "auto";
        hostEl.style.bottom = "auto";
        hostEl.style.transformOrigin = "top left";
        hostEl.style.transform = `scale(${hudScale})`;
      },
      onEnd: () => {
        const rect = hostEl.getBoundingClientRect();
        saveHudPosition("topHud", createSavedHudCoord(rect.left, rect.top, rect.width, rect.height, 8));
      }
    });
  }

  resetHideTimer();
}

/**
 * Show a brief, isolated closed Shadow DOM corner Toast before executing location.replace() on Safelink Bypass.
 * @param {string} targetUrl
 * @param {string} method
 */
export function showShortlinkBypassToast(targetUrl, method) {
  if (window !== window.top) return;
  safeTry("hud.showBypassToast", () => {
    const prev = document.getElementById(TOAST_ID);
    if (prev) prev.remove();

    const hostEl = document.createElement("div");
    hostEl.id = TOAST_ID;
    hostEl.style.cssText =
      "position:fixed;bottom:18px;right:18px;z-index:2147483647;pointer-events:none;";

    const targetHost = getHostname(targetUrl) || targetUrl.slice(0, 48);
    const shadow = hostEl.attachShadow({ mode: "closed" });
    shadow.innerHTML = `<style>.toast{display:flex;align-items:center;gap:10px;background:rgba(15,23,42,.96);border:1px solid rgba(52,211,153,.55);border-radius:12px;padding:10px 14px;box-shadow:0 12px 30px rgba(0,0,0,.5);backdrop-filter:blur(8px);font-family:system-ui,-apple-system,sans-serif;max-width:340px}.icon{width:28px;height:28px;border-radius:8px;background:rgba(16,185,129,.2);border:1px solid rgba(52,211,153,.4);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}.body{min-width:0}.title{font-size:12px;font-weight:800;color:#6ee7b7;line-height:1.25}.sub{font-size:10.5px;font-family:ui-monospace,monospace;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}</style><div class="toast"><div class="icon">⚡</div><div class="body"><div class="title">⚡ AEGIS Bypass: Melompati Safelink...</div><div class="sub">→ ${escapeHtml(targetHost)} (${escapeHtml(method || "DIRECT")})</div></div></div>`;
    (document.documentElement || document.body).appendChild(hostEl);
    setTimeout(() => {
      safeTry("hud.removeToast", () => hostEl.remove());
    }, TIMINGS.BYPASS_TOAST_MAX_WAIT_MS + 400);
  });
}
