@echo off
echo ==================================================================
echo           Cloudflare Tunnel 路由修复工具
echo ==================================================================
echo.

echo 步骤 1: 重新生成 Nginx 配置文件...
node scripts\generate-nginx-config.js
IF %ERRORLEVEL% NEQ 0 (
    echo [错误] Nginx 配置生成失败！
    goto :error
)
echo.

echo 步骤 2: 创建日志目录...
mkdir logs 2>nul
echo.

echo 步骤 3: 检查用户实例状态...
echo 请输入要检查的用户名（如 123456）:
set /p username="> "
IF "%username%"=="" goto :no_username

node scripts\debug-user-instance.js %username%
IF %ERRORLEVEL% NEQ 0 (
    echo [警告] 用户实例检查失败，但继续执行...
)
echo.

echo 步骤 4: 提供 Cloudflare Tunnel 配置建议...
echo 为了让您的 Cloudflare Tunnel 正常工作，请确保:
echo.
echo 1. 使用以下配置编辑 Cloudflare Tunnel 的 config.yml 文件:
echo    tunnel: 您的隧道ID
echo    credentials-file: 您的证书路径
echo    ingress:
echo      - hostname: 您的域名（例如 sts.qilan.sbs）
echo      - service: http://localhost:3000
echo      - service: http_status:404
echo.
echo 2. 使用正确的参数运行 Cloudflare Tunnel:
echo    cloudflared tunnel run 您的隧道名称
echo.

echo 步骤 5: 重启 Nginx（如果已安装）...
taskkill /F /IM nginx.exe 2>nul
start nginx -c "%cd%\nginx\nginx.conf"
echo.

echo ==================================================================
echo                      修复过程完成
echo ==================================================================
echo 请按任意键退出...
pause > nul
exit /b 0

:error
echo.
echo 修复过程失败，请检查错误信息！
pause > nul
exit /b 1

:no_username
echo.
echo 未提供用户名，跳过用户实例检查步骤...
echo.
goto :eof
