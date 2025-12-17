@echo off
echo 开始修复数据库问题...
echo.

cd /d "%~dp0"

REM 检查数据库文件是否存在
if exist database.sqlite (
    echo 找到现有数据库文件，将先备份...
    if not exist backups mkdir backups
    copy database.sqlite "backups\database_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%.sqlite" >nul
    echo 数据库已备份。
    echo.
)

REM 运行修复脚本
echo 正在运行数据库修复脚本...
node fix-database-permission.js
echo.

echo 修复过程完成。
echo 请重启服务器以应用更改。
echo.
pause
