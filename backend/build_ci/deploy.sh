#!/bin/sh

echo "------------------------------------------"
echo "🔍 Starting Environment Check..."
echo "------------------------------------------"

# 1. 打印系统基本信息
echo "[System] Current User: $(whoami)"
echo "[System] Current Workdir: $(pwd)"
echo "[System] OS Info: $(cat /etc/os-release | grep "PRETTY_NAME" | cut -d= -f2)"

# # 1. 定义变量，确保路径与你的 variables 配置一致
# BASE_DIR="/opt/conf"
# CONF_FILE="${BASE_DIR}/config.js"
# CONF_DIR="/usr/share/nginx/${SERVICE_NAME}"

# 2. 检查 conf/config.js 是否存在
# if [ ! -f "$CONF_FILE" ]; then
#     echo "检测到 $CONF_FILE 不存在，正在尝试初始化..."
#     mkdir -p "$BASE_DIR"
    
#     if [ -f "${CONF_DIR}/config.js" ]; then
#         if mv "${CONF_DIR}/config.js" "$CONF_FILE"; then
#             echo "初始化成功。"
#         else
#             echo "错误：mv 失败，请检查路径和权限"
#         fi
#     else
#         echo "错误：找不到初始化源文件 ${CONF_DIR}/config.js"
#     fi
# else
#     echo "配置文件已存在，跳过复制。"
# fi

# 2. 检查环境
echo ""
check_tool() {
    if command -v "$1" >/dev/null 2>&1; then
        echo "[$1] Found at: $(which "$1") (Version: $("$1" -v))"
    else
        echo "[$1] ❌ NOT FOUND"
        return 1
    fi
}
check_tool node || exit 1
check_tool npm

# 3. 智能路径跳转 🚀 (核心修改)
# 检查当前目录是否有 index.js，如果没有，尝试进入唯一的子目录
if [ ! -f "index.js" ]; then
    echo ""
    echo "[Path] index.js not found in $(pwd), searching subdirectories..."
    
    # 查找是否存在 fortune-service 目录
    if [ -d "fortune-service" ]; then
        cd fortune-service
        echo "[Path] 📂 Moved to: $(pwd)"
    else
        # 兜底：如果不知道名字，进入第一个含有 index.js 的子目录
        FOUND_DIR=$(find . -maxdepth 2 -name "index.js" -exec dirname {} \;)
        if [ -n "$FOUND_DIR" ] && [ "$FOUND_DIR" != "." ]; then
            cd "$FOUND_DIR"
            echo "[Path] 📂 Auto-detected code at: $(pwd)"
        fi
    fi
fi

# 4. 列出最终确定的目录文件
echo ""
echo "[Files] Content of $(pwd):"
ls -F

# 5. 启动逻辑
echo ""
echo "------------------------------------------"
if [ -f "index.js" ]; then
    echo "🚀 Launching Node application..."
    echo "------------------------------------------"
    # 使用 exec 确保 Node 进程能接收到容器停止信号
    exec node index.js
else
    echo "❌ ERROR: index.js still not found!"
    echo "Expected path: $(pwd)/index.js"
    exit 1
fi