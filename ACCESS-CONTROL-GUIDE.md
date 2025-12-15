# 🔐 SillyTavern 访问权限控制指南

## 📋 功能说明

实现了基于 JWT Token 的访问权限控制，确保：
- ✅ 只有用户 123 能访问 `/123/st/`
- ✅ 只有用户 222 能访问 `/222/st/`
- ✅ 未登录用户访问时显示友好的错误页面
- ✅ 管理员可以访问所有用户的实例（可选）

---

## 🚀 部署步骤

### 步骤 1：安装依赖

```bash
cd /root/ST-server

# 安装 cookie-parser
npm install cookie-parser
```

### 步骤 2：重启管理平台

```bash
# 如果使用 PM2
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

# 或者复制配置文件
sudo cp /root/ST-server/nginx/nginx-with-auth.conf /etc/nginx/nginx.conf
sudo nginx -t
sudo nginx -s reload
```

### 步骤 4：测试验证

#### 测试 1：未登录访问（应该被拒绝）

在浏览器无痕模式访问：
```
http://119.8.118.149:7092/123/st/
```

**预期结果**：跳转到 `access-denied.html` 页面

#### 测试 2：登录后访问自己的实例（应该成功）

1. 访问 `http://119.8.118.149:7092/login.html`
2. 使用用户 123 的账号登录
3. 访问 `http://119.8.118.149:7092/123/st/`

**预期结果**：正常显示 SillyTavern 页面

#### 测试 3：访问其他用户的实例（应该被拒绝）

1. 以用户 123 登录
2. 尝试访问 `http://119.8.118.149:7092/222/st/`

**预期结果**：跳转到 `access-denied.html` 页面

---

## 🔧 技术原理

### 1. Cookie + JWT Token

**登录时**：
```javascript
// routes/auth.js
res.cookie('st_token', token, {
    httpOnly: true,
    secure: false,  // 生产环境改为 true
    maxAge: 24 * 60 * 60 * 1000,  // 24小时
    sameSite: 'lax'
});
```

**Cookie 示例**：
```
st_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Nginx Auth Request

**Nginx 配置**：
```nginx
location /123/st/ {
    # 在处理请求前，先调用验证接口
    auth_request /auth-check/123;
    
    # 如果验证失败（401/403），跳转到错误页面
    error_page 401 403 = @access_denied_123;
    
    # ... 其他配置
}

# 内部验证接口
location ~ ^/auth-check/(\w+)$ {
    internal;  # 只能内部调用
    proxy_pass http://st_manager/api/auth-check/verify/$1;
    proxy_set_header Cookie $http_cookie;  # 传递 Cookie
}
```

### 3. 权限验证逻辑

**验证端点**：`/api/auth-check/verify/:username`

```javascript
// routes/auth-check.js
router.get('/verify/:username', (req, res) => {
    const requestedUsername = req.params.username;  // 例如: 123
    const token = req.cookies?.st_token;
    
    // 1. 验证 token
    const decoded = jwt.verify(token, JWT_SECRET);
    const currentUsername = decoded.username;  // 当前登录用户
    
    // 2. 检查权限
    if (currentUsername !== requestedUsername) {
        return res.status(403).send('Forbidden');
    }
    
    // 3. 权限通过
    res.status(200).send('OK');
});
```

### 4. 流程图

```
用户访问 /123/st/
    ↓
Nginx auth_request → /api/auth-check/verify/123
    ↓
检查 Cookie 中的 st_token
    ↓
验证 JWT Token
    ↓
检查 token 中的 username 是否为 "123"
    ↓
    ├─ 是 → 返回 200 → Nginx 允许访问
    └─ 否 → 返回 403 → Nginx 跳转到 access-denied.html
```

---

## 📝 配置说明

### 修改的文件

#### 1. `server.js`
- 添加 `cookie-parser` 中间件
- 注册 `auth-check` 路由
- 启用 CORS credentials

#### 2. `routes/auth.js`
- 登录成功时设置 `st_token` cookie
- 注册成功时设置 `st_token` cookie

#### 3. `routes/auth-check.js`（新增）
- 实现权限验证逻辑
- 支持从 Cookie 或 Authorization header 获取 token

#### 4. `public/access-denied.html`（新增）
- 友好的访问被拒绝页面
- 显示被访问的用户名
- 提供登录和返回首页按钮

#### 5. `nginx/nginx-with-auth.conf`（新增）
- 集成 `auth_request` 指令
- 为每个用户路径添加权限验证
- 配置错误页面重定向

---

## 🎛️ 高级配置

### 允许管理员访问所有实例

在 `routes/auth-check.js` 中已实现：

```javascript
// 管理员可以访问所有实例
if (user.role === 'admin') {
    console.log(`[Auth] 允许访问 /${requestedUsername}/st/ - 管理员: ${currentUsername}`);
    return res.status(200).send('OK');
}
```

### 调整 Token 过期时间

在 `routes/auth.js` 中修改：

```javascript
res.cookie('st_token', token, {
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 改为 7 天
    // ...
});
```

同时需要在 `middleware/auth.js` 中修改 JWT 过期时间：

```javascript
export const generateToken = (userId, username) => {
    return jwt.sign(
        { userId, username },
        JWT_SECRET,
        { expiresIn: '7d' }  // 改为 7 天
    );
};
```

### 自定义错误页面

修改 `public/access-denied.html` 来自定义错误页面的样式和内容。

---

## 🐛 故障排查

### 问题 1：登录后仍然被拒绝访问

**检查**：
```bash
# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log

# 查看管理平台日志
pm2 logs st-manager
```

**可能原因**：
- Cookie 没有正确设置
- JWT_SECRET 不匹配
- Token 已过期

**解决**：
```bash
# 检查浏览器 Cookie
# F12 → Application → Cookies → 查看 st_token

# 测试验证接口
curl -H "Cookie: st_token=YOUR_TOKEN" \
  http://127.0.0.1:3000/api/auth-check/verify/123
```

### 问题 2：验证接口返回 500

**检查**：
```bash
# 查看管理平台日志
pm2 logs st-manager --lines 50
```

**可能原因**：
- `cookie-parser` 未安装
- JWT_SECRET 环境变量未设置

**解决**：
```bash
# 安装依赖
npm install cookie-parser

# 检查环境变量
cat .env | grep JWT_SECRET

# 如果没有，添加：
echo "JWT_SECRET=your-secret-key-change-in-production" >> .env

# 重启服务
pm2 restart st-manager
```

### 问题 3：跨域问题

**症状**：浏览器控制台显示 CORS 错误

**解决**：确认 `server.js` 中启用了 credentials：

```javascript
app.use(cors({ credentials: true }));
```

前端请求时也需要设置：

```javascript
fetch('/api/auth/login', {
    credentials: 'include',  // 重要！
    method: 'POST',
    // ...
});
```

### 问题 4：Auth Request 不工作

**检查 Nginx 配置**：
```bash
# 测试配置语法
sudo nginx -t

# 查看是否有 auth_request 模块
nginx -V 2>&1 | grep -o with-http_auth_request_module
```

**如果没有 auth_request 模块**：
```bash
# Ubuntu/Debian 通常默认包含
# 如果没有，需要重新编译 Nginx 或使用包含该模块的版本

# 检查 Nginx 版本
nginx -v
```

---

## 📊 性能影响

### Auth Request 开销

每个请求都会触发一次额外的验证请求：

```
客户端请求 → Nginx → 验证接口 → Nginx → 后端
```

**性能测试**（示例）：

| 场景 | 无验证 | 有验证 | 增加 |
|------|--------|--------|------|
| HTML 页面 | 50ms | 60ms | +10ms |
| 静态资源 | 10ms | 15ms | +5ms |
| API 请求 | 30ms | 38ms | +8ms |

**优化建议**：

1. **缓存验证结果**（Nginx Plus 特性）
2. **静态资源缓存**（已配置 7 天）
3. **使用更快的验证逻辑**（已优化）

---

## 🔒 安全最佳实践

### 1. 使用 HTTPS

在生产环境务必启用 HTTPS：

```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    # ...
}
```

并在 Cookie 中启用 secure：

```javascript
res.cookie('st_token', token, {
    httpOnly: true,
    secure: true,  // HTTPS only
    sameSite: 'strict',  // 更严格
});
```

### 2. 设置强密钥

在 `.env` 中设置强 JWT_SECRET：

```bash
# 生成随机密钥
openssl rand -base64 32

# 添加到 .env
JWT_SECRET=你生成的随机密钥
```

### 3. 限制 Token 过期时间

不要设置过长的过期时间：

```javascript
{ expiresIn: '24h' }  // ✅ 推荐
{ expiresIn: '30d' }  // ❌ 不推荐
```

### 4. 日志审计

记录所有访问尝试：

```javascript
// routes/auth-check.js
console.log(`[Auth] ${currentUsername} 尝试访问 /${requestedUsername}/st/ - 结果: ${允许/拒绝}`);
```

---

## 📚 API 文档

### 验证端点

#### `GET /api/auth-check/verify/:username`

**内部接口**：仅供 Nginx auth_request 使用

**参数**：
- `username` (path) - 被访问的用户名

**Headers**：
- `Cookie: st_token=<JWT_TOKEN>` - 必需

**响应**：

成功（200）：
```
OK
```

未授权（401）：
```
Unauthorized
```

禁止访问（403）：
```
Forbidden
```

**示例**：
```bash
# 正确的访问
curl -H "Cookie: st_token=eyJ..." \
  http://127.0.0.1:3000/api/auth-check/verify/123
# 响应: OK

# 错误的访问
curl -H "Cookie: st_token=eyJ..." \
  http://127.0.0.1:3000/api/auth-check/verify/222
# 响应: Forbidden (如果 token 是用户 123 的)
```

---

## 🎉 完成

访问权限控制已配置完成！

**快速测试**：
```bash
# 1. 安装依赖
npm install cookie-parser

# 2. 重启服务
pm2 restart st-manager

# 3. 应用 Nginx 配置
sudo nginx -s stop
sudo nginx -c /root/ST-server/nginx/nginx-with-auth.conf

# 4. 测试访问
# 无痕模式访问：http://119.8.118.149:7092/123/st/
# 应该看到访问被拒绝页面
```

现在您的 SillyTavern 实例已经受到保护，只有对应的用户才能访问！🔐
