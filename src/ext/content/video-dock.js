// @ts-check
/**
 * AEGIS-AI Shield v3.2.0 — Hardened Floating Video Pill, Native + Mini PiP, Stream Scanner & Lazy Auto-Skip
 * Eliminates Shadow DOM XSS via safe DOM node creation (textContent), supports Native Browser PiP
 * alongside draggable Mini PiP, tracks dynamic <video> lifecycles via WeakSet, and cleans up on pagehide.
 */
import {
  NON_VIDEO_ASSET_REGEX,
  TIMINGS,
  VIDEO_EXT_REGEX,
  VIDEO_STREAM_HINT_REGEX
} from "../shared/constants.js";
import { safeTry } from "../shared/debug.js";
import {
  clampHudPosition,
  createSavedHudCoord,
  getEffectiveVideoDockDir,
  getMiniPlayerSafeTop,
  resolveSavedHudCoord,
  saveHudPosition
} from "./position-manager.js";
import { isTempAllowActiveHere, isUrlInTrustedList, runtimeState } from "./state.js";

const VIDEO_DOCK_ID = "aegis-video-bottom-dock";
const MINI_PIP_BAR_ID = "aegis-mini-pip-drag-bar";
const MINI_PIP_STYLE_ID = "aegis-mini-pip-style";

let videoDimTimer = null;
let lazyAutoSkipTimer = null;
let lazyAutoSkipActive = false;

/** Track video elements we already attached passive play/pause state sync listeners to */
const observedVideos = new WeakSet();
/** Private closed ShadowRoot reference for Video Dock (inaccessible to page scripts) */
const closedVideoDockRoots = new WeakMap();

// P3: Per-minute & per-page video dock rate limit against untrusted MAIN world spam
/** @type {number[]} */
let videoAddMinuteTimestamps = [];

export function isVideoUrl(urlStr, isConfirmedMime = false) {
  if (!urlStr) return false;
  const s = String(urlStr).trim();
  if (s.startsWith("data:") || s.startsWith("blob:") || s.startsWith("javascript:")) return false;
  if (NON_VIDEO_ASSET_REGEX.test(s)) return false;
  return Boolean(isConfirmedMime || VIDEO_EXT_REGEX.test(s) || VIDEO_STREAM_HINT_REGEX.test(s));
}

export function registerDetectedVideo(rawUrl, isConfirmedMime = false) {
  safeTry("videoDock.registerVideo", () => {
    if (!rawUrl) return;
    if (runtimeState.detectedVideos.length >= TIMINGS.VIDEO_DOCK_MAX_ITEMS_PER_PAGE) return;
    const abs = new URL(String(rawUrl), location.href).href;
    if (!abs.startsWith("http") || !isVideoUrl(abs, isConfirmedMime)) return;
    if (!runtimeState.detectedVideos.includes(abs)) {
      const now = Date.now();
      videoAddMinuteTimestamps = videoAddMinuteTimestamps.filter((ts) => now - ts < 60000);
      if (videoAddMinuteTimestamps.length >= TIMINGS.VIDEO_DOCK_MAX_ADDS_PER_MIN) return;
      videoAddMinuteTimestamps.push(now);

      runtimeState.detectedVideos.unshift(abs);
      if (runtimeState.detectedVideos.length > TIMINGS.VIDEO_DOCK_MAX_ITEMS_PER_PAGE) {
        runtimeState.detectedVideos.pop();
      }
      renderFloatingVideoDock();
      ensureLazyAutoSkipRunning();
    }
  });
}

function attachPassiveVideoSync(videoEl) {
  if (!videoEl || observedVideos.has(videoEl)) return;
  observedVideos.add(videoEl);
  const syncIconOnly = () => {
    const host = document.getElementById(VIDEO_DOCK_ID);
    const root = host ? closedVideoDockRoots.get(host) : null;
    const playBtn = root ? root.getElementById("vpPlay") : null;
    if (playBtn) {
      playBtn.textContent = videoEl.paused ? "▶" : "❚❚";
    }
  };
  videoEl.addEventListener("play", syncIconOnly, { passive: true });
  videoEl.addEventListener("pause", syncIconOnly, { passive: true });
  videoEl.addEventListener("ended", syncIconOnly, { passive: true });
}

export function findPrimaryVideoElement() {
  const videos = Array.from(document.querySelectorAll("video")).filter((v) => v.isConnected);
  if (videos.length === 0) return null;
  let best = videos[0];
  let bestScore = -1;
  for (const v of videos) {
    const r = v.getBoundingClientRect();
    const area = Math.max(0, r.width) * Math.max(0, r.height);
    // Prefer actively playing video with non-zero dimensions
    const playingBonus = !v.paused && !v.ended ? 100000 : 0;
    const score = area + playingBonus;
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }
  return best;
}

export function scanDomForVideos() {
  safeTry("videoDock.scanDom", () => {
    // Auto-cleanup Mini PiP if SPA dynamically removed/replaced the active <video> element
    if (runtimeState.miniPlayerActive && runtimeState.activeMiniVideoEl && !runtimeState.activeMiniVideoEl.isConnected) {
      disableMiniPlayer();
    }

    const videos = document.querySelectorAll("video, video source");
    if (videos.length > 0) {
      ensureLazyAutoSkipRunning();
    }
    videos.forEach((node) => {
      if (node.tagName === "VIDEO") {
        attachPassiveVideoSync(/** @type {HTMLVideoElement} */ (node));
      }
      const src =
        /** @type {HTMLVideoElement} */ (node).currentSrc ||
        node.getAttribute("src") ||
        node.getAttribute("data-src");
      if (src) registerDetectedVideo(src, false);
    });
    if (document.querySelector("video") && runtimeState.detectedVideos.length === 0) {
      runtimeState.detectedVideos.push(location.href);
      renderFloatingVideoDock();
    }
  });
}

// =========================================================================
// LAZY EVENT-DRIVEN AUTO-SKIP (ZERO IDLE POLLING ON NON-VIDEO/HIDDEN TABS)
// =========================================================================
function isVideoElementAnAd(v) {
  if (!v) return false;
  if (
    v.closest(
      ".ad-showing, .ad-interrupting, .ima-ad-container, .vast-ad, [class*='preroll'], [id*='preroll'], [class*='video-ad'], [id*='video-ad']"
    )
  ) {
    return true;
  }
  const idCls = `${v.id || ""} ${typeof v.className === "string" ? v.className : ""}`.toLowerCase();
  const src = (v.currentSrc || v.src || "").toLowerCase();
  return /(preroll|vast|ima-ad|ad-video|doubleclick|googlesyndication)/i.test(idCls + " " + src);
}

export function runIsolatedAutoSkip() {
  if (
    document.hidden ||
    !runtimeState.autoSkipCountdown ||
    runtimeState.captchaDetected ||
    isTempAllowActiveHere() ||
    isUrlInTrustedList(location.href)
  ) {
    return;
  }

  safeTry("videoDock.autoSkip", () => {
    const videos = document.querySelectorAll("video");
    const skipBtns = document.querySelectorAll(
      ".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .jw-skip, .vjs-skip-ad-button, [class*='skip-ad'], [class*='skipAd'], [id*='skip-ad'], [id*='skipAd']"
    );

    if (videos.length === 0 && skipBtns.length === 0) {
      stopLazyAutoSkip();
      return;
    }

    videos.forEach((v) => {
      if (isVideoElementAnAd(v) && v.duration && Number.isFinite(v.duration) && v.duration >= 4 && v.duration <= 36) {
        if (!v.ended && v.currentTime < v.duration - 0.25) {
          v.muted = true;
          const speed = String(runtimeState.globalSettings.adSkipSpeed || "16");
          if (speed === "instant") {
            v.currentTime = Math.max(0, v.duration - 0.1);
          } else {
            v.playbackRate = Number(speed) || 16;
            if (v.duration - v.currentTime > 1.5) {
              v.currentTime = Math.max(v.currentTime, v.duration - 1.2);
            }
          }
        }
      }
    });

    skipBtns.forEach((btn) => {
      const el = /** @type {HTMLElement} */ (btn);
      if (el.dataset.aegisAutoClicked === "1") return;
      const txt = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim();
      if (txt && txt.length > 35) return;
      el.dataset.aegisAutoClicked = "1";
      /** @type {HTMLButtonElement} */ (el).disabled = false;
      el.removeAttribute("disabled");
      el.click();
    });
  });
}

export function ensureLazyAutoSkipRunning() {
  if (lazyAutoSkipActive || document.hidden || runtimeState.captchaDetected) return;
  if (!document.querySelector("video")) return;
  lazyAutoSkipActive = true;
  lazyAutoSkipTimer = setInterval(runIsolatedAutoSkip, TIMINGS.AUTO_SKIP_INTERVAL_MS);
}

export function stopLazyAutoSkip() {
  if (!lazyAutoSkipActive) return;
  lazyAutoSkipActive = false;
  clearInterval(lazyAutoSkipTimer);
  lazyAutoSkipTimer = null;
}

// =========================================================================
// NATIVE BROWSER PiP + MINI PiP FLOATING WINDOW
// =========================================================================
function ensureMiniPlayerStyle() {
  if (document.getElementById(MINI_PIP_STYLE_ID)) return;
  const st = document.createElement("style");
  st.id = MINI_PIP_STYLE_ID;
  st.textContent = `
    video.__aegis_mini_pip__ {
      position: fixed !important;
      z-index: 2147483645 !important;
      border-radius: 0 0 10px 10px !important;
      box-shadow: 0 14px 36px rgba(0,0,0,0.65) !important;
      border: 1px solid rgba(52,211,153,0.45) !important;
      background: #000 !important;
      object-fit: contain !important;
    }
  `;
  (document.head || document.documentElement).appendChild(st);
}

function getMiniPipDims() {
  const sz = runtimeState.globalSettings.pipSize || "medium";
  if (sz === "small") return { width: 220, height: 124 };
  if (sz === "large") return { width: 320, height: 180 };
  return { width: 260, height: 146 };
}

export function disableMiniPlayer() {
  if (runtimeState.activeMiniVideoEl) {
    safeTry("videoDock.cleanupMiniVideo", () => {
      runtimeState.activeMiniVideoEl.classList.remove("__aegis_mini_pip__");
      runtimeState.activeMiniVideoEl.style.left = "";
      runtimeState.activeMiniVideoEl.style.top = "";
      runtimeState.activeMiniVideoEl.style.width = "";
      runtimeState.activeMiniVideoEl.style.height = "";
      runtimeState.activeMiniVideoEl.style.opacity = "";
    });
    runtimeState.activeMiniVideoEl = null;
  }
  runtimeState.miniPlayerActive = false;
  const bar = document.getElementById(MINI_PIP_BAR_ID);
  if (bar) bar.remove();
}

export function applySavedMiniPipPosition() {
  const v = runtimeState.activeMiniVideoEl;
  if (!v || !runtimeState.miniPlayerActive) return;
  if (!v.isConnected) {
    disableMiniPlayer();
    return;
  }
  const dims = getMiniPipDims();
  const safeTop = getMiniPlayerSafeTop();
  const saved = runtimeState.hudPositions.miniPip;
  const resolved = saved
    ? resolveSavedHudCoord(saved, dims.width, dims.height, 8, safeTop)
    : clampHudPosition(
        window.innerWidth - dims.width - 16,
        window.innerHeight - dims.height - 68,
        dims.width,
        dims.height,
        8,
        safeTop
      );
  const left = resolved ? resolved.left : 16;
  const top = resolved ? resolved.top : safeTop;
  const pipOpacity = Math.max(0.5, Math.min(1.0, Number(runtimeState.globalSettings.pipOpacity ?? 0.95)));

  v.style.width = `${dims.width}px`;
  v.style.height = `${dims.height}px`;
  v.style.left = `${left}px`;
  v.style.top = `${top}px`;
  v.style.opacity = String(pipOpacity);

  const bar = document.getElementById(MINI_PIP_BAR_ID);
  if (bar) {
    bar.style.width = `${dims.width}px`;
    bar.style.left = `${left}px`;
    bar.style.top = `${Math.max(2, top - 24)}px`;
    bar.style.opacity = String(pipOpacity);
  }
}

export async function toggleNativeBrowserPiP() {
  const v = findPrimaryVideoElement();
  if (!v) return false;
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      return true;
    }
    if (document.pictureInPictureEnabled && !v.disablePictureInPicture && typeof v.requestPictureInPicture === "function") {
      if (runtimeState.miniPlayerActive) disableMiniPlayer();
      await v.requestPictureInPicture();
      return true;
    }
  } catch {
    // Fallback cleanly to Mini PiP if site or browser blocks native PiP
  }
  return false;
}

function renderMiniPlayerDragBar(videoEl) {
  const prev = document.getElementById(MINI_PIP_BAR_ID);
  if (prev) prev.remove();

  const bar = document.createElement("div");
  bar.id = MINI_PIP_BAR_ID;
  bar.style.cssText =
    "position:fixed;z-index:2147483646;height:24px;display:flex;align-items:center;justify-content:space-between;padding:0 8px;background:rgba(15,23,42,0.96);border:1px solid rgba(52,211,153,0.45);border-bottom:none;border-radius:10px 10px 0 0;color:#e2e8f0;font:700 10.5px system-ui,sans-serif;cursor:grab;user-select:none;touch-action:none;";

  const titleSpan = document.createElement("span");
  titleSpan.textContent = "⠿ Mini PiP";

  const controlsWrap = document.createElement("div");
  controlsWrap.style.cssText = "display:flex;align-items:center;gap:4px;";

  if (document.pictureInPictureEnabled && !videoEl.disablePictureInPicture) {
    const nativeBtn = document.createElement("button");
    nativeBtn.type = "button";
    nativeBtn.textContent = "↗ Native";
    nativeBtn.title = "Pindah ke Native Browser PiP (tetap tampil saat pindah tab)";
    nativeBtn.style.cssText =
      "background:#0f766e;color:#ecfeff;border:none;border-radius:4px;padding:1px 5px;font-size:9.5px;font-weight:700;cursor:pointer;";
    nativeBtn.addEventListener("click", () => {
      toggleNativeBrowserPiP();
    });
    controlsWrap.appendChild(nativeBtn);
  }

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "✕";
  closeBtn.title = "Tutup Mini PiP";
  closeBtn.style.cssText =
    "background:#1e293b;color:#f87171;border:none;border-radius:4px;padding:1px 6px;font-weight:700;cursor:pointer;";
  closeBtn.addEventListener("click", disableMiniPlayer);
  controlsWrap.appendChild(closeBtn);

  bar.appendChild(titleSpan);
  bar.appendChild(controlsWrap);
  (document.documentElement || document.body).appendChild(bar);

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let initLeft = 0;
  let initTop = 0;

  bar.addEventListener("pointerdown", (e) => {
    if (/** @type {HTMLElement} */ (e.target).closest("button")) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = videoEl.getBoundingClientRect();
    initLeft = rect.left;
    initTop = rect.top;
    safeTry("videoDock.pipCapture", () => bar.setPointerCapture(e.pointerId));
  });

  bar.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    if (!videoEl.isConnected) {
      dragging = false;
      disableMiniPlayer();
      return;
    }
    const dims = getMiniPipDims();
    const clamped = clampHudPosition(
      initLeft + (e.clientX - startX),
      initTop + (e.clientY - startY),
      dims.width,
      dims.height,
      8,
      getMiniPlayerSafeTop()
    );
    videoEl.style.left = `${clamped.left}px`;
    videoEl.style.top = `${clamped.top}px`;
    bar.style.left = `${clamped.left}px`;
    bar.style.top = `${Math.max(2, clamped.top - 24)}px`;
  });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    safeTry("videoDock.pipRelease", () => {
      if (bar.hasPointerCapture(e.pointerId)) bar.releasePointerCapture(e.pointerId);
    });
    if (!videoEl.isConnected) {
      disableMiniPlayer();
      return;
    }
    const dims = getMiniPipDims();
    const rect = videoEl.getBoundingClientRect();
    saveHudPosition(
      "miniPip",
      createSavedHudCoord(rect.left, rect.top, dims.width, dims.height, 8, getMiniPlayerSafeTop())
    );
  };

  bar.addEventListener("pointerup", endDrag);
  bar.addEventListener("pointercancel", endDrag);
}

export async function toggleSmartMinimizeOrPiP(preferNative = false) {
  const v = findPrimaryVideoElement();
  if (!v) return;
  if (preferNative) {
    const ok = await toggleNativeBrowserPiP();
    if (ok) return;
  }
  if (runtimeState.miniPlayerActive) {
    disableMiniPlayer();
    return;
  }
  ensureMiniPlayerStyle();
  runtimeState.activeMiniVideoEl = v;
  runtimeState.miniPlayerActive = true;
  v.classList.add("__aegis_mini_pip__");
  renderMiniPlayerDragBar(v);
  applySavedMiniPipPosition();
}

// =========================================================================
// FLOATING VIDEO PILL (XSS-SAFE DOM BUILDER + ZERO-LEAK POINTER CAPTURE DRAG)
// =========================================================================
function scheduleVideoDockDim() {
  clearTimeout(videoDimTimer);
  const dimSec = Math.max(0, Math.min(10, Number(runtimeState.globalSettings.videoDockDimSec ?? 2.5)));
  if (dimSec <= 0 || runtimeState.videoDrawerOpen) return;
  videoDimTimer = setTimeout(() => {
    runtimeState.videoDockDimmed = true;
    renderFloatingVideoDock();
  }, dimSec * 1000);
}

export function updateFloatingVideoDockPosition() {
  const host = document.getElementById(VIDEO_DOCK_ID);
  if (!host) return;
  const g = runtimeState.globalSettings;
  const scale = Math.max(0.75, Math.min(1.35, Number(g.videoPillScale) || 1.0));
  const opacity = Math.max(0.5, Math.min(1.0, Number(g.videoPillOpacity ?? g.hudOpacity) || 0.95));
  const dir = getEffectiveVideoDockDir();
  const rect = host.getBoundingClientRect();
  const saved = runtimeState.hudPositions.videoDock;

  host.style.opacity = String(opacity);
  host.style.transform = `scale(${scale})`;

  if (saved) {
    const resolved = resolveSavedHudCoord(saved, rect.width || 68, rect.height || 40, 4);
    if (resolved) {
      const nearTop = resolved.top < 180;
      host.style.transformOrigin = `${nearTop ? "top" : "bottom"} ${dir === "ltr" ? "left" : "right"}`;
      if (dir === "rtl") {
        host.style.right = `${resolved.right}px`;
        host.style.left = "auto";
      } else {
        host.style.left = `${resolved.left}px`;
        host.style.right = "auto";
      }
      host.style.top = `${resolved.top}px`;
      host.style.bottom = "auto";
      return;
    }
  }

  host.style.transformOrigin = `bottom ${dir === "ltr" ? "left" : "right"}`;
  host.style.bottom = "14px";
  host.style.top = "auto";
  if (dir === "ltr") {
    host.style.left = "8px";
    host.style.right = "auto";
  } else {
    host.style.right = "8px";
    host.style.left = "auto";
  }
}

function attachVideoDockDrag(handleEl, hostEl) {
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let initLeft = 0;
  let initTop = 0;
  let downOnBadge = false;

  handleEl.addEventListener("pointerdown", (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    downOnBadge = Boolean(target.closest("#dimCompactBadge"));
    if (!downOnBadge && target.closest("button")) return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = hostEl.getBoundingClientRect();
    initLeft = rect.left;
    initTop = rect.top;
    safeTry("videoDock.setPointerCapture", () => handleEl.setPointerCapture(e.pointerId));
  });

  handleEl.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) >= 5) moved = true;
    if (!moved) return;
    const rect = hostEl.getBoundingClientRect();
    const clamped = clampHudPosition(initLeft + dx, initTop + dy, rect.width, rect.height, 4);
    hostEl.style.left = `${clamped.left}px`;
    hostEl.style.right = "auto";
    hostEl.style.top = `${clamped.top}px`;
    hostEl.style.bottom = "auto";
  });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    safeTry("videoDock.releasePointerCapture", () => {
      if (handleEl.hasPointerCapture(e.pointerId)) handleEl.releasePointerCapture(e.pointerId);
    });
    if (moved) {
      const rect = hostEl.getBoundingClientRect();
      const saved = createSavedHudCoord(rect.left, rect.top, rect.width, rect.height, 4);
      saveHudPosition("videoDock", saved);
      updateFloatingVideoDockPosition();
    } else if (downOnBadge) {
      runtimeState.videoDrawerOpen = false;
      runtimeState.videoDockDimmed = !runtimeState.videoDockDimmed;
      renderFloatingVideoDock();
      if (!runtimeState.videoDockDimmed) scheduleVideoDockDim();
    }
  };

  handleEl.addEventListener("pointerup", endDrag);
  handleEl.addEventListener("pointercancel", endDrag);
}

export function renderFloatingVideoDock() {
  if (window !== window.top) return;
  const existing = document.getElementById(VIDEO_DOCK_ID);
  if (
    runtimeState.globalSettings.videoDockEnabled === false ||
    runtimeState.detectedVideos.length === 0
  ) {
    if (existing) existing.remove();
    return;
  }

  let hostEl = existing;
  if (!hostEl) {
    hostEl = document.createElement("div");
    hostEl.id = VIDEO_DOCK_ID;
    hostEl.style.cssText = "position:fixed;z-index:2147483646;pointer-events:auto;";
    (document.documentElement || document.body).appendChild(hostEl);
  }

  const g = runtimeState.globalSettings;
  const count = runtimeState.detectedVideos.length;
  const videoEl = findPrimaryVideoElement();
  if (videoEl) attachPassiveVideoSync(videoEl);
  const isPlaying = videoEl ? !videoEl.paused : false;
  let shadow = closedVideoDockRoots.get(hostEl);
  if (!shadow) {
    shadow = hostEl.attachShadow({ mode: "closed" });
    closedVideoDockRoots.set(hostEl, shadow);
  }

  // Static style + structural template ONLY (zero untrusted URL/text interpolation -> immune to XSS)
  shadow.innerHTML = `
    <style>
      * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
      .wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
      .drawer { width: 290px; background: rgba(15,23,42,0.96); border: 1px solid rgba(52,211,153,0.45); border-radius: 12px; padding: 8px; box-shadow: 0 12px 32px rgba(0,0,0,0.55); color: #f8fafc; }
      .drawer-title { font-size: 10.5px; font-weight: 800; color: #34d399; margin-bottom: 6px; }
      .stream-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 4px 6px; border-radius: 6px; background: #020617; border: 1px solid #1e293b; margin-bottom: 4px; font-size: 10px; }
      .stream-lbl { font-family: ui-monospace, monospace; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .s-btn { background: #10b981; color: #022c22; border: none; border-radius: 5px; padding: 2px 7px; font-size: 9.5px; font-weight: 800; cursor: pointer; flex-shrink: 0; }
      .pill { display: inline-flex; align-items: center; gap: 4px; padding: 4px 6px; border-radius: 999px; background: rgba(15,23,42,0.95); border: 1px solid rgba(52,211,153,0.48); box-shadow: 0 10px 28px rgba(0,0,0,0.5); cursor: grab; user-select: none; touch-action: none; }
      .pill:active { cursor: grabbing; }
      .badge { border: none; background: rgba(16,185,129,0.2); color: #6ee7b7; border-radius: 999px; padding: 4px 9px; font-size: 11px; font-weight: 800; cursor: pointer; white-space: nowrap; }
      .pill-btn { width: 28px; height: 28px; border-radius: 999px; border: none; background: transparent; color: #e2e8f0; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
      .pill-btn:hover { background: rgba(255,255,255,0.12); }
    </style>
    <div class="wrap" id="dockWrap">
      <div class="pill" id="pillHandle" title="Geser untuk pindah · Tekan 🎬 untuk buka/lipat">
        <button class="badge" id="dimCompactBadge"></button>
      </div>
    </div>
  `;

  const wrap = shadow.getElementById("dockWrap");
  const pillHandle = shadow.getElementById("pillHandle");
  const compactBadge = shadow.getElementById("dimCompactBadge");
  if (!wrap || !pillHandle || !compactBadge) return;

  compactBadge.textContent = `🎬(${count})`;

  // Safe DOM construction for stream list drawer (prevents HTML/attribute injection from crafted video URLs)
  if (runtimeState.videoDrawerOpen) {
    const drawer = document.createElement("div");
    drawer.className = "drawer";

    const title = document.createElement("div");
    title.className = "drawer-title";
    title.textContent = `🎬 Stream Video Terdeteksi (${count})`;
    drawer.appendChild(title);

    runtimeState.detectedVideos.slice(0, 8).forEach((u, idx) => {
      const safeUrl = String(u || "");
      const label = safeUrl.split("/").pop()?.split("?")[0] || safeUrl.slice(0, 40);

      const row = document.createElement("div");
      row.className = "stream-row";

      const lbl = document.createElement("span");
      lbl.className = "stream-lbl";
      lbl.title = safeUrl;
      lbl.textContent = `${idx + 1}. ${label.slice(0, 32)}`;

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "s-btn";
      openBtn.textContent = "↗ Buka";
      openBtn.addEventListener("click", () => {
        if (safeUrl) chrome.runtime.sendMessage({ type: "OPEN_GROUP_TAB", url: safeUrl });
      });

      row.appendChild(lbl);
      row.appendChild(openBtn);
      drawer.appendChild(row);
    });

    wrap.insertBefore(drawer, pillHandle);
  }

  /**
   * Helper to safely create pill action buttons
   * @param {string} id
   * @param {string} text
   * @param {string} title
   * @param {(ev: MouseEvent) => void} onClick
   */
  const addPillBtn = (id, text, title, onClick) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pill-btn";
    btn.id = id;
    btn.title = title;
    btn.textContent = text;
    btn.addEventListener("click", onClick);
    pillHandle.appendChild(btn);
  };

  if (!runtimeState.videoDockDimmed) {
    if (g.videoPillShowPlayPause !== false) {
      addPillBtn("vpPlay", isPlaying ? "❚❚" : "▶", "Putar/Jeda", () => {
        const v = findPrimaryVideoElement();
        if (v) {
          if (v.paused) v.play().catch(() => {});
          else v.pause();
          renderFloatingVideoDock();
        }
        scheduleVideoDockDim();
      });
    }
    if (g.videoPillShowList !== false) {
      addPillBtn("vpList", "☰", "Daftar Stream", () => {
        runtimeState.videoDrawerOpen = !runtimeState.videoDrawerOpen;
        renderFloatingVideoDock();
      });
    }
    if (g.videoPillShowDownload !== false) {
      addPillBtn("vpDl", "⬇", "Buka Stream di Tab Grup", () => {
        const target = runtimeState.detectedVideos[0];
        if (target) chrome.runtime.sendMessage({ type: "OPEN_GROUP_TAB", url: target });
        scheduleVideoDockDim();
      });
    }
    if (g.videoPillShowPip !== false) {
      addPillBtn("vpPip", "⧉", "Mini PiP (Shift+Klik untuk Native Browser PiP)", (ev) => {
        toggleSmartMinimizeOrPiP(Boolean(ev.shiftKey));
        scheduleVideoDockDim();
      });
    }
    if (g.videoPillShowFullscreen !== false) {
      addPillBtn("vpFs", "⛶", "Layar Penuh", () => {
        const v = findPrimaryVideoElement();
        if (v && v.requestFullscreen) v.requestFullscreen().catch(() => {});
        scheduleVideoDockDim();
      });
    }
  }

  attachVideoDockDrag(pillHandle, hostEl);
  updateFloatingVideoDockPosition();
}

export function cleanupVideoDockLifecycle() {
  clearTimeout(videoDimTimer);
  videoDimTimer = null;
  stopLazyAutoSkip();
  disableMiniPlayer();
}
