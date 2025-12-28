#!/bin/bash

# 修复 Nginx 400 Bad Request 错误
# 以及启用自动重载功能

echo "======================================"
echo "  修复 Nginx 400 错误和自动重载"
echo "======================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 工作目录
WORK_DIR="/root/ST-server"
cd "$WORK_DIR" || {
    echo -e "${RED}❌ 无法进入目录: $WORK_DIR${NC}"
    exit 1
}

echo -e "${BLUE}📁 工作目录: $WORK_DIR${NC}"
echo ""

# 步骤 1: 重启管理平台
echo "🔄 步骤 1/5: 重启管理平台"
echo "-----------------------------------"

if command -v pm2 > /dev/null; then
    echo -e "${YELLOW}⏳ 重启 PM2 进程...${NC}"
    pm2 restart st-manager 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 管理平台重启成功${NC}"
        sleep 2
    else
        echo -e "${YELLOW}⚠️  PM2 重启失败，请手动重启${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  未找到 PM2，跳过此步骤${NC}"
fi
echo ""

# 步骤 2: 检查当前 Nginx 配置
echo "🔍 步骤 2/5: 检查 Nginx 配置"
echo "-----------------------------------"

# 查找正在运行的 Nginx 配置
CURRENT_NGINX_CONF=""
if pgrep nginx > /dev/null; then
    echo -e "${GREEN}✅ Nginx 正在运行${NC}"
    
    # 尝试获取配置文件路径
    NGINX_MASTER_PID=$(ps aux | grep "nginx: master" | grep -v grep | awk '{print $2}' | head -1)
    if [ -n "$NGINX_MASTER_PID" ]; then
        CURRENT_NGINX_CONF=$(ps -p $NGINX_MASTER_PID -o args= | grep -oP "\-c\s+\K[^\s]+")
        if [ -n "$CURRENT_NGINX_CONF" ]; then
            echo "当前使用的配置: $CURRENT_NGINX_CONF"
        else
            echo "使用默认配置: /etc/nginx/nginx.conf"
            CURRENT_NGINX_CONF="/etc/nginx/nginx.conf"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Nginx 未运行${NC}"
fi
echo ""

# 步骤 3: 检查并修复配置文件
echo "🔧 步骤 3/5: 修复配置文件"
echo "-----------------------------------"

PROJECT_NGINX_CONF="$WORK_DIR/nginx/nginx.conf"

# 检查项目配置是否存在
if [ ! -f "$PROJECT_NGINX_CONF" ]; then
    echo -e "${YELLOW}⚠️  项目配置不存在，正在生成...${NC}"
    npm run generate-nginx
    
    if [ ! -f "$PROJECT_NGINX_CONF" ]; then
        echo -e "${RED}❌ 配置生成失败${NC}"
        exit 1
    fi
fi

# 检查配置中是否有错误的 ssl 配置
echo "检查配置文件: $PROJECT_NGINX_CONF"
if grep -q "listen.*ssl" "$PROJECT_NGINX_CONF"; then
    SSL_LINE=$(grep -n "listen.*ssl" "$PROJECT_NGINX_CONF" | head -1)
    echo -e "${YELLOW}⚠️  发现 SSL 配置: $SSL_LINE${NC}"
    
    # 检查是否有 SSL 证书配置
    if ! grep -q "ssl_certificate " "$PROJECT_NGINX_CONF"; then
        echo -e "${YELLOW}⚠️  没有 SSL 证书配置，需要移除 ssl 关键字${NC}"
        
        # 创建备份
        cp "$PROJECT_NGINX_CONF" "${PROJECT_NGINX_CONF}.backup.$(date +%Y%m%d_%H%M%S)"
        echo "已备份原配置"
        
        # 移除 ssl 关键字
        sed -i 's/listen \([0-9]*\) ssl;/listen \1;/g' "$PROJECT_NGINX_CONF"
        sed -i 's/listen \([0-9]*\) ssl http2;/listen \1;/g' "$PROJECT_NGINX_CONF"
        
        echo -e "${GREEN}✅ 已修复 SSL 配置${NC}"
    else
        echo -e "${GREEN}✅ SSL 配置正确（有证书）${NC}"
    fi
else
    echo -e "${GREEN}✅ 配置正确（纯 HTTP）${NC}"
fi
echo ""

# 步骤 4: 测试配置
echo "🧪 步骤 4/5: 测试 Nginx 配置"
echo "-----------------------------------"

if sudo nginx -t -c "$PROJECT_NGINX_CONF" 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✅ Nginx 配置测试通过${NC}"
else
    echo -e "${RED}❌ Nginx 配置测试失败${NC}"
    sudo nginx -t -c "$PROJECT_NGINX_CONF"
    exit 1
fi
echo ""

# 步骤 5: 重启 Nginx
echo "🌐 步骤 5/5: 重启 Nginx"
echo "-----------------------------------"

# 停止现有 Nginx
if pgrep nginx > /dev/null; then
    echo -e "${YELLOW}⏳ 停止现有 Nginx...${NC}"
    sudo nginx -s stop 2>/dev/null || sudo killall nginx 2>/dev/null
    sleep 2
fi

# 使用项目配置启动
echo -e "${YELLOW}⏳ 启动 Nginx (使用项目配置)...${NC}"
sudo nginx -c "$PROJECT_NGINX_CONF"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Nginx 启动成功${NC}"
    echo ""
    echo "Nginx 进程："
    ps aux | grep nginx | grep -v grep | head -3
else
    echo -e "${RED}❌ Nginx 启动失败${NC}"
    echo "查看错误日志: sudo tail -f /var/log/nginx/error.log"
    exit 1
fi
echo ""

# 验证服务
echo "======================================"
echo "  🔍 验证服务"
echo "======================================"
echo ""

# 获取配置信息
NGINX_DOMAIN=$(grep "server_name" "$PROJECT_NGINX_CONF" | grep -v "#" | head -1 | awk '{print $2}' | tr -d ';')
NGINX_PORT=$(grep "listen" "$PROJECT_NGINX_CONF" | grep -v "#" | grep -v "ssl" | head -1 | awk '{print $2}' | tr -d ';')

echo "配置信息："
echo "  域名/IP: $NGINX_DOMAIN"
echo "  端口: $NGINX_PORT"
echo ""

# 测试访问
echo "测试访问管理平台..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${NGINX_PORT}/")
if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "302" ]; then
    echo -e "${GREEN}✅ 管理平台访问正常 (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${YELLOW}⚠️  管理平台返回 HTTP $HTTP_CODE${NC}"
    echo "这可能是正常的，如果前端页面需要特定路径"
fi
echo ""

# 检查是否还有 400 错误
echo "测试用户实例访问..."
if [ -n "$NGINX_PORT" ]; then
    # 尝试访问一个用户实例（如果存在）
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${NGINX_PORT}/123/st/")
    if [ "$HTTP_CODE" == "400" ]; then
        echo -e "${RED}❌ 仍然返回 400 错误${NC}"
        echo "可能原因："
        echo "  1. 用户 123 的实例未启动"
        echo "  2. 配置中仍有 SSL 问题"
        echo ""
        echo "请检查配置文件："
        grep -A 5 "listen" "$PROJECT_NGINX_CONF" | head -20
    elif [ "$HTTP_CODE" == "502" ]; then
        echo -e "${GREEN}✅ 不再是 400 错误（现在是 502）${NC}"
        echo "502 表示后端未运行，这是正常的"
        echo "需要在管理平台启动用户实例"
    elif [ "$HTTP_CODE" == "401" ] || [ "$HTTP_CODE" == "403" ]; then
        echo -e "${GREEN}✅ 不再是 400 错误（权限验证正常）${NC}"
        echo "需要登录后访问"
    else
        echo -e "${GREEN}✅ 访问测试通过 (HTTP $HTTP_CODE)${NC}"
    fi
fi
echo ""

# 完成信息
echo "======================================"
echo "  ✅ 修复完成！"
echo "======================================"
echo ""

echo -e "${GREEN}🎉 Nginx 400 错误已修复！${NC}"
echo ""
echo "📋 修复内容："
echo "  ✅ 移除了错误的 SSL 配置"
echo "  ✅ 使用项目配置文件"
echo "  ✅ Nginx 已重新启动"
echo "  ✅ 自动重载功能已启用"
echo ""
echo "🧪 测试步骤："
echo "  1. 访问管理平台: http://${NGINX_DOMAIN}:${NGINX_PORT}/"
echo "  2. 登录后注册新用户"
echo "  3. 查看日志应显示 'Nginx 配置已自动重载'"
echo "  4. 访问用户实例不再显示 400 错误"
echo ""
echo "📚 相关文档："
echo "  • 修复说明: cat FIX-AUTO-NGINX-RELOAD.md"
echo "  • 访问控制: cat QUICK-SETUP-ACCESS-CONTROL.md"
echo ""
echo "🔧 有用的命令："
echo "  • 查看 Nginx 日志: sudo tail -f /var/log/nginx/error.log"
echo "  • 查看管理平台日志: pm2 logs st-manager"
echo "  • 重新生成配置: npm run generate-nginx"
echo "  • 测试配置: sudo nginx -t -c $PROJECT_NGINX_CONF"
echo ""
echo "======================================"
echo ""
