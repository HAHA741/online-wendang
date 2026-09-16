const _ = require("lodash");
const uuid = require("uuid");

const COLL_SHEETS = "workbook";
const COLL_META = "workbook_meta";

function createHttpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizeSheets(sheets, workbookId, revision) {
  if (!Array.isArray(sheets) || sheets.length === 0) {
    throw createHttpError(400, "至少需要一个工作表", "INVALID_SHEETS");
  }

  const usedIds = new Set();
  const sourceIds = sheets.map((sheet) => {
    if (sheet == null || typeof sheet !== "object" || Array.isArray(sheet)) {
      throw createHttpError(400, "工作表数据格式错误", "INVALID_SHEET");
    }
    return sheet.id == null ? "" : String(sheet.id).trim();
  });

  const normalizedIds = sourceIds.map((sourceId) => {
    let id = sourceId;
    if (!id || usedIds.has(id)) {
      id = uuid.v4();
    }
    usedIds.add(id);
    return id;
  });

  const firstIdMapping = new Map();
  sourceIds.forEach((sourceId, index) => {
    if (sourceId && !firstIdMapping.has(sourceId)) {
      firstIdMapping.set(sourceId, normalizedIds[index]);
    }
  });

  let activeIndex = sheets.findIndex((sheet) => Number(sheet.status) === 1);
  if (activeIndex < 0) activeIndex = 0;

  return sheets.map((sourceSheet, index) => {
    const sheet = _.cloneDeep(sourceSheet);
    const sourceId = sourceIds[index];
    const normalizedId = normalizedIds[index];

    delete sheet._id;
    sheet.id = normalizedId;
    sheet.workbookId = workbookId;
    sheet.revision = revision;
    sheet.order = index;
    sheet.status = index === activeIndex ? 1 : 0;

    const normalizeReference = (value) => {
      if (value == null) return value;
      const reference = String(value);
      if (sourceId && reference === sourceId) return normalizedId;
      return firstIdMapping.get(reference) || value;
    };

    if (Array.isArray(sheet.calcChain)) {
      sheet.calcChain = sheet.calcChain.map((item) => ({
        ...item,
        id: normalizeReference(item.id),
      }));
    }

    if (Array.isArray(sheet.luckysheet_select_save)) {
      sheet.luckysheet_select_save = sheet.luckysheet_select_save.map(
        (selection) => ({
          ...selection,
          sheetIndex: normalizeReference(selection.sheetIndex),
        })
      );
    }

    return sheet;
  });
}

async function getWorkbookContext(db, workbookId) {
  const meta = await db.collection(COLL_META).findOne({ _id: workbookId });
  if (!meta) {
    throw createHttpError(404, "工作簿不存在", "WORKBOOK_NOT_FOUND");
  }

  const scope = { workbookId };
  if (meta.activeRevision) {
    scope.revision = meta.activeRevision;
  }

  return { meta, scope };
}

async function getWorkbookSheets(db, workbookId) {
  const { scope } = await getWorkbookContext(db, workbookId);
  return db.collection(COLL_SHEETS).find(scope).sort({ order: 1 }).toArray();
}

async function replaceWorkbookSheets(db, workbookId, sheets, options = {}) {
  await getWorkbookContext(db, workbookId);

  const revision = options.revision || uuid.v4();
  const normalizedSheets = normalizeSheets(sheets, workbookId, revision);
  const sheetCollection = db.collection(COLL_SHEETS);
  const metaCollection = db.collection(COLL_META);

  try {
    await sheetCollection.insertMany(normalizedSheets, { ordered: true });
  } catch (error) {
    await sheetCollection
      .deleteMany({ workbookId, revision })
      .catch(() => undefined);
    throw error;
  }

  try {
    const switchResult = await metaCollection.updateOne(
      { _id: workbookId },
      {
        $set: {
          activeRevision: revision,
          updateTime: new Date(),
        },
      }
    );

    if (switchResult.matchedCount !== 1) {
      throw createHttpError(404, "工作簿不存在", "WORKBOOK_NOT_FOUND");
    }
  } catch (error) {
    await sheetCollection
      .deleteMany({ workbookId, revision })
      .catch(() => undefined);
    throw error;
  }

  let cleanupError = null;
  try {
    await sheetCollection.deleteMany({
      workbookId,
      revision: { $ne: revision },
    });
  } catch (error) {
    cleanupError = error;
  }

  return {
    revision,
    sheets: normalizedSheets,
    cleanupError,
  };
}

module.exports = {
  COLL_META,
  COLL_SHEETS,
  createHttpError,
  getWorkbookContext,
  getWorkbookSheets,
  normalizeSheets,
  replaceWorkbookSheets,
};
