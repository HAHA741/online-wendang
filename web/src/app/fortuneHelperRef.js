"use strict";

/**
 * Fortune Excel's import helper applies row/column sizes with a fixed 1 ms
 * delay. During an async import save the visible workbook still contains the
 * old sheets, so forwarding those calls would make FortuneSheet throw
 * "sheet not found". Other APIs are forwarded so export keeps working.
 *
 * @template {object} T
 * @param {() => T | null} getWorkbook
 * @returns {{ readonly current: T | null }}
 */
function createFortuneHelperRef(getWorkbook) {
  return {
    get current() {
      const workbook = getWorkbook();
      if (!workbook) return null;

      return new Proxy(workbook, {
        get(target, property) {
          if (property === "setColumnWidth" || property === "setRowHeight") {
            return () => undefined;
          }

          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    },
  };
}

module.exports = { createFortuneHelperRef };
