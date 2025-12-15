# 🔍 诊断访问跳转问题

## 问题描述
访问 `/123/st/` 时，即使已登录，仍会跳转到用户面板（主页）。

## 🎯 可能的原因

### 1. 访问控制未正确配置
- `config.json` 中 `enableAccessControl` 可能为 `false`
- Nginx 配置未包含 `auth_request` 指令

### 2. Cookie 传递问题
- Nginx 未正确传递 Cookie 给认证端点
- JWT token 未正确设置或已过期

### 3. 用户名不匹配
- 登录用户 A，但尝试访问用户 B 的实例
- 例如：登录 `admin`，访问 `/123/st/`

### 4. 访问拒绝页面配置问题
- `access-denied.html` 不存在
- `@access_denied` 重定向到错误的位置

---

## 🔧 快速诊断步骤

### 步骤 1：检查你登录的用户名

在浏览器控制台执行：
```javascript
// 查看当前 Cookie
document.cookie

// 应该看到: st_token=eyJhbGc...
```

如果没有 `st_token`，说明未正确登录，需要重新登录。

### 步骤 2：检查 JWT Token 内容

```javascript
// 解码 token（在浏览器控制台）
const token = document.cookie.split('st_token=')[1]?.split(';')[0];
if (token) {
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('登录用户:', payload.username);
    console.log('角色:', payload.role);
} else {
    console.log('❌ 未找到 token');
}
```

记住你的 `username`，你只能访问 `/<username>/st/`。

### 步骤 3：访问正确的路径

**如果你登录的是用户 `123`**：
- ✅ 应该访问：`http://119.8.118.149:7092/123/st/`
- ❌ 不能访问：`http://119.8.118.149:7092/222/st/`

**如果你是管理员 `admin`**：
- ✅ 可以访问：任何用户的实例（需要先修复代码逻辑）

### 步骤 4：在服务器上检查日志

```bash
# 查看管理平台日志（会显示认证信息）
pm2 logs st-manager --lines 50

# 查找认证相关日志
pm2 logs st-manager | grep Auth
```

你应该看到类似的日志：
```
[Auth] 允许访问 /123/st/ - 用户: 123
```

或者错误：
```
[Auth] 拒绝访问 /123/st/ - 用户 222 无权访问
[Auth] 拒绝访问 /123/st/ - 未提供token
```

---

## 🛠️ 服务器端修复

### 修复 1：更新代码逻辑

上传修复后的文件：
- `routes/auth-check.js`（已修复管理员权限检查顺序）
- `scripts/generate-nginx-config.js`（已修复模板字符串嵌套）

```bash
cd /root/ST-server

# 上传文件后，重启管理平台
pm2 restart st-manager

# 查看日志确认重启成功
pm2 logs st-manager --lines 20
```

### 修复 2：确保访问控制已启用

```bash
# 查看配置
cat /root/ST-server/config.json

# 应该包含:
# "enableAccessControl": true
```

如果没有此配置，创建或更新：
```bash
cat > /root/ST-server/config.json << 'EOF'
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
EOF
```

### 修复 3：重新生成 Nginx 配置

```bash
cd /root/ST-server

# 重新生成配置
npm run generate-nginx

# 检查生成的配置中是否包含 auth_request
grep "auth_request" nginx/nginx.conf

# 应该看到类似:
# auth_request /auth-check-internal/123;
# auth_request /auth-check-internal/222;

# 检查认证端点
grep -A 5 "auth-check-internal" nginx/nginx.conf
```

### 修复 4：确保 access-denied.html 存在

```bash
# 检查文件
ls -l /root/ST-server/public/access-denied.html

# 如果不存在，创建它
mkdir -p /root/ST-server/public

cat > /root/ST-server/public/access-denied.html << 'HTMLEOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>访问被拒绝</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 500px;
        }
        h1 { color: #e74c3c; margin-bottom: 20px; }
        p { color: #555; line-height: 1.6; }
        .button {
            display: inline-block;
            margin: 10px 5px;
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
        <ul style="text-align: left; display: inline-block;">
            <li>您未登录</li>
            <li>您尝试访问其他用户的实例</li>
            <li>您的登录已过期</li>
        </ul>
        <div style="margin-top: 20px;">
            <a href="/" class="button">返回首页</a>
            <a href="/login.html" class="button">重新登录</a>
        </div>
    </div>
</body>
</html>
HTMLEOF

echo "✅ access-denied.html 已创建"
```

### 修复 5：重启所有服务

```bash
# 重启管理平台
pm2 restart st-manager

# 重启 Nginx
sudo nginx -s stop
sudo nginx -c /root/ST-server/nginx/nginx.conf

# 检查服务状态
pm2 list
ps aux | grep nginx
```

---

## 🧪 测试流程

### 测试 1：手动测试认证端点

```bash
# 测试未登录访问（应该失败）
curl -i http://127.0.0.1:3000/api/auth-check/verify/123

# 应该返回: 401 Unauthorized

# 测试登录后访问
# 先登录获取 token
TOKEN=$(curl -s -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"123","password":"your_password"}' \
  | jq -r .token)

echo "Token: $TOKEN"

# 使用 Cookie 测试认证
curl -i -b "st_token=$TOKEN" \
  http://127.0.0.1:3000/api/auth-check/verify/123

# 应该返回: 200 OK
```

### 测试 2：浏览器测试

1. **清除浏览器 Cookie**
   - 按 `F12` 打开开发者工具
   - Application → Cookies → 删除所有

2. **重新登录**
   - 访问 `http://119.8.118.149:7092/`
   - 登录用户 `123`

3. **检查 Cookie**
   - 在控制台执行：`document.cookie`
   - 应该看到 `st_token=...`

4. **访问自己的实例**
   - 访问 `http://119.8.118.149:7092/123/st/`
   - 应该能正常访问 SillyTavern

5. **尝试访问别人的实例**
   - 访问 `http://119.8.118.149:7092/222/st/`
   - 应该被拒绝，显示访问拒绝页面

---

## 🔍 详细日志查看

### 查看 Nginx 错误日志

```bash
# 实时查看错误
sudo tail -f /var/log/nginx/error.log

# 查看最近的错误
sudo tail -100 /var/log/nginx/error.log
```

### 查看管理平台认证日志

```bash
# 实时查看
pm2 logs st-manager

# 只看认证相关
pm2 logs st-manager | grep -i auth

# 查看最近 100 行
pm2 logs st-manager --lines 100
```

### 检查生成的 Nginx 配置

```bash
# 查看用户 123 的配置
grep -A 20 "location /123/st/" /root/ST-server/nginx/nginx.conf

# 应该看到:
# location /123/st/ {
#     auth_request /auth-check-internal/123;
#     error_page 401 403 = @access_denied;
#     ...
# }
```

---

## 🎯 问题定位检查表

请逐项检查：

- [ ] **已上传修复文件** - `routes/auth-check.js` 和 `scripts/generate-nginx-config.js`
- [ ] **管理平台已重启** - `pm2 restart st-manager`
- [ ] **配置文件正确** - `config.json` 包含 `enableAccessControl: true`
- [ ] **Nginx 配置已重新生成** - `npm run generate-nginx`
- [ ] **Nginx 配置包含 auth_request** - `grep "auth_request" nginx/nginx.conf`
- [ ] **access-denied.html 存在** - `ls public/access-denied.html`
- [ ] **Nginx 已重启** - `sudo nginx -s reload`
- [ ] **Cookie 正确设置** - 浏览器中 `document.cookie` 包含 `st_token`
- [ ] **访问正确路径** - 登录用户 123 访问 `/123/st/`，不是 `/222/st/`
- [ ] **日志无错误** - `pm2 logs st-manager` 显示 "允许访问"

---

## 🆘 仍然无法解决？

提供以下信息：

1. **登录的用户名**
   ```javascript
   // 在浏览器控制台执行
   const token = document.cookie.split('st_token=')[1]?.split(';')[0];
   const payload = JSON.parse(atob(token.split('.')[1]));
   console.log('用户名:', payload.username);
   ```

2. **尝试访问的URL**
   - 例如：`http://119.8.118.149:7092/123/st/`

3. **管理平台日志**
   ```bash
   pm2 logs st-manager --lines 50 | grep -i auth
   ```

4. **Nginx 配置**
   ```bash
   grep -A 10 "location /123/st/" /root/ST-server/nginx/nginx.conf
   ```

5. **浏览器跳转行为**
   - 打开开发者工具 (F12) → Network
   - 访问 `/123/st/`
   - 截图网络请求，特别是状态码

---

## ✅ 预期结果

修复后：
- ✅ 登录用户 123，访问 `/123/st/` → 成功显示 SillyTavern
- ❌ 登录用户 123，访问 `/222/st/` → 显示"访问被拒绝"页面
- ❌ 未登录，访问 `/123/st/` → 显示"访问被拒绝"页面
- ✅ 管理员访问任何实例 → 成功

---

## 📝 快速命令总结

```bash
# 1. 重启管理平台
pm2 restart st-manager

# 2. 重新生成 Nginx 配置
npm run generate-nginx

# 3. 重启 Nginx
sudo nginx -s stop && sudo nginx -c /root/ST-server/nginx/nginx.conf

# 4. 查看日志
pm2 logs st-manager | grep -i auth

# 5. 测试认证端点
curl -i http://127.0.0.1:3000/api/auth-check/verify/123
```
