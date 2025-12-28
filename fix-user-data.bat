@echo off
echo 正在修复用户数据目录结构...
node --experimental-modules --es-module-specifier-resolution=node scripts/fix-user-data-directories.js
pause
