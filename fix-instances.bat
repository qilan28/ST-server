@echo off
echo ==================================
echo SillyTavern 多开管理平台 - 实例修复工具
echo ==================================
echo.
echo 此脚本将修复用户面板的实例启动问题
echo.
echo 按任意键开始修复...
pause > nul
echo.
echo 开始修复程序...
echo.

node reset-instances.js

echo.
echo 修复完成！请按任意键退出，然后运行 start.bat 重启服务器
pause > nul
