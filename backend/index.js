/* eslint-disable no-console */
const express = require("express");
const { MongoClient } = require("mongodb");
const SocketServer = require("ws").Server;
const uuid = require("uuid");
const _ = require("lodash");
const url = require("url");
const cors = require("cors");
const { applyOp } = require("./op");

// 默认 Sheet 模板
const createDefaultSheet = (workbookId) => ({
  name: "Sheet1",
  id: uuid.v4(),
  workbookId, // 关联所属工作簿
  celldata: [{ r: 0, c: 0, v: null }],
  order: 0,
  row: 84,
  column: 60,
  config: {},
  status: 1,
});

const dbName = "fortune-sheet";
const COLL_SHEETS = "workbook";
const COLL_META = "workbook_meta";
const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
const client = new MongoClient(uri);

// 按 workbookId 隔离的在线状态
let presencesByBook = {}; 

async function initMongoDB() {
  await client.connect();
  console.info("Connected to MongoDB");
}

initMongoDB();

const app = express();
app.use(cors()); // 允许跨域请求
app.use(express.json()); // 支持 POST body
const port = process.env.PORT || 8081;

// --- REST API ---

// 1. 查询所有工作簿列表
app.get("/workbooks", async (req, res) => {
  const db = client.db(dbName);
  const list = await db.collection(COLL_META).find().sort({ createTime: -1 }).toArray();
  res.json(list);
});

// 2. 新建一个工作簿
app.post("/workbooks", async (req, res) => {
  const db = client.db(dbName);
  const workbookId = uuid.v4();
  const name = req.body.name || "未命名表格";

  // 插入元数据
  await db.collection(COLL_META).insertOne({
    _id: workbookId,
    name,
    createTime: new Date(),
  });

  // 初始化第一张 Sheet
  await db.collection(COLL_SHEETS).insertOne(createDefaultSheet(workbookId));

  res.json({ ok: true, workbookId });
});

// 3. 获取特定工作簿的所有 Sheet 数据
app.get("/workbook/:id", async (req, res) => {
  const workbookId = req.params.id;
  const db = client.db(dbName);
  const data = await db.collection(COLL_SHEETS).find({ workbookId }).toArray();
  
  data.forEach((sheet) => {
    if (!_.isUndefined(sheet._id)) delete sheet._id;
  });
  res.json(data);
});

// 4. 删除某个工作簿
app.delete("/workbook/:id", async (req, res) => {
  const workbookId = req.params.id;
  const db = client.db(dbName);
  
  await db.collection(COLL_META).deleteOne({ _id: workbookId });
  await db.collection(COLL_SHEETS).deleteMany({ workbookId });
  
  res.json({ ok: true });
});

const server = app.listen(port, () => {
  console.info(`Server running on port ${port}`);
});

// --- WebSocket 逻辑 ---

const connections = {};

// 仅广播给同一工作簿的其它用户
const broadcastToRoom = (selfId, workbookId, data) => {
  Object.values(connections).forEach((ws) => {
    if (ws.id !== selfId && ws.workbookId === workbookId) {
      ws.send(data);
    }
  });
};

const wss = new SocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  // 从 URL 获取 workbookId, 例如: ws://localhost:8081/ws?workbookId=xxx
  const parameters = url.parse(req.url, true).query;
  const workbookId = parameters.workbookId;

  if (!workbookId) {
    ws.close();
    return;
  }

  ws.id = uuid.v4();
  ws.workbookId = workbookId;
  connections[ws.id] = ws;

  ws.on("message", async (data) => {
    const msg = JSON.parse(data.toString());
    const db = client.db(dbName);

    if (msg.req === "getData") {
      const sheets = await db.collection(COLL_SHEETS).find({ workbookId }).toArray();
      ws.send(JSON.stringify({ req: msg.req, data: sheets }));
      ws.send(JSON.stringify({ req: "addPresences", data: presencesByBook[workbookId] || [] }));
    } 
    else if (msg.req === "op") {
      // 协同编辑操作
      await applyOp(db.collection(COLL_SHEETS), msg.data);
      broadcastToRoom(ws.id, workbookId, data.toString());
    } 
    else if (msg.req === "addPresences") {
      ws.presences = msg.data;
      broadcastToRoom(ws.id, workbookId, data.toString());

      // 更新该书的在线状态列表
      let bookPresences = presencesByBook[workbookId] || [];
      bookPresences = _.differenceBy(bookPresences, msg.data, (v) =>
        v.userId == null ? v.username : v.userId
      ).concat(msg.data);
      presencesByBook[workbookId] = bookPresences;
    } 
    else if (msg.req === "removePresences") {
      broadcastToRoom(ws.id, workbookId, data.toString());
    }
  });

  ws.on("close", () => {
    if (ws.presences) {
      broadcastToRoom(
        ws.id,
        ws.workbookId,
        JSON.stringify({ req: "removePresences", data: ws.presences })
      );
      
      // 清理该书的在线列表
      presencesByBook[ws.workbookId] = _.differenceBy(
        presencesByBook[ws.workbookId] || [],
        ws.presences,
        (v) => (v.userId == null ? v.username : v.userId)
      );
    }
    delete connections[ws.id];
  });
});