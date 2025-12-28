@echo off
echo ==================================
echo  Nginx 配置重复指令修复工具
echo ==================================
echo.
echo 此脚本将修复 Nginx 配置中的重复指令问题
echo 特别是 "proxy_pass_request_headers" 重复导致的 400 错误
echo.
echo 按任意键开始修复...
pause > nul
echo.

node fix-nginx-duplicate.js

echo.
echo 修复完成！按任意键退出
pause > nul
