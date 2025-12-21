@echo off
echo 使用PM2启动所有服务...
cd ..
npx pm2 start ecosystem.config.js
npx pm2 save
echo 服务已启动，可以使用 "npx pm2 status" 查看状态
echo 使用 "npx pm2 logs" 查看日志
echo 使用 "npx pm2 stop all" 停止所有服务
pause
