# fortune-web

`fortune-web` 是在线协同表格的前端项目，基于 Next.js、React 和 FortuneSheet 构建。项目通过 REST API 管理工作簿，通过 WebSocket 接收和广播表格操作及在线用户选区，支持 Excel/CSV 文件的导入与导出。

配套后端项目为 `fortune-service`。完整功能依赖后端服务和 MongoDB，建议按“MongoDB → fortune-service → fortune-web”的顺序启动。

## 核心功能

- 新建工作簿并按 `workbookId` 打开指定文档
- 在线编辑表格，实时同步单元格及工作表操作
- 展示其他在线用户的选区状态
- 导入、后台保存及导出 XLSX 和 CSV 文件
- 生成静态站点产物，交由 Nginx 部署

## 技术栈

| 分类 | 技术 |
| --- | --- |
| 应用框架 | Next.js 16、React 19、TypeScript |
| 表格组件 | `@fortune-sheet/react`、`@fortune-sheet/core` |
| 文件导入导出 | `@corbe30/fortune-excel` |
| UI 与样式 | Ant Design 6、styled-components、Tailwind CSS 4 |
| 请求与状态辅助 | Axios、ahooks |
| 包管理与运行环境 | pnpm 10、Node.js 20 |

## 环境要求

- Node.js 20
- pnpm 10
- 已启动的 `fortune-service`，默认监听 `8081`
- 已供后端连接的 MongoDB

可以通过 Corepack 准备 pnpm：

```bash
corepack enable
corepack prepare pnpm@10 --activate
```

## 初始化与本地启动

1. 安装依赖：

   ```bash
   pnpm install
   ```

2. 检查项目根目录的 `.env`：

   ```dotenv
   NEXT_PUBLIC_API_URL=http://localhost:8081
   ```

   仓库已提供上述本地默认配置，用于 REST API。当前 WebSocket 地址会根据浏览器正在访问的主机自动生成，并固定连接 `8081` 端口，因此本地后端建议使用默认端口 `8081`。如需个人覆盖且不希望提交，可另建被 Git 忽略的 `.env.local`。

3. 确认 `fortune-service` 已启动，然后启动前端：

   ```bash
   pnpm dev
   ```

4. 浏览器访问 [http://localhost:3000](http://localhost:3000)。

首次打开且 URL 中没有 `workbookId` 时，页面会自动创建一个工作簿。打开已有工作簿可使用：

```text
http://localhost:3000/?workbookId=<工作簿 ID>
```

## 环境配置

| 变量 | 是否必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | 建议配置 | 项目 `.env` 配置为 `http://localhost:8081` | REST API 基础地址，可通过个人 `.env.local` 覆盖 |

> 注意：REST API 可以通过环境变量修改，但 WebSocket 端口目前固定为 `8081`。如果部署时修改后端端口，需要同步调整 `src/app/page.tsx` 中的 WebSocket 地址生成逻辑。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动本地开发服务器 |
| `pnpm lint` | 执行 ESLint 检查 |
| `pnpm test` | 执行导入时序等前端单元测试 |
| `pnpm build` | 构建生产静态站点，产物位于 `dist/` |
| `pnpm start` | Next.js 服务启动命令；不适用于当前 `output: 'export'` 的静态导出模式 |

## 目录结构

```text
fortune-web/
├─ api/
│  ├─ index.ts            # 工作簿 REST API
│  └─ request.ts          # Axios 实例及统一错误处理
├─ public/
│  └─ customApp.conf      # 生产环境 Nginx 配置
├─ src/app/
│  ├─ layout.tsx          # 根布局和页面元信息
│  ├─ page.tsx            # 表格页面及 WebSocket 协同逻辑
│  └─ globals.css         # 全局样式
├─ build_ci/              # CI 构建与部署配置
├─ next.config.ts         # Next.js 静态导出配置
└─ package.json
```

## 前后端交互

页面初始化流程如下：

```text
打开页面
  ├─ URL 有 workbookId：直接使用该 ID
  └─ URL 无 workbookId：POST /workbooks 创建工作簿
             ↓
连接 ws://<当前主机>:8081/ws?workbookId=<ID>
             ↓
发送 getData，加载工作表并开始同步编辑操作和在线状态
```

使用的 REST API：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/workbooks` | 查询工作簿列表 |
| `POST` | `/workbooks` | 新建工作簿 |
| `GET` | `/workbook/:id` | 查询指定工作簿的工作表数据 |
| `PUT` | `/workbook/:id/sheets` | 使用导入结果替换并保存工作簿的全部 Sheet |
| `DELETE` | `/workbook/:id` | 删除工作簿及其工作表数据 |

WebSocket 消息类型包括 `getData`、`op`、`opAck`、`replaceData`、`addPresences`、`removePresences` 和 `error`，具体协议实现见 `src/app/page.tsx` 和后端 `fortune-service/index.js`。

导入 Excel/CSV 时，页面不会刷新。前端先在后台调用 `PUT /workbook/:id/sheets`，服务端保存成功并返回规范化 Sheet 后，页面才切换到导入结果；保存失败时继续保留原工作簿。

## 构建与部署

执行：

```bash
pnpm build
```

项目在 `next.config.ts` 中配置了 `output: 'export'` 和 `distDir: 'dist'`，构建结果是 `dist/` 下的静态文件。CI 会将 `dist/` 与 `public/` 内容打包，并通过 Nginx 提供服务；仓库中的 `public/customApp.conf` 默认监听 `3018` 端口。

当前 `dockerfile` 仍采用 Next.js Node Server 的 `.next`/`next start` 部署方式，与静态导出配置不完全一致。直接使用该 Dockerfile 前，应先统一为“静态文件 + Nginx”或取消静态导出，避免构建产物路径不匹配。

## 常见问题

### 页面一直显示“文档初始化中”

依次确认：

1. MongoDB 已启动且后端连接成功。
2. `fortune-service` 正在监听 `8081`。
3. `.env` 或个人 `.env.local` 中的 `NEXT_PUBLIC_API_URL` 指向可访问的后端地址。
4. 修改环境文件后已经重启前端开发服务器。

### REST 请求正常但实时协同失败

WebSocket 当前固定使用浏览器当前主机的 `8081` 端口。确认该端口可访问，并在 HTTPS 页面下使用支持 `wss` 的代理或证书配置。

### 修改了公开环境变量但页面未生效

`NEXT_PUBLIC_*` 变量会在构建时写入前端产物。生产环境修改变量后需要重新构建和发布。
