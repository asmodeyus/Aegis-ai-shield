export type HudExpandDirection = 'auto' | 'ltr' | 'rtl';

export interface SavedHudCoord {
  left: number;
  top: number;
  xRatio: number;
  yRatio: number;
  anchorSide?: 'left' | 'right';
  rightOffset?: number;
}

export interface AllHudPositions {
  topHud: SavedHudCoord | null;
  videoDock: SavedHudCoord | null;
  miniPip: SavedHudCoord | null;
}

export const DEFAULT_HUD_POSITIONS: AllHudPositions = {
  topHud: null,
  videoDock: null,
  miniPip: null,
};

/**
 * Clamps a HUD element's (left, top) coordinate so it never goes off-screen.
 * Uses a small 4px default margin so HUDs can be docked flush against screen edges.
 */
export function clampHudPosition(
  left: number,
  top: number,
  elWidth: number,
  elHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = 4
): { left: number; top: number } {
  const safeVw = Math.max(elWidth + margin * 2, viewportWidth);
  const safeVh = Math.max(elHeight + margin * 2, viewportHeight);
  const maxLeft = Math.max(margin, safeVw - elWidth - margin);
  const maxTop = Math.max(margin, safeVh - elHeight - margin);

  const clampedLeft = Math.round(Math.max(margin, Math.min(left, maxLeft)));
  const clampedTop = Math.round(Math.max(margin, Math.min(top, maxTop)));

  return { left: clampedLeft, top: clampedTop };
}

/**
 * Determines whether a HUD element should open from Left-to-Right ('ltr')
 * or Right-to-Left ('rtl') based on user setting or its horizontal screen side.
 */
export function resolveVideoDockExpandDirection(
  configuredDir: HudExpandDirection | undefined,
  savedCoord: SavedHudCoord | null | undefined,
  viewportWidth: number
): 'ltr' | 'rtl' {
  if (configuredDir === 'ltr') return 'ltr';
  if (configuredDir === 'rtl') return 'rtl';
  if (savedCoord) {
    if (savedCoord.anchorSide === 'left') return 'ltr';
    if (savedCoord.anchorSide === 'right') return 'rtl';
    return savedCoord.left < viewportWidth / 2 ? 'ltr' : 'rtl';
  }
  // Default video dock is at bottom-right, so it expands right-to-left
  return 'rtl';
}

/**
 * Creates a SavedHudCoord with pixel coordinates, viewport-relative ratios,
 * and automatic left/right edge anchor detection so expanding/collapsing pills
 * stay pinned to their edge.
 */
export function createSavedHudCoord(
  left: number,
  top: number,
  elWidth: number,
  elHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = 4
): SavedHudCoord {
  const clamped = clampHudPosition(left, top, elWidth, elHeight, viewportWidth, viewportHeight, margin);
  const usableW = Math.max(1, viewportWidth - elWidth);
  const usableH = Math.max(1, viewportHeight - elHeight);
  const centerX = clamped.left + elWidth / 2;
  const anchorSide: 'left' | 'right' = centerX < viewportWidth / 2 ? 'left' : 'right';
  const rightOffset = Math.round(Math.max(margin, viewportWidth - (clamped.left + elWidth)));

  return {
    left: clamped.left,
    top: clamped.top,
    xRatio: Number(Math.max(0, Math.min(1, clamped.left / usableW)).toFixed(4)),
    yRatio: Number(Math.max(0, Math.min(1, clamped.top / usableH)).toFixed(4)),
    anchorSide,
    rightOffset,
  };
}

/**
 * Resolves a stored SavedHudCoord against the current viewport dimensions.
 */
export function resolveSavedHudCoord(
  saved: SavedHudCoord | null | undefined,
  elWidth: number,
  elHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = 4
): { left: number; top: number; right: number; anchorSide: 'left' | 'right' } | null {
  if (!saved || typeof saved.left !== 'number' || typeof saved.top !== 'number') {
    return null;
  }

  const anchorSide: 'left' | 'right' =
    saved.anchorSide || (saved.left < viewportWidth / 2 ? 'left' : 'right');

  let candidateLeft = saved.left;
  let candidateTop = saved.top;

  if (anchorSide === 'right' && typeof saved.rightOffset === 'number') {
    candidateLeft = viewportWidth - elWidth - saved.rightOffset;
  } else if (
    typeof saved.xRatio === 'number' &&
    typeof saved.yRatio === 'number' &&
    (saved.left + elWidth + margin > viewportWidth || saved.top + elHeight + margin > viewportHeight)
  ) {
    const usableW = Math.max(1, viewportWidth - elWidth);
    const usableH = Math.max(1, viewportHeight - elHeight);
    candidateLeft = saved.xRatio * usableW;
    candidateTop = saved.yRatio * usableH;
  }

  const clamped = clampHudPosition(
    candidateLeft,
    candidateTop,
    elWidth,
    elHeight,
    viewportWidth,
    viewportHeight,
    margin
  );
  const right = Math.round(Math.max(margin, viewportWidth - (clamped.left + elWidth)));

  return {
    left: clamped.left,
    top: clamped.top,
    right,
    anchorSide,
  };
}

/**
 * Checks if a pointer drag exceeded the intentional movement threshold (in px)
 * to distinguish a deliberate drag from a normal tap/click.
 */
export function hasExceededDragThreshold(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  thresholdPx = 4
): boolean {
  const dx = currentX - startX;
  const dy = currentY - startY;
  return Math.hypot(dx, dy) >= thresholdPx;
}
