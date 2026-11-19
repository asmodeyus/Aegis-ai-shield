import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampHudPosition,
  createSavedHudCoord,
  resolveSavedHudCoord,
  resolveVideoDockExpandDirection,
  hasExceededDragThreshold,
} from './hudPositionMath';

test('clampHudPosition keeps HUD inside viewport margins', () => {
  const pos1 = clampHudPosition(-40, -20, 320, 120, 1280, 720, 8);
  assert.deepEqual(pos1, { left: 8, top: 8 });

  const pos2 = clampHudPosition(1500, 900, 320, 120, 1280, 720, 8);
  assert.deepEqual(pos2, { left: 952, top: 592 });
});

test('createSavedHudCoord computes clamped coordinates, ratios, and anchorSide', () => {
  const savedLeft = createSavedHudCoord(12, 300, 180, 38, 1280, 720, 4);
  assert.equal(savedLeft.left, 12);
  assert.equal(savedLeft.anchorSide, 'left');

  const savedRight = createSavedHudCoord(1080, 300, 180, 38, 1280, 720, 4);
  assert.equal(savedRight.anchorSide, 'right');
  assert.equal(savedRight.rightOffset, 20);
});

test('resolveSavedHudCoord preserves rightOffset when pill expands on right edge', () => {
  // User drags compact 70px pill to 6px from right edge on 1000px screen (left = 924)
  const savedCompactRight = createSavedHudCoord(924, 400, 70, 36, 1000, 700, 4);
  assert.equal(savedCompactRight.anchorSide, 'right');
  assert.equal(savedCompactRight.rightOffset, 6);

  // When pill wakes/expands to 220px wide, it expands right-to-left keeping right=6 (left=774)
  const resolvedExpanded = resolveSavedHudCoord(savedCompactRight, 220, 36, 1000, 700, 4);
  assert.ok(resolvedExpanded);
  assert.equal(resolvedExpanded.right, 6);
  assert.equal(resolvedExpanded.left, 774);
});

test('resolveVideoDockExpandDirection selects ltr on left edge and rtl on right edge', () => {
  const leftCoord = createSavedHudCoord(8, 250, 180, 36, 1200, 800, 4);
  const rightCoord = createSavedHudCoord(980, 250, 180, 36, 1200, 800, 4);

  assert.equal(resolveVideoDockExpandDirection('auto', leftCoord, 1200), 'ltr');
  assert.equal(resolveVideoDockExpandDirection('auto', rightCoord, 1200), 'rtl');
  assert.equal(resolveVideoDockExpandDirection('ltr', rightCoord, 1200), 'ltr');
  assert.equal(resolveVideoDockExpandDirection('rtl', leftCoord, 1200), 'rtl');
});

test('hasExceededDragThreshold distinguishes click from drag gesture', () => {
  assert.equal(hasExceededDragThreshold(100, 100, 102, 101, 4), false);
  assert.equal(hasExceededDragThreshold(100, 100, 104, 103, 4), true);
});
