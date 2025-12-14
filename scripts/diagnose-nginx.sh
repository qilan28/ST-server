#!/bin/bash

# Nginx 静态资源问题诊断脚本
# 用于快速检测 Nginx 配置和运行状态

echo "======================================"
echo "  Nginx 静态资源问题诊断工具"
echo "======================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
}

check_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 1. 检查 Nginx 进程
echo "1️⃣  检查 Nginx 进程"
echo "-----------------------------------"
if pgrep nginx > /dev/null; then
    check_pass "Nginx 正在运行"
    ps aux | grep nginx | grep -v grep
    echo ""
    
    # 检查使用的配置文件
    NGINX_CONFIG=$(ps aux | grep nginx | grep -o '\-c [^ ]*' | head -1 | cut -d' ' -f2)
    if [ -n "$NGINX_CONFIG" ]; then
        echo "📁 使用的配置文件: $NGINX_CONFIG"
    else
        check_warn "Nginx 可能使用默认配置"
    fi
else
    check_fail "Nginx 未运行"
    echo "尝试启动: sudo nginx -c /root/ST-server/nginx/nginx.conf"
fi
echo ""

# 2. 检查配置文件
echo "2️⃣  检查配置文件"
echo "-----------------------------------"
CONF_FILE="/root/ST-server/nginx/nginx.conf"
if [ -f "$CONF_FILE" ]; then
    check_pass "配置文件存在: $CONF_FILE"
    
    # 检查语法
    if sudo nginx -t -c "$CONF_FILE" 2>&1 | grep -q "successful"; then
        check_pass "配置文件语法正确"
    else
        check_fail "配置文件语法错误"
        sudo nginx -t -c "$CONF_FILE" 2>&1
    fi
    
    # 检查关键配置
    echo ""
    echo "🔍 关键配置检查:"
    
    if grep -q "sub_filter '<head>'" "$CONF_FILE"; then
        check_pass "找到 base 标签注入配置"
        grep "sub_filter '<head>'" "$CONF_FILE" | head -3
    else
        check_fail "未找到 base 标签注入配置"
        echo "   需要重新生成配置: node scripts/generate-nginx-config.js"
    fi
    
    if grep -q 'proxy_set_header Accept-Encoding ""' "$CONF_FILE"; then
        check_pass "找到 Accept-Encoding 禁用配置"
    else
        check_fail "未找到 Accept-Encoding 禁用配置（sub_filter 可能不工作）"
    fi
    
    if grep -q "sub_filter_types.*text/html" "$CONF_FILE"; then
        check_pass "找到 sub_filter_types 配置"
    else
        check_fail "未找到 sub_filter_types 配置"
    fi
    
    if grep -q "location ~ .*/(scripts|css|lib|img)" "$CONF_FILE"; then
        check_pass "找到静态资源专门处理配置"
    else
        check_warn "未找到静态资源专门处理配置（可能影响性能）"
    fi
    
else
    check_fail "配置文件不存在: $CONF_FILE"
    echo "请先生成配置: node scripts/generate-nginx-config.js"
fi
echo ""

# 3. 检查端口监听
echo "3️⃣  检查端口监听"
echo "-----------------------------------"
NGINX_PORT=$(grep "listen.*;" "$CONF_FILE" 2>/dev/null | grep -v "#" | head -1 | grep -oP '\d+')
if [ -n "$NGINX_PORT" ]; then
    echo "📌 配置的端口: $NGINX_PORT"
    
    if sudo netstat -tlnp 2>/dev/null | grep ":$NGINX_PORT" | grep nginx > /dev/null; then
        check_pass "Nginx 正在监听端口 $NGINX_PORT"
        sudo netstat -tlnp | grep ":$NGINX_PORT" | grep nginx
    else
        check_fail "Nginx 未监听端口 $NGINX_PORT"
        echo "可能的原因："
        echo "  1. Nginx 未运行"
        echo "  2. 端口被其他进程占用"
        echo ""
        echo "检查端口占用: sudo lsof -i :$NGINX_PORT"
    fi
else
    check_warn "无法从配置文件读取端口"
fi
echo ""

# 4. 检查防火墙
echo "4️⃣  检查防火墙"
echo "-----------------------------------"
if command -v ufw > /dev/null; then
    if sudo ufw status | grep -q "inactive"; then
        check_warn "防火墙未启用"
    else
        if [ -n "$NGINX_PORT" ] && sudo ufw status | grep -q "$NGINX_PORT"; then
            check_pass "端口 $NGINX_PORT 已在防火墙中开放"
        else
            check_fail "端口 $NGINX_PORT 未在防火墙中开放"
            echo "开放端口: sudo ufw allow $NGINX_PORT/tcp"
        fi
    fi
else
    check_warn "未安装 ufw 防火墙"
fi
echo ""

# 5. 检查用户实例
echo "5️⃣  检查用户实例"
echo "-----------------------------------"
if [ -f "$CONF_FILE" ]; then
    USERS=$(grep "upstream st_" "$CONF_FILE" | grep -oP "st_\K[^ ]+")
    if [ -n "$USERS" ]; then
        echo "📋 配置的用户："
        for user in $USERS; do
            PORT=$(grep -A 2 "upstream st_$user" "$CONF_FILE" | grep "server" | grep -oP '\d+')
            if [ -n "$PORT" ]; then
                echo -n "  • $user (端口 $PORT): "
                if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT" | grep -q "200\|302\|404"; then
                    echo -e "${GREEN}运行中${NC}"
                else
                    echo -e "${RED}未运行${NC}"
                fi
            fi
        done
    else
        check_warn "配置中未找到用户"
    fi
else
    check_fail "无法检查用户实例（配置文件不存在）"
fi
echo ""

# 6. 检查日志
echo "6️⃣  检查最近的错误日志"
echo "-----------------------------------"
ERROR_LOG="/var/log/nginx/error.log"
if [ -f "$ERROR_LOG" ]; then
    ERRORS=$(sudo tail -50 "$ERROR_LOG" | grep -i "error\|warn" | tail -10)
    if [ -n "$ERRORS" ]; then
        check_warn "发现最近的错误/警告"
        echo "$ERRORS"
    else
        check_pass "最近没有错误/警告"
    fi
else
    check_warn "错误日志文件不存在: $ERROR_LOG"
fi
echo ""

# 7. 测试访问
echo "7️⃣  测试访问"
echo "-----------------------------------"
if [ -n "$NGINX_PORT" ] && [ -n "$USERS" ]; then
    TEST_USER=$(echo "$USERS" | head -1)
    TEST_URL="http://127.0.0.1:$NGINX_PORT/$TEST_USER/st/"
    
    echo "测试 URL: $TEST_URL"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$TEST_URL")
    
    if [ "$HTTP_CODE" == "200" ]; then
        check_pass "页面访问成功 (HTTP $HTTP_CODE)"
        
        # 检查是否注入了 base 标签
        if curl -s "$TEST_URL" | grep -q '<head><base href='; then
            check_pass "检测到 base 标签注入"
        else
            check_fail "未检测到 base 标签注入（sub_filter 可能未生效）"
        fi
    else
        check_fail "页面访问失败 (HTTP $HTTP_CODE)"
    fi
else
    check_warn "跳过访问测试（缺少必要信息）"
fi
echo ""

# 总结和建议
echo "======================================"
echo "  🎯 诊断总结"
echo "======================================"
echo ""

# 统计问题数
ERRORS_FOUND=0

if ! pgrep nginx > /dev/null; then
    echo "• Nginx 未运行"
    ERRORS_FOUND=$((ERRORS_FOUND + 1))
fi

if [ ! -f "$CONF_FILE" ]; then
    echo "• 配置文件缺失"
    ERRORS_FOUND=$((ERRORS_FOUND + 1))
fi

if [ -f "$CONF_FILE" ] && ! grep -q "sub_filter '<head>'" "$CONF_FILE"; then
    echo "• base 标签注入配置缺失"
    ERRORS_FOUND=$((ERRORS_FOUND + 1))
fi

if [ $ERRORS_FOUND -eq 0 ]; then
    echo -e "${GREEN}🎉 未发现严重问题！${NC}"
    echo ""
    echo "如果静态资源仍然 404，请检查："
    echo "  1. 浏览器控制台（F12）的具体错误"
    echo "  2. 清除浏览器缓存后重试"
    echo "  3. 确认 SillyTavern 实例正在运行"
else
    echo -e "${RED}发现 $ERRORS_FOUND 个问题${NC}"
    echo ""
    echo "建议操作："
    echo "  1. 重新生成配置: node scripts/generate-nginx-config.js"
    echo "  2. 重启 Nginx: sudo nginx -s stop && sudo nginx -c $CONF_FILE"
    echo "  3. 查看详细错误: sudo tail -f /var/log/nginx/error.log"
fi

echo ""
echo "======================================"
echo "  📚 更多帮助"
echo "======================================"
echo ""
echo "详细修复方案: cat NGINX-STATIC-RESOURCE-FIX.md"
echo "子路径解决方案: cat NGINX-SUBPATH-SOLUTION.md"
echo "问题说明文档: cat NGINX-PATH-ISSUE.md"
echo ""
