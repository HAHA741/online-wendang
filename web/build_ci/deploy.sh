#!/bin/sh

echo "------------------------------------------"
echo "🔍 Starting Environment Check..."
echo "------------------------------------------"

# 1. 检查环境
echo "[System] Current User: $(whoami)"
echo "[System] Current Workdir: $(pwd)"

# 2. 检查环境变量和服务
echo ""
echo "[Service] SERVICE_NAME: ${SERVICE_NAME}"
echo "[Service] LOCAL_IP: ${LOCAL_IP}"

echo ""
echo "------------------------------------------"
echo "🚀 Launching services..."
echo "------------------------------------------"
# --- 调试信息开始 ---
echo ""
echo "📂 [Debug] Checking Nginx configurations in /etc/nginx/conf.d/:"
ls -F /etc/nginx/conf.d/

if [ -f "/etc/nginx/conf.d/customApp.conf" ]; then
    echo "📄 [Debug] Content of customApp.conf:"
    cat /etc/nginx/conf.d/customApp.conf
fi

echo ""
echo "📂 [Debug] Checking files in /usr/share/nginx/${SERVICE_NAME}:"
if [ -d "/usr/share/nginx/${SERVICE_NAME}" ]; then
    ls -R "/usr/share/nginx/${SERVICE_NAME}"
else
    echo "❌ [Error] Directory /usr/share/nginx/${SERVICE_NAME} NOT FOUND!"
fi
# --- 调试信息结束 ---

# 启动 nginx
echo "[nginx] Starting nginx..."
# ... 后面接你原本的 nginx 启动命令
# 3. 启动 nginx
echo "[nginx] Configuring and starting nginx..."

# 自定义nginx配置
if [ ! -f "/etc/nginx/conf.d/customApp.conf" ]; then
    if [ -d "/usr/share/nginx/${SERVICE_NAME}" ]; then
        mv /usr/share/nginx/${SERVICE_NAME}/customApp.conf /etc/nginx/conf.d/
    fi
fi

# 替换容器内的127.0.0.1为容器外的地址
if [ -f "/etc/nginx/conf.d/customApp.conf" ]; then
    sed -i "s/127.0.0.1/${LOCAL_IP}/g" /etc/nginx/conf.d/customApp.conf
fi

# 删除掉不满足我们需求的nginx配置
if [ -f "/etc/nginx/conf.d/default.conf" ]; then
    rm -rf /etc/nginx/conf.d/default.conf
fi

# 启动 nginx
echo "[nginx] Starting nginx..."
nginx -s stop 2>/dev/null || true
exec nginx -g "daemon off;"