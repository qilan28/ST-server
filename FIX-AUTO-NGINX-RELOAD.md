# 🔧 修复：自动 Nginx 配置更新

## 📋 修复的问题

### 问题 1：新用户注册后需要手动生成 Nginx 配置
**现象**：新用户注册成功后，管理员需要手动到面板点击"保存配置"才能生成Nginx配置。

**解决方案**：✅ 已修复
- 用户注册时自动生成并重载 Nginx 配置
- 管理员点击"保存配置"时自动重载

### 问题 2：Nginx 配置重载不生效
**现象**：生成配置文件后，需要手动运行 `nginx -s reload`。

**解决方案**：✅ 已修复
- 自动尝试多种重载方式：信号 → systemctl → 重启
- 添加日志记录重载状态
- 提供状态检查API

### 问题 3：400 Bad Request - plain HTTP sent to HTTPS port
**现象**：访问 `http://119.8.118.149:7092/123/st/` 返回 400 错误。

**原因**：Nginx 配置文件中 `listen` 指令配置错误

**解决方案**：见下文

---

## 🚀 部署修复

### 步骤 1：重启管理平台

```bash
cd /root/ST-server

# 重启服务以应用新代码
pm2 restart st-manager

# 查看日志
pm2 logs st-manager --lines 20
```

### 步骤 2：测试自动重载功能

#### 测试用户注册自动更新

```bash
# 注册新用户（使用API或网页）
curl -X POST http://127.0.0.1:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"123456","email":"test@example.com"}'

# 查看日志，应该看到：
# [Register] 新用户 testuser 注册成功，正在更新 Nginx 配置...
# [Register] Nginx 配置文件已生成
# [Register] ✅ Nginx 配置已自动重载 (方式: signal)
```

#### 测试管理员生成配置自动重载

```bash
# 登录获取 token
TOKEN=$(curl -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}' | jq -r .token)

# 生成配置
curl -X POST http://127.0.0.1:3000/api/config/nginx/generate \
  -H "Authorization: Bearer $TOKEN"

# 查看响应，应该包含：
# "message": "Nginx configuration file generated and reloaded successfully"
# "reloadMethod": "signal" 或 "systemctl" 或 "restart"
```

---

## ⚠️ 修复 400 Bad Request 错误

### 检查当前 Nginx 配置

```bash
# 检查 Nginx 实际使用的配置
ps aux | grep nginx

# 查看主进程的配置文件路径
nginx -V 2>&1 | grep "configure arguments" | grep -o "conf-path=[^ ]*"

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```

### 问题原因

从图片看到的错误：
```
400 Bad Request
The plain HTTP request was sent to HTTPS port
```

这说明 Nginx 配置文件中的 `listen` 指令可能是这样的：
```nginx
listen 7092 ssl;  # ❌ 错误：没有SSL证书但配置了ssl
```

### 正确的配置

应该是：
```nginx
listen 7092;  # ✅ 正确：纯 HTTP
```

或者如果确实要用 HTTPS：
```nginx
listen 7092 ssl;
ssl_certificate /path/to/cert.pem;
ssl_certificate_key /path/to/key.pem;
```

### 修复步骤

#### 方法 1：检查并修复现有配置

```bash
# 找到正在使用的配置文件
NGINX_CONF=$(ps aux | grep nginx | grep "nginx: master" | grep -oP "\-c\s+\K[^\s]+")
echo "当前使用的配置文件: $NGINX_CONF"

# 检查是否有 ssl 配置错误
grep -n "listen.*ssl" "$NGINX_CONF"

# 如果显示有 "listen 7092 ssl" 但没有 ssl_certificate
# 编辑配置文件
sudo nano "$NGINX_CONF"

# 将 "listen 7092 ssl;" 改为 "listen 7092;"
# 保存后重载
sudo nginx -s reload
```

#### 方法 2：使用项目配置（推荐）

```bash
cd /root/ST-server

# 检查项目配置模板
cat nginx/nginx.conf.template | grep "listen"

# 应该是：
# listen 80;  # 或者你配置的端口

# 如果配置正确，重新生成
npm run generate-nginx

# 查看生成的配置
cat nginx/nginx.conf | grep "listen"

# 停止现有 Nginx
sudo nginx -s stop

# 使用项目配置启动
sudo nginx -c /root/ST-server/nginx/nginx.conf

# 测试访问
curl http://127.0.0.1:7092/
```

#### 方法 3：手动修复配置模板

如果模板有问题，修复它：

```bash
cd /root/ST-server

# 编辑模板
nano nginx/nginx.conf.template

# 找到 server 块中的 listen 指令：
# 第 78 行附近
```

修改为：
```nginx
server {
    listen 7092;  # ✅ 改成你的端口，不要加 ssl
    server_name 119.8.118.149;  # ✅ 改成你的IP或域名
    
    # ... 其他配置
}
```

然后重新生成：
```bash
# 重新生成配置
npm run generate-nginx

# 停止 Nginx
sudo nginx -s stop

# 启动 Nginx
sudo nginx -c /root/ST-server/nginx/nginx.conf

# 测试
curl http://119.8.118.149:7092/
```

---

## 📊 新增的功能

### 1. Nginx 状态检查 API

```bash
# 获取 Nginx 状态
curl -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:3000/api/config/nginx/status

# 响应示例：
{
  "status": {
    "running": true,
    "processes": 3,
    "configFile": "/etc/nginx/nginx.conf",
    "message": "Nginx 正在运行"
  },
  "configPath": "/etc/nginx/nginx.conf",
  "projectConfigPath": "/root/ST-server/nginx/nginx.conf"
}
```

### 2. 手动重载 API

```bash
# 手动触发 Nginx 重载
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:3000/api/config/nginx/reload

# 响应示例：
{
  "message": "Nginx reloaded successfully",
  "method": "signal"
}
```

### 3. 自动重载日志

查看管理平台日志，现在会显示详细的重载信息：

```bash
pm2 logs st-manager

# 日志示例：
# [Register] 新用户 222 注册成功，正在更新 Nginx 配置...
# 正在生成 Nginx 配置文件...
# 找到 2 个普通用户需要配置
# ✅ 配置已生成: /root/ST-server/nginx/nginx.conf
# [Register] Nginx 配置文件已生成
# [Nginx] 配置测试通过
# [Nginx] 正在重载配置...
# [Nginx] ✅ 配置重载成功（使用信号）
# [Register] ✅ Nginx 配置已自动重载 (方式: signal)
```

---

## 🔍 故障排查

### 问题：自动重载失败

**检查日志**：
```bash
pm2 logs st-manager --lines 50 | grep Nginx
```

**可能原因**：
1. Nginx 未运行
2. 配置文件语法错误
3. 权限不足

**解决方案**：
```bash
# 1. 检查 Nginx 是否运行
ps aux | grep nginx

# 2. 测试配置语法
sudo nginx -t -c /root/ST-server/nginx/nginx.conf

# 3. 检查权限（Node.js 进程需要能执行 nginx 命令）
which nginx
ls -l $(which nginx)

# 如果需要，给 Node.js 进程添加权限（不推荐）
# 更好的方式是使用 sudo 或配置 sudoers
```

### 问题：配置生成了但没有生效

**检查当前 Nginx 使用的配置文件**：
```bash
# 查看主进程使用的配置
ps aux | grep "nginx: master" | grep -oP "\-c\s+\K[^\s]+"

# 如果显示 /etc/nginx/nginx.conf，说明没有使用项目配置
# 需要手动切换：
sudo nginx -s stop
sudo nginx -c /root/ST-server/nginx/nginx.conf
```

### 问题：400 Bad Request 持续出现

**完整排查步骤**：

1. 检查配置文件：
```bash
cat /root/ST-server/nginx/nginx.conf | grep -A 5 "listen"
```

2. 应该看到：
```nginx
server {
    listen 7092;  # 纯数字，没有 ssl
    server_name 119.8.118.149;
```

3. 如果看到 `listen 7092 ssl;`，修复它：
```bash
cd /root/ST-server
nano nginx/nginx.conf

# 删除 ssl 关键字
# 保存后重载
sudo nginx -s reload
```

4. 如果还有问题，检查是否有其他 Nginx 进程：
```bash
# 杀掉所有 Nginx 进程
sudo killall nginx

# 重新启动
sudo nginx -c /root/ST-server/nginx/nginx.conf

# 验证
curl -v http://119.8.118.149:7092/
```

---

## ✅ 验证清单

部署完成后，逐项检查：

- [ ] 管理平台已重启（`pm2 restart st-manager`）
- [ ] 注册新用户时日志显示"Nginx 配置已自动重载"
- [ ] 管理员点击"保存配置"后配置自动重载
- [ ] 访问 `http://119.8.118.149:7092/` 显示管理平台首页
- [ ] 访问 `http://119.8.118.149:7092/123/st/` 不再显示 400 错误
- [ ] Nginx 日志没有错误（`tail -f /var/log/nginx/error.log`）

---

## 📚 新增文件

### 1. `utils/nginx-reload.js`
自动重载 Nginx 配置的工具模块，包含：
- `reloadNginx()` - 智能重载（尝试多种方式）
- `testNginxConfig()` - 测试配置语法
- `getNginxStatus()` - 获取运行状态
- `startNginx()` / `stopNginx()` - 启动/停止

### 2. 修改的文件
- `routes/auth.js` - 注册时自动重载
- `routes/config.js` - 添加状态检查和手动重载API

---

## 🎯 快速修复命令

如果遇到问题，直接运行：

```bash
#!/bin/bash
cd /root/ST-server

# 1. 重启管理平台
pm2 restart st-manager

# 2. 停止 Nginx
sudo nginx -s stop

# 3. 修复配置文件（删除 ssl）
sed -i 's/listen \([0-9]*\) ssl;/listen \1;/g' nginx/nginx.conf

# 4. 重新生成配置
npm run generate-nginx

# 5. 启动 Nginx
sudo nginx -c /root/ST-server/nginx/nginx.conf

# 6. 验证
curl http://127.0.0.1:7092/
echo "✅ 修复完成"
```

---

## 💡 最佳实践

### 1. 始终使用项目配置
```bash
# 不要用系统默认配置
sudo nginx -c /root/ST-server/nginx/nginx.conf
```

### 2. 监控日志
```bash
# 实时查看重载日志
pm2 logs st-manager --lines 0 --raw | grep Nginx
```

### 3. 定期测试
```bash
# 测试配置语法
sudo nginx -t -c /root/ST-server/nginx/nginx.conf

# 测试访问
curl -I http://127.0.0.1:7092/
```

---

## 🎉 完成

现在系统已经支持：
- ✅ 新用户注册自动更新 Nginx
- ✅ 管理员保存配置自动重载
- ✅ 智能多方式重载（信号 → systemctl → 重启）
- ✅ 详细的日志记录
- ✅ API 状态检查和手动控制

**遇到问题？**
1. 查看日志：`pm2 logs st-manager`
2. 检查 Nginx：`sudo nginx -t`
3. 查看错误日志：`tail -f /var/log/nginx/error.log`
