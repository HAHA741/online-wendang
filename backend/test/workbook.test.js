const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getWorkbookContext,
  normalizeSheets,
  replaceWorkbookSheets,
} = require("../workbook");

test("normalizeSheets scopes imported sheets and normalizes identifiers", () => {
  const result = normalizeSheets(
    [
      {
        _id: "must-not-survive",
        id: "1",
        workbookId: "other-book",
        status: "1",
        calcChain: [{ id: "1", r: 0, c: 0 }],
        luckysheet_select_save: [{ sheetIndex: "1" }],
      },
      { id: "1", status: "1" },
    ],
    "book-1",
    "revision-2"
  );

  assert.equal(result.length, 2);
  assert.equal(result[0].id, "1");
  assert.notEqual(result[1].id, "1");
  assert.equal(result[0]._id, undefined);
  assert.equal(result[0].workbookId, "book-1");
  assert.equal(result[0].revision, "revision-2");
  assert.equal(result[0].status, 1);
  assert.equal(result[1].status, 0);
  assert.equal(result[0].order, 0);
  assert.equal(result[1].order, 1);
  assert.equal(result[0].calcChain[0].id, "1");
  assert.equal(result[0].luckysheet_select_save[0].sheetIndex, "1");
});

test("getWorkbookContext includes the active revision when present", async () => {
  const db = {
    collection(name) {
      assert.equal(name, "workbook_meta");
      return {
        findOne: async () => ({ _id: "book-1", activeRevision: "revision-1" }),
      };
    },
  };

  const result = await getWorkbookContext(db, "book-1");
  assert.deepEqual(result.scope, {
    workbookId: "book-1",
    revision: "revision-1",
  });
});

test("replaceWorkbookSheets writes a new revision before switching metadata", async () => {
  const events = [];
  const sheetCollection = {
    insertMany: async (documents) => {
      events.push(["insert", documents]);
    },
    deleteMany: async (filter) => {
      events.push(["delete", filter]);
      return { deletedCount: 1 };
    },
  };
  const metaCollection = {
    findOne: async () => ({ _id: "book-1", activeRevision: "revision-1" }),
    updateOne: async (filter, update) => {
      events.push(["switch", filter, update]);
      return { matchedCount: 1 };
    },
  };
  const db = {
    collection(name) {
      return name === "workbook" ? sheetCollection : metaCollection;
    },
  };

  const result = await replaceWorkbookSheets(
    db,
    "book-1",
    [{ id: "1", name: "Imported" }],
    { revision: "revision-2" }
  );

  assert.equal(result.sheets[0].workbookId, "book-1");
  assert.equal(result.sheets[0].revision, "revision-2");
  assert.deepEqual(events.map(([type]) => type), ["insert", "switch", "delete"]);
  assert.deepEqual(events[2][1], {
    workbookId: "book-1",
    revision: { $ne: "revision-2" },
  });
});

test("replaceWorkbookSheets removes the staged revision when switching fails", async () => {
  const deletedFilters = [];
  const db = {
    collection(name) {
      if (name === "workbook") {
        return {
          insertMany: async () => undefined,
          deleteMany: async (filter) => {
            deletedFilters.push(filter);
          },
        };
      }
      return {
        findOne: async () => ({ _id: "book-1", activeRevision: "revision-1" }),
        updateOne: async () => ({ matchedCount: 0 }),
      };
    },
  };

  await assert.rejects(
    replaceWorkbookSheets(db, "book-1", [{ id: "1" }], {
      revision: "revision-2",
    }),
    { code: "WORKBOOK_NOT_FOUND" }
  );
  assert.deepEqual(deletedFilters, [
    { workbookId: "book-1", revision: "revision-2" },
  ]);
});
