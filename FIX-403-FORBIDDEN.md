# 🔧 修复 403 Forbidden 问题

## 问题描述
用户已登录（用户名 `123`），访问自己的实例 `/123/st/` 时显示"访问被拒绝 403 Forbidden"。

## 根本原因
Nginx `auth_request` 内部调用时，Cookie 头信息传递不完整，导致认证端点无法获取 JWT token。

---

## ✅ 快速修复步骤

### 1️⃣ 上传修复文件到服务器

需要上传以下修复后的文件：
- `routes/auth-check.js` - 添加了详细的调试日志
- `scripts/generate-nginx-config.js` - 优化了 Cookie 传递配置

```bash
cd /root/ST-server

# 方法 A: 使用 git（推荐）
git pull

# 方法 B: 手动上传文件
# 使用 scp 或其他方式上传修复后的文件
```

### 2️⃣ 重新生成 Nginx 配置

```bash
cd /root/ST-server

# 重新生成配置（包含优化的 Cookie 传递）
npm run generate-nginx

# 检查生成结果
echo "✅ 检查认证端点配置:"
grep -A 10 "auth-check-internal/123" nginx/nginx.conf
```

### 3️⃣ 测试 Nginx 配置

```bash
# 测试配置语法
sudo nginx -t -c /root/ST-server/nginx/nginx.conf

# 应该显示: syntax is ok, test is successful
```

### 4️⃣ 重启服务

```bash
# 重启管理平台（应用新的调试日志）
pm2 restart st-manager

# 等待 2 秒
sleep 2

# 重启 Nginx（应用新的配置）
sudo nginx -s stop
sudo nginx -c /root/ST-server/nginx/nginx.conf

# 检查服务状态
echo "✅ 检查服务状态:"
pm2 list | grep st-manager
ps aux | grep nginx | grep -v grep
```

### 5️⃣ 测试访问并查看日志

```bash
# 打开日志监控
pm2 logs st-manager --lines 0

# 然后在浏览器中访问: http://119.8.118.149:7092/123/st/
# 观察日志输出
```

你应该在日志中看到：
```
[Auth] 检查访问权限 /123/st/
[Auth] Cookies: { st_token: 'eyJhbGc...' }
[Auth] Headers Cookie: st_token=eyJhbGc...
[Auth] ✅ 允许访问 /123/st/ - 用户: 123
```

如果看到错误：
```
[Auth] ❌ 拒绝访问 /123/st/ - 未提供token
[Auth] 可用的 cookies: []
```

这说明 Cookie 仍未传递，需要进一步诊断。

---

## 🔍 详细诊断步骤

### 诊断 1：检查浏览器 Cookie

在浏览器按 `F12`，Console 执行：

```javascript
// 1. 查看所有 Cookie
console.log('所有 Cookie:', document.cookie);

// 2. 检查 st_token
const token = document.cookie.split('st_token=')[1]?.split(';')[0];
if (token) {
    console.log('✅ Token 存在');
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('用户名:', payload.username);
    console.log('角色:', payload.role);
} else {
    console.log('❌ Token 不存在，需要重新登录');
}
```

如果 Token 不存在，**重新登录**：
1. 清除浏览器 Cookie
2. 访问 `http://119.8.118.149:7092/`
3. 重新登录用户 `123`

### 诊断 2：手动测试认证端点

```bash
# 在服务器上，先登录获取 token
TOKEN=$(curl -s -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"123","password":"your_password"}' \
  | jq -r .token)

echo "Token: $TOKEN"

# 使用 Cookie 测试认证端点
curl -v -b "st_token=$TOKEN" \
  http://127.0.0.1:3000/api/auth-check/verify/123

# 应该返回: 200 OK
# 并在 pm2 logs 中看到详细日志
```

### 诊断 3：检查生成的 Nginx 配置

```bash
# 查看用户 123 的认证端点配置
grep -A 15 "location = /auth-check-internal/123" /root/ST-server/nginx/nginx.conf

# 应该包含:
# proxy_set_header Cookie $http_cookie;
# proxy_set_header Host $http_host;
```

### 诊断 4：测试 Nginx 代理

```bash
# 使用 curl 模拟浏览器请求
curl -v -b "st_token=your_token_here" \
  http://119.8.118.149:7092/123/st/

# 查看响应头和状态码
# 200 = 成功
# 302 = 重定向到 access-denied.html
# 401/403 = 认证失败
```

---

## 🛠️ 核心修复内容

### 修复 1：优化 Nginx Cookie 传递

**修改前**（`scripts/generate-nginx-config.js`）：
```javascript
location = /auth-check-internal/${user.username} {
    internal;
    proxy_pass http://st_manager/api/auth-check/verify/${user.username};
    proxy_set_header Cookie $http_cookie;
}
```

**修改后**：
```javascript
location = /auth-check-internal/${user.username} {
    internal;
    proxy_pass http://st_manager/api/auth-check/verify/${user.username};
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header X-Original-URI $request_uri;
    proxy_set_header X-Original-Method $request_method;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Host $http_host;           // ← 关键！
    proxy_set_header Cookie $http_cookie;       // ← 关键！
}
```

**关键点**：
- `Host $http_host` - 确保 Host 头正确传递
- `Cookie $http_cookie` - 确保 Cookie 正确传递

### 修复 2：添加详细的调试日志

**修改前**（`routes/auth-check.js`）：
```javascript
router.get('/verify/:username', (req, res) => {
    const requestedUsername = req.params.username;
    let token = req.cookies?.st_token;
    
    if (!token) {
        console.log(`[Auth] 拒绝访问 - 未提供token`);
        return res.status(401).send('Unauthorized');
    }
    // ...
});
```

**修改后**：
```javascript
router.get('/verify/:username', (req, res) => {
    const requestedUsername = req.params.username;
    
    // 详细日志
    console.log(`[Auth] 检查访问权限 /${requestedUsername}/st/`);
    console.log(`[Auth] Cookies:`, req.cookies);
    console.log(`[Auth] Headers Cookie:`, req.headers.cookie);
    
    let token = req.cookies?.st_token;
    
    if (!token) {
        console.log(`[Auth] ❌ 拒绝访问 - 未提供token`);
        console.log(`[Auth] 可用的 cookies:`, Object.keys(req.cookies || {}));
        return res.status(401).send('Unauthorized');
    }
    // ...
});
```

**作用**：
- 显示接收到的所有 Cookie
- 帮助快速定位问题（Cookie 是否传递）

---

## 📊 预期结果

### 成功的日志输出

```bash
pm2 logs st-manager

# 应该看到:
[Auth] 检查访问权限 /123/st/
[Auth] Cookies: { st_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
[Auth] Headers Cookie: st_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
[Auth] ✅ 允许访问 /123/st/ - 用户: 123
```

### 失败的日志输出

```bash
# 如果 Cookie 未传递:
[Auth] 检查访问权限 /123/st/
[Auth] Cookies: {}
[Auth] Headers Cookie: undefined
[Auth] ❌ 拒绝访问 /123/st/ - 未提供token
[Auth] 可用的 cookies: []
```

---

## 🔄 如果仍然失败

### 方案 A：临时禁用访问控制

如果急需使用，可以临时禁用访问控制：

```bash
# 编辑配置文件
nano /root/ST-server/config.json

# 修改为:
{
  "nginx": {
    "enableAccessControl": false  // ← 禁用访问控制
  }
}

# 重新生成配置
npm run generate-nginx

# 重启 Nginx
sudo nginx -s reload
```

**注意**：这会让所有人都能访问所有实例！

### 方案 B：检查 Cookie 域和路径

```bash
# 查看登录时设置的 Cookie
grep -A 5 "res.cookie" routes/auth.js

# 确认 Cookie 设置:
# - Path: /
# - SameSite: lax
# - HttpOnly: true
```

### 方案 C：使用 Nginx 日志诊断

```bash
# 启用 Nginx 调试日志
sudo nano /etc/nginx/nginx.conf

# 在 http 块中添加:
error_log /var/log/nginx/error.log debug;

# 重启 Nginx
sudo nginx -s reload

# 查看详细日志
sudo tail -f /var/log/nginx/error.log
```

---

## ✅ 完成检查清单

修复后，确认以下项目：

- [ ] 已上传修复文件到服务器
- [ ] 已运行 `npm run generate-nginx`
- [ ] Nginx 配置包含完整的代理头（`grep "proxy_set_header Host" nginx/nginx.conf`）
- [ ] 已重启管理平台（`pm2 restart st-manager`）
- [ ] 已重启 Nginx（`sudo nginx -s reload`）
- [ ] 浏览器中有 `st_token` Cookie
- [ ] 访问 `/123/st/` 能看到详细的认证日志
- [ ] 日志显示 "✅ 允许访问"
- [ ] 成功访问 SillyTavern 界面

---

## 🆘 获取帮助

如果以上步骤都无效，提供以下信息：

1. **管理平台日志**（最后 50 行）
   ```bash
   pm2 logs st-manager --lines 50 --nostream
   ```

2. **生成的 Nginx 配置**（认证端点部分）
   ```bash
   grep -A 15 "auth-check-internal/123" /root/ST-server/nginx/nginx.conf
   ```

3. **浏览器 Cookie**
   ```javascript
   document.cookie
   ```

4. **手动测试认证端点的结果**
   ```bash
   curl -v -b "st_token=your_token" http://127.0.0.1:3000/api/auth-check/verify/123
   ```

5. **Nginx 错误日志**
   ```bash
   sudo tail -50 /var/log/nginx/error.log
   ```

---

## 📝 快速命令参考

```bash
# 完整修复流程
cd /root/ST-server
git pull
npm run generate-nginx
sudo nginx -t
pm2 restart st-manager
sudo nginx -s stop && sudo nginx -c /root/ST-server/nginx/nginx.conf
pm2 logs st-manager

# 查看日志
pm2 logs st-manager | grep -i auth

# 检查配置
grep -A 10 "auth-check-internal" nginx/nginx.conf

# 测试认证
curl -b "st_token=xxx" http://127.0.0.1:3000/api/auth-check/verify/123
```
