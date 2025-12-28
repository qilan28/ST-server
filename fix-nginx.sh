#!/bin/bash

# 修复Nginx配置脚本
echo "===== 修复Nginx配置 ====="
echo "此脚本将替换当前的Nginx配置并重载服务"

# 检查Node.js环境
if ! command -v node &> /dev/null; then
    echo "错误: 未找到Node.js，请先安装Node.js"
    exit 1
fi

# 执行修复脚本
cd "$(dirname "$0")"
node --experimental-modules utils/use-fixed-nginx.js

# 结束
echo "===== 操作完成 ====="
