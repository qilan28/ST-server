#!/bin/bash

# Nginx 配置部署脚本
# 自动部署生成的 Nginx 配置并重载服务

set -e  # 遇到错误立即退出

echo "=================================================="
echo "  Nginx 配置部署脚本"
echo "=================================================="
echo ""

# 检查是否以 root 权限运行
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 错误：此脚本需要 root 权限运行"
    echo "💡 请使用: sudo bash scripts/deploy-nginx.sh"
    exit 1
fi

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
NGINX_CONF_FILE="$PROJECT_DIR/nginx/nginx.conf"

# 检查配置文件是否存在
if [ ! -f "$NGINX_CONF_FILE" ]; then
    echo "❌ 错误：配置文件不存在: $NGINX_CONF_FILE"
    echo "💡 请先运行: npm run generate-nginx"
    exit 1
fi

echo "✅ 找到配置文件: $NGINX_CONF_FILE"
echo ""

# 检测 Nginx 配置目录
NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"
SITE_NAME="sillytavern"

# 如果使用的是单一配置文件方式（如 CentOS）
if [ ! -d "$NGINX_AVAILABLE" ]; then
    NGINX_AVAILABLE="/etc/nginx/conf.d"
    NGINX_ENABLED="/etc/nginx/conf.d"
    SITE_NAME="sillytavern.conf"
    echo "📁 检测到 CentOS/RHEL 风格配置"
else
    echo "📁 检测到 Ubuntu/Debian 风格配置"
fi

echo ""
echo "📋 步骤 1: 备份现有配置（如果存在）"
if [ -f "$NGINX_AVAILABLE/$SITE_NAME" ]; then
    BACKUP_FILE="$NGINX_AVAILABLE/${SITE_NAME}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$NGINX_AVAILABLE/$SITE_NAME" "$BACKUP_FILE"
    echo "✅ 已备份到: $BACKUP_FILE"
else
    echo "ℹ️  没有现有配置需要备份"
fi

echo ""
echo "📋 步骤 2: 复制新配置到 Nginx 目录"
cp "$NGINX_CONF_FILE" "$NGINX_AVAILABLE/$SITE_NAME"
echo "✅ 配置已复制到: $NGINX_AVAILABLE/$SITE_NAME"

# 如果使用 sites-available/sites-enabled 结构
if [ "$NGINX_AVAILABLE" = "/etc/nginx/sites-available" ]; then
    echo ""
    echo "📋 步骤 3: 创建符号链接"
    if [ -L "$NGINX_ENABLED/$SITE_NAME" ]; then
        echo "ℹ️  符号链接已存在"
    else
        ln -s "$NGINX_AVAILABLE/$SITE_NAME" "$NGINX_ENABLED/$SITE_NAME"
        echo "✅ 已创建符号链接"
    fi
fi

echo ""
echo "📋 步骤 $([ "$NGINX_AVAILABLE" = "/etc/nginx/sites-available" ] && echo "4" || echo "3"): 测试 Nginx 配置"
if nginx -t; then
    echo "✅ Nginx 配置测试通过"
else
    echo "❌ Nginx 配置测试失败"
    echo "💡 请检查配置文件: $NGINX_AVAILABLE/$SITE_NAME"
    exit 1
fi

echo ""
echo "📋 步骤 $([ "$NGINX_AVAILABLE" = "/etc/nginx/sites-available" ] && echo "5" || echo "4"): 重载 Nginx 配置"
if systemctl reload nginx 2>/dev/null || nginx -s reload; then
    echo "✅ Nginx 已重载配置"
else
    echo "⚠️  重载失败，尝试重启 Nginx..."
    if systemctl restart nginx; then
        echo "✅ Nginx 已重启"
    else
        echo "❌ Nginx 重启失败"
        exit 1
    fi
fi

echo ""
echo "=================================================="
echo "  🎉 部署完成！"
echo "=================================================="
echo ""
echo "📊 部署信息："
echo "   配置文件: $NGINX_AVAILABLE/$SITE_NAME"
[ "$NGINX_AVAILABLE" = "/etc/nginx/sites-available" ] && echo "   符号链接: $NGINX_ENABLED/$SITE_NAME"
echo ""
echo "🔍 验证步骤："
echo "   1. 检查 Nginx 状态: systemctl status nginx"
echo "   2. 查看访问日志: tail -f /var/log/nginx/access.log"
echo "   3. 查看错误日志: tail -f /var/log/nginx/error.log"
echo "   4. 测试访问: curl http://你的IP:端口/"
echo ""
echo "💡 如果无法访问，请检查："
echo "   - 用户实例是否已启动（在管理员面板查看）"
echo "   - 防火墙是否开放端口"
echo "   - SELinux 是否阻止连接（CentOS/RHEL）"
echo ""
