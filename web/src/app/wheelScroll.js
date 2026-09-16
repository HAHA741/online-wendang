"use strict";

const DOM_DELTA_PIXEL = 0;
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;
const DEFAULT_LINE_HEIGHT = 40;

/**
 * Only replace FortuneSheet's pure vertical wheel handling. Browser zoom and
 * horizontal gestures must continue through their original paths.
 */
function shouldHandleVerticalWheel(event) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
    return false;
  }

  return (
    Number.isFinite(event.deltaY) &&
    event.deltaY !== 0 &&
    Math.abs(event.deltaY) > Math.abs(event.deltaX || 0)
  );
}

/**
 * Convert the native wheel delta to a bounded scrollbar position. This uses
 * pixels instead of FortuneSheet's cached cumulative row-height array, so rows
 * with different heights do not change the wheel behavior.
 */
function calculateWheelScrollTop({
  currentTop,
  scrollHeight,
  clientHeight,
  deltaY,
  deltaMode = DOM_DELTA_PIXEL,
}) {
  const viewportHeight = Math.max(0, clientHeight);
  const maxTop = Math.max(0, scrollHeight - viewportHeight);
  let multiplier = 1;

  if (deltaMode === DOM_DELTA_LINE) {
    multiplier = DEFAULT_LINE_HEIGHT;
  } else if (deltaMode === DOM_DELTA_PAGE) {
    multiplier = viewportHeight;
  }

  const nextTop = currentTop + deltaY * multiplier;
  return Math.min(maxTop, Math.max(0, nextTop));
}

module.exports = {
  calculateWheelScrollTop,
  shouldHandleVerticalWheel,
};
