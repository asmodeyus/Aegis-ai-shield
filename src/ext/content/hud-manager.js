// @ts-check
/**
 * AEGIS-AI Shield v3.2.3 — Top Manual HUD & Shortlink Bypass Toast Manager
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
      ? `<span class="qb">1/${runtimeState.manualPromptQueue.length}</span>`
      : "";
  const timerBadge = `<span class="tb">⏱ ${hudDurationSec === 0 ? "∞" : hudDurationSec.toFixed(1) + "d"}</span>`;

  shadow.innerHTML = `<style>*{box-sizing:border-box;font-family:system-ui,sans-serif}button{border:0;font-weight:700;cursor:pointer;font-family:inherit}.m,.ho{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.qb,.tb,.x,.dt{flex-shrink:0}.x,.bt,.cn{background:#1e293b}.c{width:356px;max-width:calc(100vw - 16px);background:#0f172af5;color:#f8fafc;border:1px solid #34d39973;border-radius:14px;padding:11px 12px;box-shadow:0 14px 36px #0009}.h{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:8px;cursor:grab;user-select:none;touch-action:none}.tw{display:flex;align-items:center;gap:6px;min-width:0}.g{color:#34d399;font-weight:800;font-size:13px}.m{font-size:11.5px;font-weight:700;color:#f1f5f9}.qb{font-size:10px;font-weight:700;color:#38bdf8}.tb{font-size:9.5px;font-family:monospace;font-weight:700;color:#6ee7b7;background:#10b98129;border:1px solid #10b98159;border-radius:4px;padding:1px 5px}.x{width:20px;height:20px;border-radius:999px;color:#94a3b8;font-size:11px}.x:hover{background:#7f1d1d;color:#fecaca}.ub,.fu{background:#020617;border:1px solid #1e293b;margin-bottom:8px}.ub{display:flex;align-items:center;justify-content:space-between;gap:8px;border-radius:8px;padding:6px 8px}.ho{font-family:monospace;font-size:11px;font-weight:600;color:#e2e8f0}.dt{background:none;color:#38bdf8;font-size:10px}.fu{display:none;font-family:monospace;font-size:9.5px;color:#94a3b8;border-radius:6px;padding:6px;word-break:break-all;max-height:70px;overflow-y:auto}.fu.open{display:block}.ac{display:grid;grid-template-columns:repeat(auto-fit,minmax(70px,1fr));gap:5px}.b{border-radius:8px;padding:6px;font-size:10.5px;white-space:nowrap}.bo{background:#10b981;color:#022c22}.bg{background:#334155;color:#f8fafc}.bt{color:#6ee7b7;border:1px solid #34d39973}.bb{background:#7f1d1dd9;color:#fca5a5;border:1px solid #ef444473}.tc{display:none;margin-top:8px;background:#f59e0b1f;border:1px solid #f59e0b8c;border-radius:8px;padding:7px 8px;font-size:10px;color:#fde68a}.tc.open{display:block}.td{font-family:monospace;font-weight:800;color:#fff;word-break:break-all;display:block;margin:3px 0 6px}.cr{display:grid;grid-template-columns:1fr auto;gap:5px}.cy{background:#f59e0b;color:#0f172a;border-radius:6px;padding:5px 8px;font-size:10px;font-weight:800}.cn{color:#cbd5e1;border:1px solid #334155;border-radius:6px;padding:5px 8px;font-size:10px}</style><div class="c"><div class="h" id="dragHead" title="Geser HUD"><div class="tw"><span class="g">⠿</span><span class="m">${escapeHtml(current.message)}</span>${queueBadge}${timerBadge}</div><button class="x" id="dismissBtn" title="Tutup">✕</button></div><div class="ub"><span class="ho" title="${escapeHtml(fullHost)}">${escapeHtml(fullHost)}</span>${g.hudShowUrlDetail !== false ? `<button class="dt" id="toggleUrlBtn">Detail URL ▼</button>` : ""}</div><div class="fu" id="fullUrlBox">${escapeHtml(current.blockedUrl)}</div><div class="ac">${g.hudShowOpen !== false ? `<button class="b bo" id="btnOpen">↗ Buka Sekali</button>` : ""}${g.hudShowGroup !== false ? `<button class="b bg" id="btnGroup">⊞ Tab Grup</button>` : ""}${g.hudShowTrust !== false ? `<button class="b bt" id="btnTrust">✓ Trust...</button>` : ""}${g.hudShowBlock !== false ? `<button class="b bb" id="btnBlock">🚫 Blokir</button>` : ""}</div><div class="tc" id="trustConfirmBox"><div>Tambahkan ke <strong>Whitelist permanen</strong>?</div><span class="td">${escapeHtml(trustDomain)}</span><div class="cr"><button class="cy" id="btnConfirmTrustYes">✓ Ya, Percayai Permanen</button><button class="cn" id="btnConfirmTrustNo">Batal</button></div></div></div>`;

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
  safeTry("h.t", () => {
    const prev = document.getElementById(TOAST_ID);
    if (prev) prev.remove();

    const hostEl = document.createElement("div");
    hostEl.id = TOAST_ID;
    hostEl.style.cssText =
      "position:fixed;bottom:18px;right:18px;z-index:2147483647;pointer-events:none;";

    const targetHost = getHostname(targetUrl) || targetUrl.slice(0, 48);
    const shadow = hostEl.attachShadow({ mode: "closed" });
    shadow.innerHTML = `<style>.t{display:flex;align-items:center;gap:10px;background:#0f172af5;border:1px solid #34d3998c;border-radius:12px;padding:10px 14px;box-shadow:0 12px 30px #0008;font-family:system-ui,sans-serif;max-width:340px}.i{width:28px;height:28px;border-radius:8px;background:#10b98133;border:1px solid #34d39966;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}.b{min-width:0}.h{font-size:12px;font-weight:800;color:#6ee7b7;line-height:1.25}.s{font-size:10.5px;font-family:monospace;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}</style><div class="t"><div class="i">⚡</div><div class="b"><div class="h">⚡ AEGIS Bypass: Melompati Safelink...</div><div class="s">→ ${escapeHtml(targetHost)} (${escapeHtml(method || "DIRECT")})</div></div></div>`;
    (document.documentElement || document.body).appendChild(hostEl);
    setTimeout(() => {
      safeTry("h.rm", () => hostEl.remove());
    }, TIMINGS.BYPASS_TOAST_MAX_WAIT_MS + 400);
  });
}
