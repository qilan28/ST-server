#!/bin/bash

echo "=== 检查环境变量 ==="
echo "NODE_ENV: $NODE_ENV"

echo ""
echo "=== 检查 PM2 环境变量 ==="
pm2 env 0 | grep NODE_ENV

echo ""
echo "=== 如果 NODE_ENV=production ==="
echo "但你用的是 HTTP 访问（不是 HTTPS）"
echo "那么 secure cookie 会被浏览器拒绝！"
echo ""
echo "解决方法："
echo "1. 移除 NODE_ENV=production"
echo "2. 或者使用 HTTPS"
echo "3. 或者修改 routes/auth.js，设置 secure: false"
