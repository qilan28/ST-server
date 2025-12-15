# 🚀 快速修复指南

## 问题总结

### 1️⃣ 新用户注册后需要手动生成 Nginx 配置
**已修复** ✅ 现在用户注册时自动生成并重载配置

### 2️⃣ Nginx 配置重载不生效
**已修复** ✅ 自动尝试多种重载方式（信号 → systemctl → 重启）

### 3️⃣ 访问时出现 400 Bad Request 错误
**原因**：Nginx 配置中 `listen` 错误使用了 `ssl` 关键字
**修复**：移除 SSL 配置或添加证书

---

## ⚡ 一键修复

```bash
cd /root/ST-server

# 修复所有问题（推荐）
npm run fix-nginx-400
```

这个命令会：
1. ✅ 重启管理平台（应用新代码）
2. ✅ 检查并修复 Nginx 配置（移除错误的 SSL）
3. ✅ 测试配置语法
4. ✅ 重启 Nginx
5. ✅ 验证服务状态

---

## 📋 手动修复步骤

如果自动脚本失败，按以下步骤操作：

### 步骤 1：重启管理平台

```bash
cd /root/ST-server
pm2 restart st-manager
```

### 步骤 2：检查 Nginx 配置

```bash
# 查看当前配置
cat nginx/nginx.conf | grep "listen"

# 应该看到：
# listen 7092;  # ✅ 正确

# 如果看到：
# listen 7092 ssl;  # ❌ 错误（没有证书）
```

### 步骤 3：修复配置

#### 方法 A：自动修复
```bash
# 移除错误的 ssl 关键字
sed -i 's/listen \([0-9]*\) ssl;/listen \1;/g' nginx/nginx.conf

# 或重新生成
npm run generate-nginx
```

#### 方法 B：手动编辑
```bash
nano nginx/nginx.conf

# 找到 server 块，修改：
# listen 7092 ssl;  → listen 7092;
```

### 步骤 4：重启 Nginx

```bash
# 停止
sudo nginx -s stop

# 启动（使用项目配置）
sudo nginx -c /root/ST-server/nginx/nginx.conf

# 验证
curl http://127.0.0.1:7092/
```

---

## 🧪 测试验证

### 测试 1：检查 400 错误是否修复

```bash
# 访问管理平台
curl http://119.8.118.149:7092/

# 访问用户实例
curl http://119.8.118.149:7092/123/st/

# 不应该再看到 "400 Bad Request"
# 可能看到：
# - 200: 正常
# - 302: 重定向（正常）
# - 401/403: 权限验证（正常）
# - 502: 后端未启动（需要在管理平台启动实例）
```

### 测试 2：检查自动重载功能

```bash
# 查看管理平台日志
pm2 logs st-manager --lines 0

# 注册新用户（通过网页或 API）
# 日志应该显示：
# [Register] 新用户 xxx 注册成功，正在更新 Nginx 配置...
# [Register] Nginx 配置文件已生成
# [Register] ✅ Nginx 配置已自动重载 (方式: signal)
```

### 测试 3：手动触发配置生成

在管理员面板：
1. 登录管理员账号
2. 进入"系统配置" → "Nginx 配置"
3. 修改配置后点击"保存配置"
4. 应该看到成功提示，且配置自动重载

---

## 📊 新功能说明

### 1. 自动配置更新

**用户注册时**：
```javascript
// 自动执行：
1. 生成 Nginx 配置文件
2. 测试配置语法
3. 重载 Nginx（尝试多种方式）
4. 记录日志
```

**管理员保存配置时**：
```javascript
// 同样自动执行：
1. 生成配置
2. 重载 Nginx
3. 返回重载状态
```

### 2. 智能重载策略

系统会按顺序尝试：
1. **信号重载** (`nginx -s reload`) - 最快，不中断服务
2. **Systemctl** (`systemctl reload nginx`) - 适用于 systemd 系统
3. **重启** (`nginx -s stop && nginx -c xxx`) - 最后手段

### 3. 新增 API 端点

#### 获取 Nginx 状态
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:3000/api/config/nginx/status
```

#### 手动重载
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:3000/api/config/nginx/reload
```

---

## 🔍 故障排查

### 问题：仍然显示 400 错误

**检查清单**：
```bash
# 1. 确认使用的是项目配置
ps aux | grep "nginx: master"
# 应该看到 -c /root/ST-server/nginx/nginx.conf

# 2. 检查配置文件
cat /root/ST-server/nginx/nginx.conf | grep "listen"
# 不应该有 "ssl" 关键字（除非配置了证书）

# 3. 检查错误日志
sudo tail -f /var/log/nginx/error.log

# 4. 完全重启 Nginx
sudo killall nginx
sudo nginx -c /root/ST-server/nginx/nginx.conf
```

### 问题：自动重载失败

**查看日志**：
```bash
pm2 logs st-manager | grep Nginx
```

**常见原因**：
- Nginx 未运行：`ps aux | grep nginx`
- 配置语法错误：`sudo nginx -t -c /root/ST-server/nginx/nginx.conf`
- 权限不足：确保 Node.js 可以执行 `nginx` 命令

**解决方案**：
```bash
# 手动重载
npm run generate-nginx
sudo nginx -s reload

# 或通过 API
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:3000/api/config/nginx/reload
```

### 问题：配置生成了但没有生效

**原因**：Nginx 使用的不是项目配置

**解决**：
```bash
# 停止所有 Nginx
sudo killall nginx

# 使用项目配置启动
sudo nginx -c /root/ST-server/nginx/nginx.conf

# 设置开机自启（可选）
# 编辑 systemd 服务文件，指定配置路径
```

---

## 📂 新增文件

### 1. `utils/nginx-reload.js`
自动重载工具模块

**功能**：
- `reloadNginx()` - 智能重载
- `testNginxConfig()` - 测试配置
- `getNginxStatus()` - 获取状态
- `startNginx()` / `stopNginx()` - 启动/停止

### 2. `scripts/fix-nginx-400.sh`
一键修复脚本

**执行**：`npm run fix-nginx-400`

### 3. 修改的文件

- `routes/auth.js` - 注册时自动重载
- `routes/config.js` - 添加状态和手动重载 API
- `package.json` - 添加快捷命令

---

## ✅ 完成检查清单

修复完成后，确认：

- [ ] 运行 `npm run fix-nginx-400` 成功
- [ ] 访问 `http://119.8.118.149:7092/` 正常（不是 400）
- [ ] 访问 `http://119.8.118.149:7092/123/st/` 不再是 400
- [ ] 注册新用户时日志显示"Nginx 配置已自动重载"
- [ ] 管理员保存配置后自动重载
- [ ] `pm2 logs st-manager` 没有错误
- [ ] `sudo tail -f /var/log/nginx/error.log` 没有错误

---

## 🎯 快速命令参考

```bash
# 一键修复所有问题
npm run fix-nginx-400

# 查看日志
pm2 logs st-manager
sudo tail -f /var/log/nginx/error.log

# 重新生成配置
npm run generate-nginx

# 测试配置
sudo nginx -t -c /root/ST-server/nginx/nginx.conf

# 重启 Nginx
sudo nginx -s stop
sudo nginx -c /root/ST-server/nginx/nginx.conf

# 重启管理平台
pm2 restart st-manager

# 检查 Nginx 状态
ps aux | grep nginx
curl http://127.0.0.1:7092/
```

---

## 📚 相关文档

- **详细修复指南**：`FIX-AUTO-NGINX-RELOAD.md`
- **访问权限控制**：`QUICK-SETUP-ACCESS-CONTROL.md`
- **静态资源修复**：`NGINX-STATIC-RESOURCE-FIX.md`
- **项目 README**：`README.md`

---

## 🎉 完成

现在你的系统已经：
- ✅ 修复了 400 Bad Request 错误
- ✅ 启用了自动配置更新
- ✅ 实现了智能重载机制
- ✅ 提供了完善的监控和控制

**遇到问题？**
1. 运行 `npm run fix-nginx-400`
2. 查看 `FIX-AUTO-NGINX-RELOAD.md`
3. 检查日志：`pm2 logs st-manager`
