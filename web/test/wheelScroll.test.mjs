import test from "node:test";
import assert from "node:assert/strict";
import wheelScroll from "../src/app/wheelScroll.js";

const { calculateWheelScrollTop, shouldHandleVerticalWheel } = wheelScroll;

const verticalWheel = {
  deltaX: 0,
  deltaY: 100,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
};

test("only pure vertical wheel gestures use the FortuneSheet workaround", () => {
  assert.equal(shouldHandleVerticalWheel(verticalWheel), true);
  assert.equal(
    shouldHandleVerticalWheel({ ...verticalWheel, deltaX: 120 }),
    false,
  );
  assert.equal(
    shouldHandleVerticalWheel({ ...verticalWheel, ctrlKey: true }),
    false,
  );
  assert.equal(
    shouldHandleVerticalWheel({ ...verticalWheel, shiftKey: true }),
    false,
  );
});

test("pixel scrolling works in both directions without row-height boundaries", () => {
  const common = { scrollHeight: 1600, clientHeight: 400, deltaMode: 0 };

  assert.equal(
    calculateWheelScrollTop({ ...common, currentTop: 325, deltaY: 100 }),
    425,
  );
  assert.equal(
    calculateWheelScrollTop({ ...common, currentTop: 325, deltaY: -100 }),
    225,
  );
});

test("wheel scrolling respects top, bottom, line and page boundaries", () => {
  assert.equal(
    calculateWheelScrollTop({
      currentTop: 20,
      scrollHeight: 1600,
      clientHeight: 400,
      deltaY: -3,
      deltaMode: 1,
    }),
    0,
  );
  assert.equal(
    calculateWheelScrollTop({
      currentTop: 1000,
      scrollHeight: 1600,
      clientHeight: 400,
      deltaY: 1,
      deltaMode: 2,
    }),
    1200,
  );
});
