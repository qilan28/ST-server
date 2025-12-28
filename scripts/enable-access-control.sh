#!/bin/bash

# 一键启用访问权限控制脚本

echo "======================================"
echo "  启用 SillyTavern 访问权限控制"
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

# 步骤 1: 安装依赖
echo "🔧 步骤 1/4: 安装依赖"
echo "-----------------------------------"

if npm list cookie-parser > /dev/null 2>&1; then
    echo -e "${GREEN}✅ cookie-parser 已安装${NC}"
else
    echo -e "${YELLOW}⏳ 正在安装 cookie-parser...${NC}"
    npm install cookie-parser
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ cookie-parser 安装成功${NC}"
    else
        echo -e "${RED}❌ cookie-parser 安装失败${NC}"
        exit 1
    fi
fi
echo ""

# 步骤 2: 检查配置文件
echo "📋 步骤 2/4: 检查配置文件"
echo "-----------------------------------"

AUTH_CONF="$WORK_DIR/nginx/nginx-with-auth.conf"
if [ -f "$AUTH_CONF" ]; then
    echo -e "${GREEN}✅ 找到权限控制配置: $AUTH_CONF${NC}"
else
    echo -e "${RED}❌ 配置文件不存在: $AUTH_CONF${NC}"
    echo "请确保已从仓库中获取最新文件"
    exit 1
fi

# 测试配置语法
echo -e "${YELLOW}⏳ 测试 Nginx 配置语法...${NC}"
sudo nginx -t -c "$AUTH_CONF" 2>&1 | grep -q "successful"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Nginx 配置语法正确${NC}"
else
    echo -e "${RED}❌ Nginx 配置语法错误${NC}"
    sudo nginx -t -c "$AUTH_CONF"
    exit 1
fi
echo ""

# 步骤 3: 重启管理平台
echo "🔄 步骤 3/4: 重启管理平台"
echo "-----------------------------------"

if command -v pm2 > /dev/null; then
    echo -e "${YELLOW}⏳ 重启 PM2 进程...${NC}"
    pm2 restart st-manager 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 管理平台重启成功${NC}"
        echo ""
        echo "进程状态："
        pm2 list | grep st-manager
    else
        echo -e "${YELLOW}⚠️  PM2 重启失败，尝试直接启动...${NC}"
        echo "请手动运行: npm start"
    fi
else
    echo -e "${YELLOW}⚠️  未找到 PM2，请手动重启服务${NC}"
    echo "运行命令: npm start"
fi
echo ""

# 步骤 4: 应用 Nginx 配置
echo "🌐 步骤 4/4: 应用 Nginx 配置"
echo "-----------------------------------"

# 检查 Nginx 是否正在运行
if pgrep nginx > /dev/null; then
    echo -e "${YELLOW}⏳ 停止现有 Nginx...${NC}"
    sudo nginx -s stop
    sleep 2
fi

# 启动新配置
echo -e "${YELLOW}⏳ 启动 Nginx (使用权限控制配置)...${NC}"
sudo nginx -c "$AUTH_CONF"

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

# 检查端口监听
NGINX_PORT=7092
if sudo netstat -tlnp 2>/dev/null | grep ":$NGINX_PORT" | grep nginx > /dev/null; then
    echo -e "${GREEN}✅ Nginx 正在监听端口 $NGINX_PORT${NC}"
else
    echo -e "${RED}❌ Nginx 未监听端口 $NGINX_PORT${NC}"
fi

# 检查管理平台
MANAGER_PORT=3000
if sudo netstat -tlnp 2>/dev/null | grep ":$MANAGER_PORT" | grep -E "node|pm2" > /dev/null; then
    echo -e "${GREEN}✅ 管理平台正在监听端口 $MANAGER_PORT${NC}"
else
    echo -e "${YELLOW}⚠️  管理平台未监听端口 $MANAGER_PORT${NC}"
fi

echo ""

# 测试访问
echo "======================================"
echo "  🧪 快速测试"
echo "======================================"
echo ""

echo "测试管理平台..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$NGINX_PORT/")
if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "302" ]; then
    echo -e "${GREEN}✅ 管理平台访问正常 (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${YELLOW}⚠️  管理平台返回 HTTP $HTTP_CODE${NC}"
fi

echo ""
echo "测试权限验证..."
# 测试未授权访问（应该返回错误页面）
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$NGINX_PORT/123/st/")
if [ "$HTTP_CODE" == "302" ] || [ "$HTTP_CODE" == "401" ] || [ "$HTTP_CODE" == "403" ]; then
    echo -e "${GREEN}✅ 权限验证正常 (未授权访问被拦截，HTTP $HTTP_CODE)${NC}"
else
    echo -e "${YELLOW}⚠️  权限验证返回 HTTP $HTTP_CODE${NC}"
    echo "   预期: 302/401/403 (未授权访问被拦截)"
fi

echo ""

# 完成信息
echo "======================================"
echo "  ✅ 配置完成！"
echo "======================================"
echo ""

echo -e "${GREEN}🎉 访问权限控制已启用！${NC}"
echo ""
echo "📋 功能说明："
echo "  • 用户只能访问自己的 SillyTavern 实例"
echo "  • 未授权访问会跳转到友好的错误页面"
echo "  • 登录后 JWT Token 会自动保存在 Cookie 中"
echo ""
echo "🧪 测试步骤："
echo "  1. 浏览器无痕模式访问: http://你的IP:7092/123/st/"
echo "     → 应该看到 '访问被拒绝' 页面"
echo ""
echo "  2. 访问 http://你的IP:7092/login.html 登录为用户 123"
echo "     → 登录成功后再访问 /123/st/"
echo "     → 应该正常显示 SillyTavern"
echo ""
echo "  3. 保持用户 123 登录，尝试访问 /222/st/"
echo "     → 应该看到 '访问被拒绝' 页面"
echo ""
echo "📚 相关文档："
echo "  • 详细指南: cat ACCESS-CONTROL-GUIDE.md"
echo "  • 故障排查: cat ACCESS-CONTROL-GUIDE.md (🐛 故障排查部分)"
echo ""
echo "🔧 有用的命令："
echo "  • 查看 Nginx 日志: sudo tail -f /var/log/nginx/error.log"
echo "  • 查看管理平台日志: pm2 logs st-manager"
echo "  • 重启 Nginx: sudo nginx -s reload"
echo "  • 测试验证接口: curl -v http://127.0.0.1:3000/api/auth-check/verify/123"
echo ""
echo "======================================"
echo ""

# 询问是否查看实时日志
read -p "是否查看实时日志？(y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "显示 Nginx 错误日志 (Ctrl+C 退出)..."
    echo "-----------------------------------"
    sudo tail -f /var/log/nginx/error.log
fi
