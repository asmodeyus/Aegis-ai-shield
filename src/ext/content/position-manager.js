// @ts-check
/**
 * AEGIS-AI Shield v3.2.2 — HUD & Video Dock Position Manager
 * Clamping, edge-anchoring, ratio persistence, and safe top margin calculations.
 */
import { safeTry } from "../shared/debug.js";
import { runtimeState } from "./state.js";

export function clampHudPosition(left, top, elWidth, elHeight, margin = 4, minTopOverride = null) {
  const vw = Math.max(window.innerWidth || 360, 200);
  const vh = Math.max(window.innerHeight || 640, 200);
  const w = Math.max(24, Number(elWidth) || 60);
  const h = Math.max(24, Number(elHeight) || 36);
  const minLeft = margin;
  const maxLeft = Math.max(minLeft, vw - w - margin);
  const minTop = typeof minTopOverride === "number" ? minTopOverride : margin;
  const maxTop = Math.max(minTop, vh - h - margin);
  return {
    left: Math.round(Math.max(minLeft, Math.min(maxLeft, Number(left) || 0))),
    top: Math.round(Math.max(minTop, Math.min(maxTop, Number(top) || 0)))
  };
}

export function createSavedHudCoord(left, top, elWidth, elHeight, margin = 4, minTopOverride = null) {
  const vw = Math.max(window.innerWidth || 360, 200);
  const vh = Math.max(window.innerHeight || 640, 200);
  const w = Math.max(24, Number(elWidth) || 60);
  const clamped = clampHudPosition(left, top, w, elHeight, margin, minTopOverride);
  const centerX = clamped.left + w / 2;
  const anchorSide = centerX < vw / 2 ? "left" : "right";
  const rightOffset = Math.max(margin, Math.round(vw - (clamped.left + w)));
  return {
    left: clamped.left,
    top: clamped.top,
    rightOffset,
    anchorSide,
    leftRatio: Number((clamped.left / vw).toFixed(4)),
    topRatio: Number((clamped.top / vh).toFixed(4)),
    savedAt: Date.now()
  };
}

export function resolveSavedHudCoord(saved, elWidth, elHeight, margin = 4, minTopOverride = null) {
  if (!saved || typeof saved !== "object") return null;
  const vw = Math.max(window.innerWidth || 360, 200);
  const vh = Math.max(window.innerHeight || 640, 200);
  const w = Math.max(24, Number(elWidth) || 60);
  const h = Math.max(24, Number(elHeight) || 36);

  let left = typeof saved.left === "number" ? saved.left : 0;
  let top = typeof saved.top === "number" ? saved.top : 0;

  if (saved.anchorSide === "right" && typeof saved.rightOffset === "number") {
    left = vw - w - saved.rightOffset;
  } else if (typeof saved.leftRatio === "number" && (left > vw - w || left < 0)) {
    left = saved.leftRatio * vw;
  }
  if (typeof saved.topRatio === "number" && (top > vh - h || top < 0)) {
    top = saved.topRatio * vh;
  }

  const clamped = clampHudPosition(left, top, w, h, margin, minTopOverride);
  return {
    left: clamped.left,
    top: clamped.top,
    right: Math.max(margin, Math.round(vw - (clamped.left + w))),
    anchorSide: saved.anchorSide || (clamped.left + w / 2 < vw / 2 ? "left" : "right")
  };
}

export function getEffectiveVideoDockDir() {
  const pref = runtimeState.globalSettings.videoDockExpandDir || "auto";
  if (pref === "ltr" || pref === "rtl") return pref;
  const saved = runtimeState.hudPositions.videoDock;
  if (saved && saved.anchorSide === "left") return "ltr";
  if (saved && saved.anchorSide === "right") return "rtl";
  return "rtl";
}

export function saveHudPosition(key, coordObj) {
  runtimeState.hudPositions = {
    ...runtimeState.hudPositions,
    [key]: coordObj
  };
  safeTry("pm.sv", () => {
    chrome.storage.local.set({ hudPositions: { ...runtimeState.hudPositions } });
  });
}

export function getMiniPlayerSafeTop() {
  return 26;
}

/**
 * Shared zero-leak pointer-capture drag handler for Top HUD, Video Dock Pill, and Mini PiP.
 * Defers setPointerCapture until pointer movement exceeds threshold so button taps dispatch normal clicks.
 * @param {HTMLElement} handleEl
 * @param {{
 *   targetEl: HTMLElement,
 *   margin?: number,
 *   minTop?: number | null,
 *   threshold?: number,
 *   requireTrusted?: boolean,
 *   allowSelector?: string,
 *   getDims?: () => { width: number, height: number } | null,
 *   onStart?: (e: PointerEvent, initLeft: number, initTop: number) => boolean | void,
 *   onMove?: (clamped: { left: number, top: number }) => void,
 *   onEnd?: (moved: boolean, e: PointerEvent) => void
 * }} opts
 */
export function attachPointerDrag(handleEl, opts) {
  let dragging = false;
  let moved = false;
  let captured = false;
  let startX = 0;
  let startY = 0;
  let initLeft = 0;
  let initTop = 0;
  const thr = opts.threshold || 0;

  handleEl.addEventListener("pointerdown", (e) => {
    if (opts.requireTrusted && !e.isTrusted) return;
    const tgt = /** @type {HTMLElement} */ (e.target);
    const allowed = opts.allowSelector && tgt.closest(opts.allowSelector);
    if (!allowed && tgt.closest("button")) return;
    const rect = opts.targetEl.getBoundingClientRect();
    initLeft = rect.left;
    initTop = rect.top;
    if (opts.onStart && opts.onStart(e, initLeft, initTop) === false) return;
    dragging = true;
    moved = thr === 0;
    captured = false;
    startX = e.clientX;
    startY = e.clientY;
    if (thr === 0) {
      safeTry("pm.dc", () => {
        handleEl.setPointerCapture(e.pointerId);
        captured = true;
      });
    }
  });

  handleEl.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) >= thr) {
      moved = true;
      if (!captured) {
        safeTry("pm.dc", () => {
          handleEl.setPointerCapture(e.pointerId);
          captured = true;
        });
      }
    }
    if (!moved) return;
    const dims = opts.getDims ? opts.getDims() : opts.targetEl.getBoundingClientRect();
    if (!dims) {
      dragging = false;
      return;
    }
    const clamped = clampHudPosition(
      initLeft + dx,
      initTop + dy,
      dims.width,
      dims.height,
      opts.margin ?? 4,
      opts.minTop ?? null
    );
    opts.targetEl.style.left = `${clamped.left}px`;
    opts.targetEl.style.top = `${clamped.top}px`;
    if (opts.onMove) opts.onMove(clamped);
  });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    if (captured) {
      captured = false;
      safeTry("drag.release", () => {
        if (handleEl.hasPointerCapture(e.pointerId)) handleEl.releasePointerCapture(e.pointerId);
      });
    }
    if (opts.onEnd) opts.onEnd(moved, e);
  };

  handleEl.addEventListener("pointerup", endDrag);
  handleEl.addEventListener("pointercancel", endDrag);
}

