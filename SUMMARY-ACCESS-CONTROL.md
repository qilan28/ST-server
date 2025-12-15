# 📦 访问控制功能完整总结

## 🎯 你的需求

**问题**：
> `/222/st/` 是任何人都可以访问的，我要只有222用户才能打开自己的 `/222/st/`，其他人都打不开这种的。

**解决方案**：✅ 已实现访问控制功能

---

## ✨ 实现效果

### 访问规则

| 访问者 | 访问 `/222/st/` | 访问 `/123/st/` | 结果 |
|-------|----------------|----------------|------|
| 用户 222（已登录） | ✅ 允许 | ❌ 拒绝 | 只能访问自己的实例 |
| 用户 123（已登录） | ❌ 拒绝 | ✅ 允许 | 只能访问自己的实例 |
| 未登录用户 | ❌ 拒绝 | ❌ 拒绝 | 必须登录 |
| 管理员（admin） | ✅ 允许 | ✅ 允许 | 可访问所有实例 |

### 访问流程

```
用户访问 /222/st/
    ↓
Nginx 拦截请求
    ↓
调用认证端点检查权限
    ↓
验证用户 token (来自 cookie)
    ↓
检查用户身份是否为 222
    ↓
✅ 是 → 允许访问 SillyTavern
❌ 否 → 拒绝 → 跳转到访问拒绝页面
```

---

## 🚀 一键启用（推荐）

在服务器上运行：

```bash
cd /root/ST-server

# 一键启用访问控制
npm run enable-access-control
```

这个命令会自动：
1. ✅ 安装必要依赖（cookie-parser）
2. ✅ 创建/更新配置文件（enableAccessControl: true）
3. ✅ 创建访问拒绝页面
4. ✅ 重新生成 Nginx 配置（包含访问控制）
5. ✅ 重启管理平台和 Nginx

---

## 📂 新增/修改的文件

### 1. 核心代码

#### `routes/auth-check.js` （已存在）
认证检查端点，验证用户权限：

```javascript
router.get('/verify/:username', (req, res) => {
    const requestedUsername = req.params.username;
    const token = req.cookies?.st_token;
    
    // 验证 token
    const decoded = jwt.verify(token, JWT_SECRET);
    const currentUsername = decoded.username;
    
    // 只能访问自己的实例
    if (currentUsername !== requestedUsername) {
        return res.status(403).send('Forbidden');
    }
    
    res.status(200).send('OK');
});
```

#### `utils/config-manager.js` （已修改）
添加访问控制配置选项：

```javascript
const DEFAULT_CONFIG = {
    nginx: {
        enabled: false,
        domain: 'localhost',
        port: 80,
        enableAccessControl: true  // 新增：默认启用访问控制
    }
};
```

#### `scripts/generate-nginx-config.js` （已修改）
自动生成包含访问控制的 Nginx 配置：

```javascript
// 读取配置
const ENABLE_ACCESS_CONTROL = nginxConfig.enableAccessControl !== false;

// 生成认证检查端点
let authCheckLocations = '';
users.forEach(user => {
    authCheckLocations += `location = /auth-check-internal/${user.username} {
        internal;
        proxy_pass http://st_manager/api/auth-check/verify/${user.username};
        proxy_pass_request_body off;
        proxy_set_header Cookie $http_cookie;
    }`;
});

// 在用户location块中添加访问控制
location /${user.username}/st/ {
    ${ENABLE_ACCESS_CONTROL ? `
    auth_request /auth-check-internal/${user.username};
    error_page 401 403 = @access_denied;
    ` : ''}
    // ... 其他配置
}
```

#### `nginx/nginx.conf.template` （已修改）
添加访问控制占位符：

```nginx
# [访问控制] 内部认证端点
# {{AUTH_CHECK_LOCATIONS}}

# 访问被拒绝页面
location @access_denied {
    return 302 /access-denied.html;
}
```

### 2. 配置文件

#### `config.json` （新增或更新）
```json
{
  "nginx": {
    "enabled": true,
    "domain": "119.8.118.149",
    "port": 7092,
    "enableAccessControl": true
  },
  "system": {
    "port": 3000,
    "allowRegistration": true,
    "maxUsers": 100
  }
}
```

### 3. 静态文件

#### `public/access-denied.html` （新增）
访问被拒绝时显示的页面，包含：
- 友好的错误提示
- 可能的原因说明
- 返回首页和重新登录按钮

### 4. 脚本工具

#### `scripts/enable-access-control-v2.sh` （新增）
一键启用访问控制的自动化脚本

### 5. 文档

- **`ACCESS-CONTROL.md`** - 详细功能说明和配置指南
- **`ENABLE-ACCESS-CONTROL-QUICK.md`** - 快速启用指南
- **`SUMMARY-ACCESS-CONTROL.md`** - 本文档（总结）

---

## 🔧 生成的 Nginx 配置示例

### 启用访问控制时

```nginx
http {
    # ... 其他配置
    
    server {
        listen 7092;
        server_name 119.8.118.149;
        
        # 🔒 认证检查内部端点
        location = /auth-check-internal/222 {
            internal;
            proxy_pass http://st_manager/api/auth-check/verify/222;
            proxy_pass_request_body off;
            proxy_set_header Content-Length "";
            proxy_set_header X-Original-URI $request_uri;
            proxy_set_header Cookie $http_cookie;
        }
        
        location = /auth-check-internal/123 {
            internal;
            proxy_pass http://st_manager/api/auth-check/verify/123;
            proxy_pass_request_body off;
            proxy_set_header Content-Length "";
            proxy_set_header X-Original-URI $request_uri;
            proxy_set_header Cookie $http_cookie;
        }
        
        # 访问被拒绝页面
        location @access_denied {
            return 302 /access-denied.html;
        }
        
        # Cookie 救援模式 ...
        
        # 管理平台 ...
        
        # 用户 222 的实例（带访问控制）
        location /222/st/ {
            # 🔒 访问控制：只有 222 用户才能访问
            auth_request /auth-check-internal/222;
            error_page 401 403 = @access_denied;
            
            # 路径重写
            rewrite ^/222/st/(.*)$ /$1 break;
            
            # 代理到用户实例
            proxy_pass http://st_222;
            
            # ... 其他配置
        }
        
        # 用户 123 的实例（带访问控制）
        location /123/st/ {
            # 🔒 访问控制：只有 123 用户才能访问
            auth_request /auth-check-internal/123;
            error_page 401 403 = @access_denied;
            
            # ... 其他配置
        }
    }
}
```

---

## 🧪 测试验证

### 1. 用户访问自己的实例（应该成功）

```bash
# 浏览器操作：
1. 访问 http://119.8.118.149:7092/
2. 登录用户 222
3. 访问 http://119.8.118.149:7092/222/st/
4. ✅ 成功访问 SillyTavern
```

### 2. 用户访问别人的实例（应该拒绝）

```bash
# 浏览器操作（保持 222 登录状态）：
1. 访问 http://119.8.118.149:7092/123/st/
2. ❌ 被拒绝，跳转到访问拒绝页面
```

### 3. 未登录访问（应该拒绝）

```bash
# 使用无痕模式：
1. 访问 http://119.8.118.149:7092/222/st/
2. ❌ 被拒绝，跳转到访问拒绝页面
```

### 4. 命令行测试

```bash
# 测试未登录访问
curl -I http://119.8.118.149:7092/222/st/
# 应该返回: 302 Found (重定向到 access-denied.html)

# 测试登录后访问自己的实例
curl -c cookies.txt -X POST http://119.8.118.149:7092/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"222","password":"your_password"}'

curl -b cookies.txt -I http://119.8.118.149:7092/222/st/
# 应该返回: 200 OK

# 测试访问别人的实例
curl -b cookies.txt -I http://119.8.118.149:7092/123/st/
# 应该返回: 302 Found (重定向到 access-denied.html)
```

---

## 🔄 工作原理详解

### 1. 用户登录

用户登录时：
```javascript
// routes/auth.js
const token = jwt.sign({ username, role }, JWT_SECRET, { expiresIn: '24h' });

res.cookie('st_token', token, {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
});
```

Token 被保存在 cookie 中，浏览器后续请求会自动携带。

### 2. 访问实例

用户访问 `/222/st/` 时：

```nginx
location /222/st/ {
    # Nginx 触发认证请求
    auth_request /auth-check-internal/222;
    error_page 401 403 = @access_denied;
    
    # 如果认证通过，才会执行下面的代理
    proxy_pass http://st_222;
}
```

### 3. 认证检查

Nginx 内部调用：

```nginx
location = /auth-check-internal/222 {
    internal;  # 只允许内部调用
    proxy_pass http://st_manager/api/auth-check/verify/222;
    proxy_set_header Cookie $http_cookie;  # 传递 cookie
}
```

### 4. 权限验证

后端接收到请求：

```javascript
// routes/auth-check.js
router.get('/verify/:username', (req, res) => {
    const requestedUsername = req.params.username;  // 222
    const token = req.cookies.st_token;
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const currentUsername = decoded.username;  // 实际登录的用户
    
    if (currentUsername === requestedUsername) {
        res.status(200).send('OK');  // 允许访问
    } else {
        res.status(403).send('Forbidden');  // 拒绝访问
    }
});
```

### 5. 返回结果

- **200 OK** → Nginx 放行请求，代理到 SillyTavern
- **401/403** → Nginx 重定向到 `/access-denied.html`

---

## 📊 与其他功能的集成

### 1. Cookie 救援模式

访问控制与 Cookie 救援模式完美配合：

```nginx
# Cookie 救援模式（处理逃逸的资源请求）
location ~ ^/(api|locales|lib|...) {
    # 基于 st_context cookie 重写 URL
    if ($cookie_st_context = "222") {
        rewrite ^(.*)$ /222/st$1 last;
    }
    # ...
}

# 重写后的请求会经过访问控制检查
location /222/st/ {
    auth_request /auth-check-internal/222;  # 仍然需要权限
    # ...
}
```

### 2. 自动配置生成

用户注册时自动生成包含访问控制的配置：

```javascript
// routes/auth.js
router.post('/register', async (req, res) => {
    // ... 创建用户
    
    // 自动生成 Nginx 配置（包含访问控制）
    generateNginxConfig();
    await reloadNginx();
    
    res.json({ message: '注册成功' });
});
```

### 3. 管理员特权

管理员可以访问所有实例：

```javascript
// routes/auth-check.js
if (user.role === 'admin') {
    console.log(`[Auth] 允许访问 - 管理员`);
    return res.status(200).send('OK');
}
```

---

## 🔓 如何禁用访问控制

如果你想回到之前的无限制访问模式：

### 方法 1：修改配置文件

```bash
nano /root/ST-server/config.json
```

修改为：
```json
{
  "nginx": {
    "enableAccessControl": false
  }
}
```

然后重新生成：
```bash
npm run generate-nginx
sudo nginx -s reload
```

### 方法 2：通过 API

```bash
TOKEN="your_admin_token"

curl -X PUT http://127.0.0.1:3000/api/config/nginx \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enableAccessControl": false}'

curl -X POST http://127.0.0.1:3000/api/config/nginx/generate \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🛡️ 安全建议

### 1. 使用强 JWT 密钥

```bash
# 生成随机密钥
openssl rand -hex 32

# 设置环境变量
export JWT_SECRET="your_very_long_random_secret"
```

### 2. 启用 HTTPS

在生产环境中使用 HTTPS：

```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    # ...
}
```

### 3. 设置 Token 过期时间

```javascript
const token = jwt.sign(
    { username, role },
    JWT_SECRET,
    { expiresIn: '24h' }  // 24小时后过期
);
```

### 4. Cookie 安全标志

在 HTTPS 下启用 Secure：

```javascript
res.cookie('st_token', token, {
    httpOnly: true,
    secure: true,  // 仅 HTTPS
    sameSite: 'strict'
});
```

---

## ✅ 完成检查清单

部署后，确认以下项目：

- [ ] 运行 `npm run enable-access-control` 成功
- [ ] `config.json` 中 `enableAccessControl: true`
- [ ] Nginx 配置包含 `auth_request`
- [ ] 认证端点 `/api/auth-check/verify/:username` 可访问
- [ ] `access-denied.html` 存在
- [ ] 用户登录后可以访问自己的实例
- [ ] 用户无法访问别人的实例
- [ ] 未登录用户被拒绝访问
- [ ] 管理员可以访问所有实例
- [ ] 访问被拒绝时显示友好页面

---

## 🎉 总结

访问控制功能现已完全集成到自动配置生成系统中！

### 核心特性

1. 🔒 **用户隔离** - 每个用户只能访问自己的实例
2. 🔑 **JWT 认证** - 基于 token 的安全验证
3. 🛡️ **Nginx auth_request** - 请求级权限检查
4. 🍪 **Cookie 传递** - 自动携带认证信息
5. 👑 **管理员特权** - 管理员可访问所有实例
6. 🎨 **友好提示** - 访问被拒绝时显示专业页面
7. ⚙️ **可配置** - 可通过配置文件启用/禁用
8. 🔄 **自动生成** - 新用户注册时自动包含访问控制

### 快速命令

```bash
# 启用访问控制
npm run enable-access-control

# 重新生成配置
npm run generate-nginx

# 查看日志
pm2 logs st-manager
```

### 相关文档

- 详细文档：`ACCESS-CONTROL.md`
- 快速指南：`ENABLE-ACCESS-CONTROL-QUICK.md`
- Cookie 救援：`COOKIE-RESCUE-MODE.md`

**你的问题已完全解决！** 🎊
