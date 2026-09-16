const test = require("node:test");
const assert = require("node:assert/strict");

const { applyOp } = require("../op");

test("applyOp scopes cell updates to workbook and revision", async () => {
  let capturedOperations;
  const collection = {
    countDocuments: async (filter) => (filter.id?.$in ? 1 : 0),
    bulkWrite: async (operations) => {
      capturedOperations = operations;
      return {
        matchedCount: 1,
        modifiedCount: 1,
        deletedCount: 0,
        insertedCount: 0,
      };
    },
  };

  await applyOp(
    collection,
    [{ id: "sheet-1", op: "replace", path: ["data", 0, 0], value: 42 }],
    { workbookId: "book-1", revision: "revision-2" }
  );

  assert.deepEqual(capturedOperations[0].updateOne.filter, {
    workbookId: "book-1",
    revision: "revision-2",
    id: "sheet-1",
  });
});

test("applyOp rejects a zero-match update", async () => {
  let bulkWriteCalled = false;
  const collection = {
    countDocuments: async () => 0,
    bulkWrite: async () => {
      bulkWriteCalled = true;
      return {
        matchedCount: 0,
        modifiedCount: 0,
        deletedCount: 0,
        insertedCount: 0,
      };
    },
  };

  await assert.rejects(
    applyOp(
      collection,
      [{ id: "missing", op: "replace", path: ["data", 0, 0], value: 42 }],
      { workbookId: "book-1", revision: "revision-2" }
    ),
    { code: "SHEET_NOT_FOUND" }
  );
  assert.equal(bulkWriteCalled, false);
});

test("applyOp adds workbook scope to a newly inserted sheet", async () => {
  let capturedOperations;
  const collection = {
    bulkWrite: async (operations) => {
      capturedOperations = operations;
      return {
        matchedCount: 0,
        modifiedCount: 0,
        deletedCount: 0,
        insertedCount: 1,
      };
    },
  };

  await applyOp(
    collection,
    [{ id: "sheet-2", op: "addSheet", value: { id: "sheet-2" } }],
    { workbookId: "book-1", revision: "revision-2" }
  );

  assert.deepEqual(capturedOperations[0].insertOne.document, {
    id: "sheet-2",
    workbookId: "book-1",
    revision: "revision-2",
  });
});
