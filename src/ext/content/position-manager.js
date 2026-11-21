// @ts-check
/**
 * AEGIS-AI Shield v3.0.0 — HUD & Video Dock Position Manager
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
  safeTry("position.saveHudPosition", () => {
    chrome.storage.local.set({ hudPositions: { ...runtimeState.hudPositions } });
  });
}

export function getMiniPlayerSafeTop() {
  return 26;
}
