@echo off
echo ==================================
echo  SillyTavern 多开管理平台 - Nginx 配置修复工具
echo ==================================
echo.
echo 此脚本将修复以下问题:
echo  1. Nginx 配置没有加载问题
echo  2. 400 Bad Request 错误
echo  3. 确保使用正确的配置文件
echo.
echo 按任意键开始修复...
pause > nul
echo.

echo 步骤 1: 重新生成 Nginx 配置...
call npm run generate-nginx

echo.
echo 步骤 2: 确保 Nginx 使用正确配置...
node scripts/ensure-nginx-config.js

echo.
echo 步骤 3: 重启服务器...
echo 按任意键重启服务器，或关闭此窗口手动重启
pause > nul
npm start
