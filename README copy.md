# online-wendang

## Docker 打包与启动

以下命令均在项目根目录执行：

```bash
cd D:/ProjectsMine/ZaiXianWenDang/forune
```

### 1. 构建镜像

仓库中的 Dockerfile 文件名为小写 `dockerfile`，因此使用 `-f` 显式指定文件：

```bash
docker build -f ./backend/dockerfile -t fortune-backend:latest ./backend
docker build -f ./web/dockerfile -t fortune-web:latest ./web
```

如需完全重新构建、不复用缓存：

```bash
docker build --no-cache -f ./backend/dockerfile -t fortune-backend:latest ./backend
docker build --no-cache -f ./web/dockerfile -t fortune-web:latest ./web
```

### 2. 启动服务

镜像构建完成后，使用仓库根目录的 `docker-compose.yml` 启动 MongoDB、后端和前端：

```bash
docker compose up -d --no-build
```

端口映射：

| 服务 | 访问地址或端口 |
|---|---|
| 前端 | http://localhost:32999 |
| 后端 | http://localhost:8081 |
| MongoDB | localhost:27018 |

### 3. 检查运行状态

```bash
docker compose ps
docker compose logs -f web
docker compose logs -f backend
```

检查前端和后端 HTTP 端口：

```bash
curl -I http://127.0.0.1:32999/
curl -I http://127.0.0.1:8081/workbooks
```

Windows PowerShell 也可以检查端口是否连通：

```powershell
Test-NetConnection 127.0.0.1 -Port 32999
Test-NetConnection 127.0.0.1 -Port 8081
```

### 4. 停止服务

```bash
docker compose down
```

该命令不会删除 `mongodb_data` 数据卷。
