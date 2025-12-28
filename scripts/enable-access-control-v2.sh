#!/bin/bash

# 一键启用访问权限控制脚本 V2
# 使用新的自动配置生成方式

echo "======================================"
echo "  启用 SillyTavern 访问权限控制 V2"
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

# 步骤 1: 检查并安装依赖
echo "🔧 步骤 1/5: 检查依赖"
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

# 步骤 2: 更新配置文件
echo "📋 步骤 2/5: 更新配置文件"
echo "-----------------------------------"

CONFIG_FILE="$WORK_DIR/config.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}⚠️  配置文件不存在，正在创建...${NC}"
    cat > "$CONFIG_FILE" << 'EOF'
{
  "nginx": {
    "enabled": true,
    "domain": "localhost",
    "port": 80,
    "enableAccessControl": true
  },
  "system": {
    "port": 3000,
    "allowRegistration": true,
    "maxUsers": 100
  }
}
EOF
    echo -e "${GREEN}✅ 配置文件已创建${NC}"
else
    echo -e "${GREEN}✅ 配置文件已存在${NC}"
    
    # 检查是否已经启用访问控制
    if grep -q '"enableAccessControl".*true' "$CONFIG_FILE"; then
        echo -e "${GREEN}✅ 访问控制已启用${NC}"
    else
        echo -e "${YELLOW}⏳ 正在启用访问控制...${NC}"
        
        # 使用 jq 更新配置（如果有的话）
        if command -v jq > /dev/null; then
            TMP_FILE=$(mktemp)
            jq '.nginx.enableAccessControl = true' "$CONFIG_FILE" > "$TMP_FILE"
            mv "$TMP_FILE" "$CONFIG_FILE"
            echo -e "${GREEN}✅ 配置已更新${NC}"
        else
            echo -e "${YELLOW}⚠️  jq 未安装，请手动编辑 config.json${NC}"
            echo "添加或修改: \"enableAccessControl\": true"
        fi
    fi
fi
echo ""

# 步骤 3: 检查访问拒绝页面
echo "🎨 步骤 3/5: 检查访问拒绝页面"
echo "-----------------------------------"

ACCESS_DENIED_PAGE="$WORK_DIR/public/access-denied.html"

if [ -f "$ACCESS_DENIED_PAGE" ]; then
    echo -e "${GREEN}✅ 访问拒绝页面已存在${NC}"
else
    echo -e "${YELLOW}⏳ 正在创建访问拒绝页面...${NC}"
    mkdir -p "$WORK_DIR/public"
    
    cat > "$ACCESS_DENIED_PAGE" << 'HTMLEOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>访问被拒绝 - Access Denied</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
        }
        
        .container {
            background: rgba(255, 255, 255, 0.95);
            padding: 60px 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 90%;
            text-align: center;
        }
        
        .icon {
            font-size: 80px;
            margin-bottom: 20px;
        }
        
        h1 {
            color: #e74c3c;
            margin-bottom: 20px;
            font-size: 28px;
        }
        
        p {
            line-height: 1.6;
            margin-bottom: 15px;
            color: #555;
        }
        
        .reasons {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
        }
        
        .reasons h3 {
            color: #333;
            margin-bottom: 10px;
            font-size: 16px;
        }
        
        .reasons ul {
            list-style: none;
        }
        
        .reasons li {
            padding: 8px 0;
            color: #666;
        }
        
        .reasons li:before {
            content: "•";
            color: #e74c3c;
            font-weight: bold;
            display: inline-block;
            width: 1em;
            margin-left: -1em;
        }
        
        .buttons {
            margin-top: 30px;
        }
        
        .button {
            display: inline-block;
            padding: 12px 30px;
            margin: 5px;
            background: #3498db;
            color: white;
            text-decoration: none;
            border-radius: 25px;
            transition: all 0.3s ease;
            font-weight: 500;
        }
        
        .button:hover {
            background: #2980b9;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(52, 152, 219, 0.4);
        }
        
        .button.secondary {
            background: #95a5a6;
        }
        
        .button.secondary:hover {
            background: #7f8c8d;
        }
        
        @media (max-width: 600px) {
            .container {
                padding: 40px 20px;
            }
            
            h1 {
                font-size: 24px;
            }
            
            .icon {
                font-size: 60px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🔒</div>
        <h1>访问被拒绝</h1>
        <p>很抱歉，您没有权限访问此资源。</p>
        
        <div class="reasons">
            <h3>可能的原因：</h3>
            <ul>
                <li>您尚未登录系统</li>
                <li>您尝试访问其他用户的实例</li>
                <li>您的登录会话已过期</li>
                <li>您的账户权限不足</li>
            </ul>
        </div>
        
        <p>如有疑问，请联系管理员。</p>
        
        <div class="buttons">
            <a href="/" class="button">返回首页</a>
            <a href="/login.html" class="button secondary">重新登录</a>
        </div>
    </div>
</body>
</html>
HTMLEOF
    
    echo -e "${GREEN}✅ 访问拒绝页面已创建${NC}"
fi
echo ""

# 步骤 4: 重新生成 Nginx 配置
echo "🌐 步骤 4/5: 重新生成 Nginx 配置"
echo "-----------------------------------"

echo -e "${YELLOW}⏳ 正在生成 Nginx 配置...${NC}"
npm run generate-nginx

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Nginx 配置生成成功${NC}"
    
    # 测试配置
    NGINX_CONF="$WORK_DIR/nginx/nginx.conf"
    if [ -f "$NGINX_CONF" ]; then
        echo -e "${YELLOW}⏳ 测试 Nginx 配置...${NC}"
        
        if sudo nginx -t -c "$NGINX_CONF" 2>&1 | grep -q "successful"; then
            echo -e "${GREEN}✅ Nginx 配置测试通过${NC}"
        else
            echo -e "${RED}❌ Nginx 配置测试失败${NC}"
            sudo nginx -t -c "$NGINX_CONF"
            exit 1
        fi
    fi
else
    echo -e "${RED}❌ Nginx 配置生成失败${NC}"
    exit 1
fi
echo ""

# 步骤 5: 重启服务
echo "🔄 步骤 5/5: 重启服务"
echo "-----------------------------------"

# 重启管理平台
if command -v pm2 > /dev/null; then
    echo -e "${YELLOW}⏳ 重启管理平台...${NC}"
    pm2 restart st-manager 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 管理平台重启成功${NC}"
    else
        echo -e "${YELLOW}⚠️  PM2 重启失败，请手动重启${NC}"
    fi
fi

# 重启 Nginx
echo -e "${YELLOW}⏳ 重启 Nginx...${NC}"

if pgrep nginx > /dev/null; then
    sudo nginx -s stop 2>/dev/null
    sleep 2
fi

NGINX_CONF="$WORK_DIR/nginx/nginx.conf"
if [ -f "$NGINX_CONF" ]; then
    sudo nginx -c "$NGINX_CONF"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Nginx 启动成功${NC}"
    else
        echo -e "${RED}❌ Nginx 启动失败${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Nginx 配置文件不存在${NC}"
    exit 1
fi
echo ""

# 完成信息
echo "======================================"
echo "  ✅ 访问控制已启用！"
echo "======================================"
echo ""

echo -e "${GREEN}🎉 访问权限控制已成功启用！${NC}"
echo ""
echo "📋 配置信息："
echo "  • 配置文件: $CONFIG_FILE"
echo "  • Nginx 配置: $NGINX_CONF"
echo "  • 访问拒绝页面: $ACCESS_DENIED_PAGE"
echo ""
echo "🔒 访问控制规则："
echo "  • 用户只能访问自己的实例"
echo "  • 未登录用户无法访问任何实例"
echo "  • 管理员可以访问所有实例"
echo ""
echo "🧪 测试步骤："
echo "  1. 登录用户 A: http://your-domain:port/"
echo "  2. 访问用户 A 的实例: http://your-domain:port/A/st/ → ✅ 成功"
echo "  3. 访问用户 B 的实例: http://your-domain:port/B/st/ → ❌ 拒绝"
echo ""
echo "📚 相关文档："
echo "  • 详细说明: cat ACCESS-CONTROL.md"
echo "  • 快速指南: cat ENABLE-ACCESS-CONTROL-QUICK.md"
echo ""
echo "🔧 有用的命令："
echo "  • 查看管理平台日志: pm2 logs st-manager"
echo "  • 查看 Nginx 日志: sudo tail -f /var/log/nginx/error.log"
echo "  • 重新生成配置: npm run generate-nginx"
echo "  • 禁用访问控制: 修改 config.json 中 enableAccessControl 为 false"
echo ""
echo "======================================"
echo ""
