import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import WebSocket from "ws";
import _ from "lodash";

// --- 配置区 ---
// 运行命令时可以通过参数传入 workbookId，例如: node mcp-server.js <id>
const WORKBOOK_ID = process.argv[2] || "default-workbook-id"; 
const BACKEND_URL = "ws://localhost:8081/ws"; 

class FortuneMCPServer {
  constructor() {
    this.ws = null;
    this.currentData = null; // 本地缓存最新的表格数据
    this.server = new Server(
      { name: "fortune-sheet-ai-controller", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );
    
    this.setupTools();
  }

  /**
   * 初始化 WebSocket 连接
   */
  async connectToBackend() {
    const url = `${BACKEND_URL}?workbookId=${WORKBOOK_ID}`;
    this.ws = new WebSocket(url);

    return new Promise((resolve) => {
      this.ws.on("open", () => {
        console.error(`[MCP] 已挂载到工作簿: ${WORKBOOK_ID}`);
        // 立即拉取初始数据
        this.ws.send(JSON.stringify({ req: "getData" }));
        resolve();
      });

      this.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.req === "getData") {
          this.currentData = msg.data; // 同步后端数据到内存
        }
      });

      this.ws.on("error", (err) => console.error("[WS Error]", err));
    });
  }

  /**
   * 定义大模型可以使用的工具
   */
  setupTools() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "read_all_sheets",
          description: "获取当前工作簿中所有 Sheet 的名称、ID 和基本信息",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "get_sheet_content",
          description: "读取特定 Sheet 的单元格内容(celldata)",
          inputSchema: {
            type: "object",
            properties: {
              sheetId: { type: "string", description: "Sheet 的唯一 ID" }
            },
            required: ["sheetId"]
          }
        },
        {
          name: "batch_update_cells",
          description: "批量修改单元格内容。支持一次性修改多个格子。",
          inputSchema: {
            type: "object",
            properties: {
              sheetId: { type: "string" },
              updates: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    r: { type: "number", description: "行" },
                    c: { type: "number", description: "列" },
                    value: { type: "string", description: "内容" }
                  }
                }
              }
            },
            required: ["sheetId", "updates"]
          }
        },
        {
          name: "insert_dimension",
          description: "在表格中插入行或列",
          inputSchema: {
            type: "object",
            properties: {
              sheetId: { type: "string" },
              type: { type: "string", enum: ["row", "col"], description: "插入行还是列" },
              index: { type: "number", description: "插入的位置索引" },
              count: { type: "number", description: "插入的数量", default: 1 }
            },
            required: ["sheetId", "type", "index"]
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "read_all_sheets":
          const summary = (this.currentData || []).map(s => ({
            name: s.name,
            id: s.id,
            rows: s.row,
            cols: s.column
          }));
          return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };

        case "get_sheet_content":
          const sheet = _.find(this.currentData, { id: args.sheetId });
          return { content: [{ type: "text", text: JSON.stringify(sheet?.celldata || [], null, 2) }] };

        case "batch_update_cells":
          // 构造符合 op.js 逻辑的 ops 数组
          const ops = args.updates.map(upd => ({
            op: "replace",
            id: args.sheetId,
            path: ["data", upd.r, upd.c, "v"], 
            value: upd.value
          }));
          this.sendOp(ops);
          return { content: [{ type: "text", text: `已成功更新 ${ops.length} 个单元格` }] };

        case "insert_dimension":
          // 构造 insertRowCol 特殊指令
          const insertOp = [{
            op: "insertRowCol",
            id: args.sheetId,
            path: [],
            value: {
              type: args.type,
              index: args.index,
              count: args.count || 1,
              direction: "rightbottom"
            }
          }];
          this.sendOp(insertOp);
          return { content: [{ type: "text", text: `已在位置 ${args.index} 插入 ${args.count} ${args.type === 'row' ? '行' : '列'}` }] };

        default:
          throw new Error("Unknown tool");
      }
    });
  }

  sendOp(ops) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ req: "op", data: ops }));
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.connectToBackend();
    await this.server.connect(transport);
  }
}

const mcp = new FortuneMCPServer();
mcp.run().catch(console.error);