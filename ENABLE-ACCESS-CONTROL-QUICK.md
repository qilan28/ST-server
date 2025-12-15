# 🔒 快速启用访问控制

## ⚡ 一键启用（推荐）

```bash
cd /root/ST-server

# 1. 确保配置文件存在
cat config.json

# 如果不存在，创建它：
cat > config.json << 'EOF'
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

# 2. 重新生成 Nginx 配置（包含访问控制）
npm run generate-nginx

# 3. 测试配置
sudo nginx -t -c /root/ST-server/nginx/nginx.conf

# 4. 重启 Nginx
sudo nginx -s stop
sudo nginx -c /root/ST-server/nginx/nginx.conf

# 5. 重启管理平台
pm2 restart st-manager

# ✅ 完成！
```

---

## 🎯 效果

### ✅ 启用前

```
任何人都可以访问任何用户的实例：
- http://119.8.118.149:7092/222/st/ → ✅ 所有人都能访问
- http://119.8.118.149:7092/123/st/ → ✅ 所有人都能访问
```

### ✅ 启用后

```
只有对应用户才能访问自己的实例：
- 用户 222 访问 /222/st/ → ✅ 成功
- 用户 123 访问 /222/st/ → ❌ 拒绝（403 Forbidden）
- 未登录访问 /222/st/ → ❌ 拒绝（401 Unauthorized）
- 管理员访问任意实例 → ✅ 成功（管理员特权）
```

---

## 🧪 快速测试

### 测试 1：用户访问自己的实例

```bash
# 在浏览器中：
1. 访问 http://119.8.118.149:7092/
2. 登录用户 222
3. 访问 http://119.8.118.149:7092/222/st/
4. 应该能正常访问 ✅
```

### 测试 2：用户访问别人的实例

```bash
# 在浏览器中（保持 222 登录状态）：
1. 访问 http://119.8.118.149:7092/123/st/
2. 应该被拒绝，跳转到访问拒绝页面 ❌
```

### 测试 3：未登录访问

```bash
# 在隐私窗口/无痕模式中：
1. 访问 http://119.8.118.149:7092/222/st/
2. 应该被拒绝，跳转到访问拒绝页面 ❌
```

---

## 📋 配置说明

### config.json

```json
{
  "nginx": {
    "enableAccessControl": true  // 🔒 启用访问控制
  }
}
```

**选项**：
- `true` - 启用访问控制（推荐）
- `false` - 禁用访问控制（任何人都可以访问）

---

## 🔧 生成的配置差异

### 启用访问控制

```nginx
location /222/st/ {
    # 🔒 访问控制：只有 222 用户才能访问
    auth_request /auth-check-internal/222;
    error_page 401 403 = @access_denied;
    
    # ... 其他配置
}

# 认证检查端点
location = /auth-check-internal/222 {
    internal;
    proxy_pass http://st_manager/api/auth-check/verify/222;
    # ...
}

# 访问被拒绝页面
location @access_denied {
    return 302 /access-denied.html;
}
```

### 禁用访问控制

```nginx
location /222/st/ {
    # 无访问控制，任何人都可以访问
    
    # ... 其他配置
}
```

---

## 🔍 验证访问控制已启用

### 1. 检查配置文件

```bash
grep "enableAccessControl" config.json
# 应该显示: "enableAccessControl": true
```

### 2. 检查生成的 Nginx 配置

```bash
grep "auth_request" /root/ST-server/nginx/nginx.conf
# 应该看到: auth_request /auth-check-internal/222;

grep "auth-check-internal" /root/ST-server/nginx/nginx.conf
# 应该看到多个内部认证端点
```

### 3. 测试认证接口

```bash
# 未登录访问（应该失败）
curl -I http://127.0.0.1:3000/api/auth-check/verify/222
# 应该返回: 401 Unauthorized

# 登录后测试
TOKEN=$(curl -s -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"222","password":"your_password"}' \
  | jq -r .token)

curl -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:3000/api/auth-check/verify/222
# 应该返回: 200 OK
```

---

## 🛠️ 故障排查

### 问题：所有人都还能访问

**原因**：配置未生效

**解决**：
```bash
# 1. 确认配置
cat config.json | grep enableAccessControl

# 2. 重新生成
npm run generate-nginx

# 3. 检查生成的配置
grep "auth_request" /root/ST-server/nginx/nginx.conf

# 4. 重启 Nginx
sudo nginx -s stop
sudo nginx -c /root/ST-server/nginx/nginx.conf
```

### 问题：所有人都无法访问（包括自己）

**原因**：管理平台未运行或认证接口有问题

**解决**：
```bash
# 1. 检查管理平台
pm2 list
pm2 logs st-manager

# 2. 测试认证接口
curl http://127.0.0.1:3000/api/auth-check/verify/222

# 3. 重启管理平台
pm2 restart st-manager
```

### 问题：跳转到 404 而不是访问拒绝页面

**原因**：access-denied.html 不存在

**解决**：
```bash
# 检查文件
ls -l /root/ST-server/public/access-denied.html

# 如果不存在，从备份恢复或重新创建
```

---

## 🎨 自定义访问拒绝页面

```bash
nano /root/ST-server/public/access-denied.html
```

快速模板：
```html
<!DOCTYPE html>
<html>
<head>
    <title>访问被拒绝</title>
    <style>
        body {
            text-align: center;
            padding: 50px;
            font-family: Arial;
        }
        h1 { color: #e74c3c; }
    </style>
</head>
<body>
    <h1>🔒 访问被拒绝</h1>
    <p>您没有权限访问此资源</p>
    <a href="/">返回首页</a>
    <a href="/login.html">登录</a>
</body>
</html>
```

---

## 📊 权限矩阵

| 访问者 | /222/st/ | /123/st/ | 管理平台 |
|-------|----------|----------|----------|
| 用户 222 | ✅ 允许 | ❌ 拒绝 | ✅ 允许 |
| 用户 123 | ❌ 拒绝 | ✅ 允许 | ✅ 允许 |
| 管理员 | ✅ 允许 | ✅ 允许 | ✅ 允许 |
| 未登录 | ❌ 拒绝 | ❌ 拒绝 | ⚠️ 部分 |

---

## ✅ 完成检查清单

- [ ] `config.json` 中 `enableAccessControl: true`
- [ ] 运行 `npm run generate-nginx` 成功
- [ ] Nginx 配置包含 `auth_request`
- [ ] 管理平台正常运行
- [ ] 用户登录后可以访问自己的实例
- [ ] 用户无法访问别人的实例
- [ ] 未登录用户被拒绝
- [ ] 管理员可以访问所有实例

---

## 🎉 完成

现在你的系统已经启用了访问控制！

**核心功能**：
- 🔒 用户隔离 - 只能访问自己的实例
- 🛡️ 身份验证 - 基于 JWT token
- 👑 管理员特权 - 管理员可访问所有实例
- 🎨 友好提示 - 访问被拒绝时显示友好页面

**详细文档**：`ACCESS-CONTROL.md`
