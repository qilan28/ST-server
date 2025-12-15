# 🔒 访问控制功能

## 📋 功能说明

访问控制功能确保**每个用户只能访问自己的 SillyTavern 实例**，其他人无法访问。

### 工作原理

```
用户 222 尝试访问 /222/st/
    ↓
Nginx 调用内部认证端点
    ↓
检查用户的 JWT token (从 cookie 中)
    ↓
验证用户身份是否为 222
    ↓
✅ 是 → 允许访问
❌ 否 → 返回 401/403 → 跳转到 access-denied.html
```

### 效果

- ✅ 用户 `222` 访问 `/222/st/` → **成功**
- ❌ 用户 `123` 访问 `/222/st/` → **拒绝**
- ❌ 未登录用户访问 `/222/st/` → **拒绝**
- ✅ 管理员访问任何 `/xxx/st/` → **成功**（管理员有特殊权限）

---

## 🚀 启用访问控制

### 方法 1：通过配置文件

编辑 `config.json`：

```json
{
  "nginx": {
    "enabled": true,
    "domain": "119.8.118.149",
    "port": 7092,
    "enableAccessControl": true  // ✅ 启用访问控制
  },
  "system": {
    "port": 3000,
    "allowRegistration": true,
    "maxUsers": 100
  }
}
```

然后重新生成配置：

```bash
cd /root/ST-server

# 重新生成 Nginx 配置
npm run generate-nginx

# 重启 Nginx
sudo nginx -s stop
sudo nginx -c /root/ST-server/nginx/nginx.conf

# 重启管理平台
pm2 restart st-manager
```

### 方法 2：通过 API

```bash
# 获取 token
TOKEN="your_admin_token"

# 更新配置
curl -X PUT http://127.0.0.1:3000/api/config/nginx \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enableAccessControl": true
  }'

# 重新生成配置
curl -X POST http://127.0.0.1:3000/api/config/nginx/generate \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔓 禁用访问控制

如果你想让所有人都能访问所有实例（**不推荐**），可以禁用访问控制：

```json
{
  "nginx": {
    "enableAccessControl": false  // ❌ 禁用访问控制
  }
}
```

然后重新生成配置。

---

## 🧪 测试访问控制

### 1. 登录用户访问自己的实例

```bash
# 1. 登录获取 cookie
curl -c cookies.txt -X POST http://119.8.118.149:7092/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"222","password":"your_password"}'

# 2. 访问自己的实例（应该成功）
curl -b cookies.txt http://119.8.118.149:7092/222/st/

# 应该返回 200 OK
```

### 2. 尝试访问别人的实例

```bash
# 使用 222 的 cookie 访问 123 的实例（应该失败）
curl -b cookies.txt http://119.8.118.149:7092/123/st/

# 应该返回 403 Forbidden 或重定向到 access-denied.html
```

### 3. 未登录访问

```bash
# 不带 cookie 访问（应该失败）
curl http://119.8.118.149:7092/222/st/

# 应该返回 401 Unauthorized 或重定向到 access-denied.html
```

### 4. 管理员访问任意实例

```bash
# 1. 以管理员身份登录
curl -c admin_cookies.txt -X POST http://119.8.118.149:7092/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin_password"}'

# 2. 访问任意用户的实例（应该成功）
curl -b admin_cookies.txt http://119.8.118.149:7092/222/st/
curl -b admin_cookies.txt http://119.8.118.149:7092/123/st/

# 管理员可以访问所有实例
```

---

## 📊 生成的 Nginx 配置

### 启用访问控制时

```nginx
# 认证检查内部端点
location = /auth-check-internal/222 {
    internal;
    proxy_pass http://st_manager/api/auth-check/verify/222;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header X-Original-URI $request_uri;
    proxy_set_header Cookie $http_cookie;
}

# 访问被拒绝页面
location @access_denied {
    return 302 /access-denied.html;
}

# 用户实例（带访问控制）
location /222/st/ {
    # 🔒 访问控制：只有 222 用户才能访问
    auth_request /auth-check-internal/222;
    error_page 401 403 = @access_denied;
    
    # ... 其他配置
}
```

### 禁用访问控制时

```nginx
# 用户实例（无访问控制）
location /222/st/ {
    # 任何人都可以访问
    
    # ... 其他配置
}
```

---

## 🔍 认证流程详解

### 1. 用户登录

用户登录时，系统会：
- 验证用户名和密码
- 生成 JWT token
- 将 token 设置为 cookie（`st_token`）

```javascript
// routes/auth.js
res.cookie('st_token', token, {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24小时
    sameSite: 'lax'
});
```

### 2. 访问实例

用户访问 `/222/st/` 时：

```
1. Nginx 接收请求
2. 触发 auth_request /auth-check-internal/222
3. Nginx 内部调用管理平台的认证接口
4. 认证接口检查 cookie 中的 JWT token
5. 验证用户身份
6. 返回 200 (允许) 或 401/403 (拒绝)
7. Nginx 根据返回值决定是否放行
```

### 3. 认证接口逻辑

```javascript
// routes/auth-check.js
router.get('/verify/:username', (req, res) => {
    const requestedUsername = req.params.username; // 请求的用户名
    const token = req.cookies?.st_token; // 从 cookie 获取 token
    
    // 验证 token
    const decoded = jwt.verify(token, JWT_SECRET);
    const currentUsername = decoded.username; // 当前登录的用户名
    
    // 检查权限：只能访问自己的实例
    if (currentUsername !== requestedUsername) {
        return res.status(403).send('Forbidden');
    }
    
    // 管理员可以访问所有实例
    if (user.role === 'admin') {
        return res.status(200).send('OK');
    }
    
    res.status(200).send('OK');
});
```

---

## 🎨 自定义访问拒绝页面

访问被拒绝时，用户会被重定向到 `/access-denied.html`。

你可以自定义这个页面：

```bash
nano /root/ST-server/public/access-denied.html
```

示例内容：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>访问被拒绝</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            background: rgba(255, 255, 255, 0.9);
            color: #333;
            padding: 40px;
            border-radius: 10px;
            max-width: 500px;
            margin: 0 auto;
        }
        h1 { color: #e74c3c; }
        a {
            display: inline-block;
            margin-top: 20px;
            padding: 10px 20px;
            background: #3498db;
            color: white;
            text-decoration: none;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔒 访问被拒绝</h1>
        <p>您没有权限访问此资源。</p>
        <p>可能的原因：</p>
        <ul style="text-align: left;">
            <li>您未登录</li>
            <li>您尝试访问其他用户的实例</li>
            <li>您的登录已过期</li>
        </ul>
        <a href="/">返回首页</a>
        <a href="/login.html">重新登录</a>
    </div>
</body>
</html>
```

---

## 🔐 安全建议

### 1. JWT Secret

确保使用强密码作为 JWT 密钥：

```bash
# 生成随机密钥
openssl rand -hex 32

# 设置环境变量
export JWT_SECRET="你的随机密钥"
```

在 `.env` 文件中：
```
JWT_SECRET=your_very_long_and_random_secret_key_here
```

### 2. HTTPS

在生产环境中，强烈建议使用 HTTPS：

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # ... 其他配置
}
```

### 3. Cookie 安全

在 HTTPS 环境下，启用 Secure 标志：

```javascript
res.cookie('st_token', token, {
    httpOnly: true,
    secure: true,  // 仅在 HTTPS 下传输
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
});
```

### 4. Token 过期时间

根据需求调整 token 有效期：

```javascript
// 生成 token 时设置过期时间
const token = jwt.sign(
    { username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }  // 24小时后过期
);
```

---

## 🛠️ 故障排查

### 问题 1：登录后仍然无法访问

**检查 Cookie**：
```bash
# 在浏览器控制台
document.cookie
// 应该包含: st_token=...
```

**检查认证接口**：
```bash
curl -b "st_token=your_token" \
  http://127.0.0.1:3000/api/auth-check/verify/222

# 应该返回 200 OK
```

### 问题 2：所有人都无法访问

**检查 Nginx 配置**：
```bash
# 查看是否包含 auth_request
grep "auth_request" /root/ST-server/nginx/nginx.conf

# 查看认证端点
grep "auth-check-internal" /root/ST-server/nginx/nginx.conf
```

**检查管理平台是否运行**：
```bash
pm2 list
curl http://127.0.0.1:3000/api/auth-check/verify/222
```

### 问题 3：管理员也无法访问

**检查管理员角色**：
```bash
# 进入数据库
sqlite3 /root/ST-server/data.db

# 查看用户角色
SELECT username, role FROM users WHERE username='admin';

# 应该显示 role='admin'
```

### 问题 4：访问被拒绝页面不显示

**检查静态文件**：
```bash
ls -l /root/ST-server/public/access-denied.html

# 测试访问
curl http://127.0.0.1:3000/access-denied.html
```

---

## 📝 配置选项参考

### config.json

```json
{
  "nginx": {
    "enabled": true,              // 是否启用 Nginx 代理
    "domain": "119.8.118.149",    // 域名或 IP
    "port": 7092,                 // Nginx 监听端口
    "enableAccessControl": true   // 是否启用访问控制（默认：true）
  }
}
```

### 环境变量

```bash
# .env 文件
JWT_SECRET=your_secret_key_here  # JWT 密钥
PORT=3000                        # 管理平台端口
```

---

## ✅ 完成检查清单

启用访问控制后，确认：

- [ ] `config.json` 中 `enableAccessControl: true`
- [ ] 运行 `npm run generate-nginx` 成功
- [ ] Nginx 配置包含 `auth_request`
- [ ] 管理平台运行正常（`pm2 list`）
- [ ] 认证接口可访问（`/api/auth-check/verify/xxx`）
- [ ] `access-denied.html` 存在
- [ ] 用户登录后可以访问自己的实例
- [ ] 用户无法访问其他人的实例
- [ ] 管理员可以访问所有实例
- [ ] 未登录用户被重定向到拒绝页面

---

## 🎉 总结

访问控制功能通过以下机制保护用户隐私：

1. 🔐 **JWT 认证** - 基于 token 的身份验证
2. 🛡️ **Nginx auth_request** - 请求级别的权限检查
3. 🍪 **Cookie 传递** - 安全的凭证传输
4. 👥 **用户隔离** - 每个用户只能访问自己的实例
5. 👑 **管理员特权** - 管理员可以访问所有实例

**默认启用**，确保系统安全！
