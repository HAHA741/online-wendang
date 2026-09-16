# fortune-service

`fortune-service` 是在线协同表格的后端服务，为 `fortune-web` 提供工作簿管理、表格数据持久化、多人实时操作广播和在线状态同步能力。

服务基于 Express 和 WebSocket，共用一个 HTTP 端口；工作簿元数据及 Sheet 数据存储在 MongoDB 中。

## 核心功能

- 创建、查询和删除工作簿
- 按工作簿隔离并持久化 Sheet 数据
- 接收 FortuneSheet 操作并批量写入 MongoDB
- 在同一工作簿房间内广播多人编辑操作
- 同步在线用户的选区状态

## 技术栈

| 分类 | 技术 |
| --- | --- |
| 运行环境 | Node.js 20、CommonJS |
| HTTP 服务 | Express 5 |
| 实时通信 | `ws` WebSocket |
| 数据存储 | MongoDB 7 驱动 |
| 数据处理 | Lodash |
| 构建部署 | GitLab CI、Docker |

## 环境要求

- Node.js 20
- npm
- MongoDB 6 或更高版本（建议 MongoDB 7）
- 默认端口 `8081` 可用

## 初始化与本地启动

### 1. 启动 MongoDB

服务的本地默认配置使用 MongoDB 的 `27018` 主机端口及用户名密码认证。没有现成 MongoDB 时，可使用 Docker 启动一个仅供本地开发的实例：

```bash
docker run -d \
  --name fortune-mongodb \
  -p 27018:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:7
```

PowerShell 可写成单行：

```powershell
docker run -d --name fortune-mongodb -p 27018:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password mongo:7
```

上述账号仅与源码中的本地默认值对应，不应直接用于共享、测试或生产环境。

### 2. 安装依赖

```bash
npm install
```

仓库同时保留了 npm 和 pnpm 锁文件，但当前服务 Dockerfile 与 `build_ci/make` 使用 npm，日常开发建议优先使用 npm，避免无意中同时改动两套锁文件。

### 3. 配置环境变量

使用默认本地 MongoDB 时无需额外配置。推荐显式设置连接串：

PowerShell：

```powershell
$env:MONGODB_URI = "mongodb://admin:password@localhost:27018/?authSource=admin"
$env:PORT = "8081"
```

Bash：

```bash
export MONGODB_URI='mongodb://admin:password@localhost:27018/?authSource=admin'
export PORT=8081
```

### 4. 启动服务

```bash
npm start
```

启动成功后，HTTP API 和 WebSocket 都监听 [http://localhost:8081](http://localhost:8081)。MongoDB 数据库和集合会在首次创建工作簿时自动生成，无需手工初始化表结构。

### 5. 验证服务

查询工作簿列表：

```bash
curl http://localhost:8081/workbooks
```

创建测试工作簿：

```bash
curl -X POST http://localhost:8081/workbooks \
  -H "Content-Type: application/json" \
  -d '{"name":"本地测试工作簿"}'
```

创建成功后会返回 `workbookId`，可通过以下地址在前端打开：

```text
http://localhost:3000/?workbookId=<工作簿 ID>
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MONGODB_URI` | 根据 `LOCAL_IP` 组合本地认证连接串 | 完整 MongoDB 连接地址；设置后优先级最高 |
| `LOCAL_IP` | `localhost` | 仅在未设置 `MONGODB_URI` 时用于生成 MongoDB 地址 |
| `PORT` | `8081` | HTTP 与 WebSocket 共用的监听端口 |

未设置 `MONGODB_URI` 时，服务使用：

```text
mongodb://admin:password@<LOCAL_IP>:27018/?authSource=admin
```

生产环境必须通过环境变量提供独立凭据，并限制 MongoDB 与服务端口的访问范围。

## API 说明

### REST API

| 方法 | 路径 | 请求体 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/workbooks` | 无 | 按创建时间倒序查询工作簿 |
| `POST` | `/workbooks` | `{ "name": "名称" }` | 创建工作簿及默认 `Sheet1` |
| `GET` | `/workbook/:id` | 无 | 查询指定工作簿的所有 Sheet |
| `PUT` | `/workbook/:id/sheets` | `{ "sheets": [...] }` | 版本化替换工作簿的全部 Sheet |
| `DELETE` | `/workbook/:id` | 无 | 删除工作簿元数据和所有 Sheet |

`PUT /workbook/:id/sheets` 会先写入一个完整的新版本，再切换工作簿元数据中的活动版本，最后清理旧数据。读取方只读取活动版本，避免导入过程中看到半套数据。

### WebSocket

连接地址：

```text
ws://<host>:<PORT>/ws?workbookId=<工作簿 ID>
```

连接时必须提供 `workbookId`，否则服务会主动关闭连接。

| `req` 类型 | 方向 | 说明 |
| --- | --- | --- |
| `getData` | 客户端 → 服务端 | 获取当前工作簿全部 Sheet 及在线状态 |
| `op` | 双向 | 持久化并广播表格编辑操作 |
| `addPresences` | 双向 | 新增或更新用户选区状态 |
| `removePresences` | 双向 | 移除离线用户状态 |

## 数据结构

默认数据库名为 `fortune-sheet`，包含两个集合：

| 集合 | 用途 |
| --- | --- |
| `workbook_meta` | 工作簿名称、创建时间等元数据 |
| `workbook` | Sheet 数据及其所属 `workbookId` |

`workbook_meta.activeRevision` 指向当前可见的 Sheet 版本，`workbook.revision` 标识每条 Sheet 所属版本。新建工作簿时会自动插入一个名为 `Sheet1` 的默认工作表。`op.js` 负责将单元格、行列、工作表及配置类操作转换为 MongoDB 批量写入，并使用 `workbookId + revision + id` 限定更新范围。

## 目录结构

```text
fortune-service/
├─ index.js               # REST API、WebSocket 和 MongoDB 初始化
├─ op.js                  # FortuneSheet 操作持久化逻辑
├─ workbook.js            # 工作簿版本、导入规范化和替换逻辑
├─ indexTest.js           # 早期单工作簿实验服务，不是自动化测试
├─ test/                  # Node.js 内置测试运行器测试
├─ public/
│  ├─ customApp.conf      # Nginx 反向代理配置
│  └─ conf/config.js      # 历史部署配置示例
├─ build_ci/              # CI 构建与部署配置
├─ dockerfile             # Node.js 20 服务镜像
└─ package.json
```

## Docker 运行

构建镜像：

```bash
docker build -t fortune-service -f dockerfile .
```

连接运行在宿主机上的 MongoDB：

```bash
docker run --rm \
  --name fortune-service \
  -p 8081:8081 \
  -e MONGODB_URI='mongodb://admin:password@host.docker.internal:27018/?authSource=admin' \
  fortune-service
```

`host.docker.internal` 适用于 Docker Desktop；Linux 环境请改为容器可访问的 MongoDB 主机名或将两个容器加入同一 Docker 网络。

## 测试与开发说明

- 执行 `npm test` 可运行工作簿版本切换、失败回滚、Sheet 规范化和编辑隔离测试。
- `indexTest.js` 是早期实验入口，其中 `/init` 会清空对应集合；不要在共享或生产数据库上运行。
- 服务当前允许所有来源的 CORS，请在对外部署时按实际域名收紧策略。
- 服务启动日志会输出 MongoDB 连接地址；生产环境应避免在连接串中暴露可复用凭据，或调整日志内容后再上线。

## 常见问题

### 启动时报 MongoDB 连接失败

检查 MongoDB 是否监听预期端口、账号密码是否正确，以及连接串是否包含正确的 `authSource`。Docker 中运行服务时，`localhost` 指向服务容器自身，不能直接代表宿主机或另一个容器。

### 前端能创建工作簿但实时编辑不同步

确认客户端连接的是同一服务端口，并携带相同的 `workbookId`。`fortune-web` 当前默认使用 `8081` 作为 WebSocket 端口。

### 修改 `PORT` 后前端无法连接

后端的 HTTP 和 WebSocket 会一起切换端口，但 `fortune-web` 的 WebSocket 端口目前固定为 `8081`。修改后端端口时，需要同步调整前端实现或通过反向代理保持对外端口不变。
