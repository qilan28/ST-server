# 🚀 访问权限控制 - 快速部署指南

## 📝 功能说明

实现了基于 JWT Token 的访问权限控制：

✅ **问题**：`/222/st/` 任何人都能访问  
✅ **解决**：只有用户 222 才能访问 `/222/st/`，其他人访问会看到友好的错误页面

---

## ⚡ 一键部署

```bash
cd /root/ST-server

# 一键启用访问权限控制
npm run enable-access-control
```

脚本会自动完成：
1. ✅ 安装 `cookie-parser` 依赖
2. ✅ 检查 Nginx 配置
3. ✅ 重启管理平台服务
4. ✅ 应用新的 Nginx 配置
5. ✅ 验证服务运行状态

---

## 🧪 测试验证

### 测试 1：未登录访问（应该被拒绝）

打开浏览器**无痕模式**，访问：
```
http://119.8.118.149:7092/123/st/
```

**预期结果**：
- 🚫 跳转到 `access-denied.html` 页面
- 📝 显示 "访问被拒绝" 信息
- 🔗 提供 "返回首页" 和 "登录账号" 按钮

### 测试 2：登录后访问自己的实例（应该成功）

1. 访问 `http://119.8.118.149:7092/login.html`
2. 使用用户 **123** 的账号登录
3. 访问 `http://119.8.118.149:7092/123/st/`

**预期结果**：
- ✅ 正常显示 SillyTavern 页面
- ✅ 所有功能正常使用
- ✅ Cookie 中保存了 `st_token`

### 测试 3：访问其他用户的实例（应该被拒绝）

保持用户 **123** 的登录状态，尝试访问：
```
http://119.8.118.149:7092/222/st/
```

**预期结果**：
- 🚫 跳转到 `access-denied.html` 页面
- 📝 显示 "您无权访问此实例"

---

## 📁 新增/修改的文件

### 新增文件

1. **`routes/auth-check.js`** - JWT Token 权限验证端点
2. **`public/access-denied.html`** - 访问被拒绝错误页面
3. **`nginx/nginx-with-auth.conf`** - 集成权限验证的 Nginx 配置
4. **`scripts/enable-access-control.sh`** - 一键部署脚本
5. **`ACCESS-CONTROL-GUIDE.md`** - 详细配置指南

### 修改文件

1. **`server.js`** - 添加 `cookie-parser` 和 `auth-check` 路由
2. **`routes/auth.js`** - 登录/注册时设置 JWT Token cookie
3. **`package.json`** - 添加 `cookie-parser` 依赖和部署脚本

---

## 🔧 技术实现

### 1. Cookie + JWT Token

登录成功时自动设置 cookie：

```javascript
res.cookie('st_token', token, {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,  // 24小时
    sameSite: 'lax'
});
```

### 2. Nginx Auth Request

每次访问 `/123/st/` 时，Nginx 会先调用验证接口：

```nginx
location /123/st/ {
    auth_request /auth-check/123;  # 先验证权限
    error_page 401 403 = @access_denied_123;  # 失败跳转
    # ... 正常处理
}
```

### 3. 权限验证逻辑

验证接口检查用户身份：

```javascript
// 从 Cookie 获取 token
const token = req.cookies?.st_token;

// 验证 token 并检查用户名
const decoded = jwt.verify(token, JWT_SECRET);
if (decoded.username !== requestedUsername) {
    return res.status(403).send('Forbidden');
}
```

### 4. 流程图

```
用户访问 /123/st/
    ↓
Nginx auth_request 调用验证接口
    ↓
验证 JWT Token + 检查用户名
    ↓
    ├─ 通过 → 允许访问 SillyTavern
    └─ 拒绝 → 跳转到 access-denied.html
```

---

## 🛠 手动部署步骤

如果自动脚本失败，可以手动部署：

### 步骤 1：安装依赖

```bash
cd /root/ST-server
npm install cookie-parser
```

### 步骤 2：重启管理平台

```bash
# 使用 PM2
pm2 restart st-manager

# 或直接运行
npm start
```

### 步骤 3：应用 Nginx 配置

```bash
# 停止现有 Nginx
sudo nginx -s stop

# 使用新配置启动
sudo nginx -c /root/ST-server/nginx/nginx-with-auth.conf

# 验证
ps aux | grep nginx
```

---

## 🐛 故障排查

### 问题 1：登录后仍然被拒绝

**检查 Cookie**：
1. 按 F12 打开开发者工具
2. 切换到 "Application" → "Cookies"
3. 检查是否有 `st_token` cookie

**解决**：
```bash
# 查看日志
pm2 logs st-manager --lines 50

# 测试验证接口
curl -v http://127.0.0.1:3000/api/health
```

### 问题 2：Nginx 启动失败

**检查配置**：
```bash
# 测试语法
sudo nginx -t -c /root/ST-server/nginx/nginx-with-auth.conf

# 查看错误日志
sudo tail -f /var/log/nginx/error.log
```

### 问题 3：验证接口 500 错误

**可能原因**：
- `cookie-parser` 未安装
- JWT_SECRET 未设置

**解决**：
```bash
# 检查依赖
npm list cookie-parser

# 检查环境变量
cat .env | grep JWT_SECRET

# 如果没有，添加
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env

# 重启服务
pm2 restart st-manager
```

---

## 📊 对比：有/无权限控制

| 场景 | 无权限控制 | 有权限控制 |
|------|-----------|-----------|
| 用户 123 访问 `/123/st/` | ✅ 可访问 | ✅ 可访问 |
| 用户 222 访问 `/123/st/` | ❌ 可访问（不安全） | ✅ 被拒绝 |
| 未登录访问 `/123/st/` | ❌ 可访问（不安全） | ✅ 被拒绝 |
| 管理员访问任何实例 | - | ✅ 可访问（可配置） |

---

## ⚙️ 高级配置

### 允许管理员访问所有实例

在 `routes/auth-check.js` 中已实现：

```javascript
if (user.role === 'admin') {
    return res.status(200).send('OK');  // 管理员通过
}
```

### 调整 Token 过期时间

修改 `routes/auth.js`：

```javascript
res.cookie('st_token', token, {
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 改为 7 天
    // ...
});
```

### 自定义错误页面

编辑 `public/access-denied.html` 来修改样式和内容。

---

## 📚 相关文档

- **详细配置指南**：`ACCESS-CONTROL-GUIDE.md`
- **Nginx 配置**：`nginx/nginx-with-auth.conf`
- **权限验证代码**：`routes/auth-check.js`

---

## 🎯 快速命令参考

```bash
# 一键启用权限控制
npm run enable-access-control

# 查看管理平台日志
pm2 logs st-manager

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/error.log

# 重启服务
pm2 restart st-manager
sudo nginx -s reload

# 测试验证接口
curl -v http://127.0.0.1:3000/api/auth-check/verify/123

# 诊断 Nginx
npm run diagnose-nginx
```

---

## ✅ 完成检查清单

部署完成后，请逐项检查：

- [ ] 运行 `npm run enable-access-control` 成功
- [ ] Nginx 正在运行（`ps aux | grep nginx`）
- [ ] 管理平台正在运行（`pm2 list`）
- [ ] 未登录访问 `/123/st/` 被拒绝
- [ ] 登录后访问自己的实例成功
- [ ] 访问其他用户实例被拒绝
- [ ] 错误页面显示正常
- [ ] Cookie `st_token` 正确设置

---

## 🎉 完成！

访问权限控制已配置完成，现在您的 SillyTavern 实例已经受到保护！

**任何问题**？查看 `ACCESS-CONTROL-GUIDE.md` 的详细故障排查部分。
