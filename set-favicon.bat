@echo off
echo 开始设置默认网站图标...
node scripts/set-default-favicon.js
if %errorlevel% equ 0 (
    echo.
    echo 设置默认图标成功！
    echo.
) else (
    echo.
    echo 设置默认图标失败，请查看错误信息。
    echo.
)
pause
