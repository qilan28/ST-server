@echo off
echo ==================================
echo SillyTavern 多开管理平台 - 启动脚本
echo ==================================
echo.
echo 正在启动服务器...
echo.
echo 服务器将在 http://localhost:3000 上启动
echo.
echo 按 Ctrl+C 可以停止服务器
echo.

node server.js

echo.
echo 服务器已停止。按任意键退出...
pause > nul
