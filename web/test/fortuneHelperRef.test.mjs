import test from "node:test";
import assert from "node:assert/strict";
import fortuneHelperRef from "../src/app/fortuneHelperRef.js";

const { createFortuneHelperRef } = fortuneHelperRef;

test("import sizing calls are held back until the canonical workbook mounts", () => {
  const calls = [];
  const workbook = {
    marker: "mounted-workbook",
    setColumnWidth() {
      calls.push("column");
    },
    setRowHeight() {
      calls.push("row");
    },
    getAllSheets() {
      calls.push(this.marker);
      return [{ id: "sheet-1" }];
    },
  };
  const ref = createFortuneHelperRef(() => workbook);

  ref.current.setColumnWidth({}, { id: "imported-sheet" });
  ref.current.setRowHeight({}, { id: "imported-sheet" });

  assert.deepEqual(calls, []);
  assert.deepEqual(ref.current.getAllSheets(), [{ id: "sheet-1" }]);
  assert.deepEqual(calls, ["mounted-workbook"]);
});

test("helper ref stays empty before the workbook is mounted", () => {
  const ref = createFortuneHelperRef(() => null);

  assert.equal(ref.current, null);
});
