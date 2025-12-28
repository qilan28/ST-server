#!/bin/bash

# Nginx 独立启动脚本
# 使用生成的配置文件直接启动 Nginx（不依赖系统配置）

set -e

echo "=================================================="
echo "  Nginx 独立启动脚本"
echo "=================================================="
echo ""

# 检查是否以 root 权限运行
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 错误：此脚本需要 root 权限运行"
    echo "💡 请使用: sudo bash scripts/start-nginx-standalone.sh"
    exit 1
fi

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
NGINX_CONF="$PROJECT_DIR/nginx/nginx.conf"

# 检查配置文件是否存在
if [ ! -f "$NGINX_CONF" ]; then
    echo "❌ 错误：配置文件不存在: $NGINX_CONF"
    echo "💡 请先运行: npm run generate-nginx"
    exit 1
fi

echo "✅ 找到配置文件: $NGINX_CONF"
echo ""

# 检测系统类型并设置正确的用户
if grep -q "Ubuntu\|Debian" /etc/os-release 2>/dev/null; then
    NGINX_USER="www-data"
    echo "📋 检测到 Ubuntu/Debian 系统，使用用户: $NGINX_USER"
elif grep -q "CentOS\|Red Hat\|Fedora" /etc/os-release 2>/dev/null; then
    NGINX_USER="nginx"
    echo "📋 检测到 CentOS/RHEL 系统，使用用户: $NGINX_USER"
else
    NGINX_USER="nginx"
    echo "⚠️  未知系统，默认使用用户: $NGINX_USER"
fi

# 修改配置文件中的用户设置
echo ""
echo "📋 步骤 1: 设置 Nginx 用户为 $NGINX_USER"
sed -i "s/^user .*/user $NGINX_USER;/" "$NGINX_CONF"
echo "✅ 用户设置完成"

# 测试配置
echo ""
echo "📋 步骤 2: 测试配置文件"
if nginx -t -c "$NGINX_CONF"; then
    echo "✅ 配置测试通过"
else
    echo "❌ 配置测试失败"
    echo "💡 请检查配置文件: $NGINX_CONF"
    exit 1
fi

# 检查是否已有 Nginx 在运行
echo ""
echo "📋 步骤 3: 检查现有 Nginx 进程"
if pgrep nginx > /dev/null; then
    echo "⚠️  检测到 Nginx 正在运行"
    read -p "是否停止现有 Nginx 并使用新配置启动？(y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🛑 停止现有 Nginx..."
        if systemctl is-active --quiet nginx; then
            systemctl stop nginx
        else
            pkill nginx || true
        fi
        sleep 2
        echo "✅ 已停止"
    else
        echo "❌ 用户取消操作"
        exit 0
    fi
else
    echo "✅ 没有运行中的 Nginx"
fi

# 启动 Nginx
echo ""
echo "📋 步骤 4: 启动 Nginx"
nginx -c "$NGINX_CONF"

# 等待启动
sleep 2

# 检查是否启动成功
if pgrep nginx > /dev/null; then
    echo "✅ Nginx 启动成功！"
    echo ""
    echo "=================================================="
    echo "  🎉 启动完成！"
    echo "=================================================="
    echo ""
    echo "📊 进程信息："
    ps aux | grep nginx | grep -v grep
    echo ""
    echo "📝 管理命令："
    echo "   查看日志: tail -f /var/log/nginx/error.log"
    echo "   重载配置: nginx -s reload"
    echo "   停止服务: nginx -s stop"
    echo "   或: pkill nginx"
    echo ""
    echo "🔍 验证访问："
    echo "   curl http://localhost:$(grep 'listen' $NGINX_CONF | grep -o '[0-9]\+' | head -1)"
    echo ""
else
    echo "❌ Nginx 启动失败"
    echo "💡 查看错误日志: tail -f /var/log/nginx/error.log"
    exit 1
fi
