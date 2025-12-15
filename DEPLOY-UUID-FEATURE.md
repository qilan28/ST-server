# 🚀 部署随机路径 UUID 功能

## 📋 快速部署指南

### 在服务器上应用更新

```bash
#!/bin/bash

# 1. 进入项目目录
cd /root/ST-server

# 2. 上传或拉取最新代码
# 方法 A: 使用 git
git pull

# 方法 B: 手动上传修改的文件
# 需要上传以下文件：
# - database.js
# - pm2-manager.js
# - scripts/generate-nginx-config.js
# - utils/url-helper.js
# - utils/url-generator.js (新文件)
# - routes/instance.js
# - nginx/nginx.conf.template

# 3. 停止管理平台
pm2 stop st-manager

# 4. 重启管理平台以应用数据库迁移
pm2 start st-manager

# 5. 查看日志确认迁移成功
pm2 logs st-manager --lines 20

# 应该看到类似：
# Adding path_uuid column to users table...
# Path UUID column added successfully
# Generated UUID for user 123: a3f5e9d14b2c4a8e9f3d7c1b5e8d4a2f
# Generated UUID for user 222: b7c4e2a56d3f4c9e8b1a5e4d2f9c7b8a

# 6. 重新生成 Nginx 配置（使用新的 UUID 路径）
npm run generate-nginx

# 7. 测试 Nginx 配置
sudo nginx -t -c /root/ST-server/nginx/nginx.conf

# 8. 重启 Nginx
sudo nginx -s stop
sudo nginx -c /root/ST-server/nginx/nginx.conf

# 9. 验证部署
curl -I http://127.0.0.1:7092/
```

---

## ✅ 验证清单

部署完成后，逐项检查：

### 1. 数据库迁移
```bash
# 检查 path_uuid 字段
sqlite3 /root/ST-server/database.sqlite

sqlite> .schema users
# 应该看到 path_uuid TEXT 字段

sqlite> SELECT username, path_uuid FROM users WHERE role != 'admin';
# 应该看到每个用户都有 32位 UUID

sqlite> .quit
```

### 2. Nginx 配置
```bash
# 检查生成的配置文件
cat /root/ST-server/nginx/nginx.conf | grep -A 3 "location /123"

# 应该看到类似：
# location /123/a3f5e9d14b2c4a8e9f3d7c1b5e8d4a2f/ {
```

### 3. 管理平台
```bash
# 检查管理平台状态
pm2 status st-manager

# 应该显示 online

# 检查日志无错误
pm2 logs st-manager --err --lines 10
```

### 4. 功能测试

#### 测试用户登录和获取信息
```bash
# 登录
TOKEN=$(curl -s -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"123","password":"your_password"}' | jq -r .token)

# 获取用户信息
curl -s http://127.0.0.1:3000/api/instance/info \
  -H "Authorization: Bearer $TOKEN" | jq

# 应该看到 accessUrl 包含 32位 UUID：
# "accessUrl": "http://119.8.118.149:7092/123/a3f5e9d14b2c4a8e9f3d7c1b5e8d4a2f/"
```

#### 测试重启实例
```bash
# 记录重启前的 UUID
OLD_UUID=$(curl -s http://127.0.0.1:3000/api/instance/info \
  -H "Authorization: Bearer $TOKEN" | jq -r .accessUrl)

echo "重启前 URL: $OLD_UUID"

# 重启实例
curl -s -X POST http://127.0.0.1:3000/api/instance/restart \
  -H "Authorization: Bearer $TOKEN" | jq

# 应该看到：
# "message": "Instance restarted successfully"
# "newPathUuid": "新的UUID"
# "info": "Access URL has been updated..."

# 获取新 URL
NEW_UUID=$(curl -s http://127.0.0.1:3000/api/instance/info \
  -H "Authorization: Bearer $TOKEN" | jq -r .accessUrl)

echo "重启后 URL: $NEW_UUID"

# 验证 UUID 已更新
if [ "$OLD_UUID" != "$NEW_UUID" ]; then
    echo "✅ UUID 更新成功！"
else
    echo "❌ UUID 未更新"
fi
```

#### 测试访问
```bash
# 使用新 URL 访问（从上面获取，这里是示例）
curl -I http://119.8.118.149:7092/123/a3f5e9d14b2c4a8e9f3d7c1b5e8d4a2f/

# 应该返回 200 OK 或 302 Found

# 使用旧的 /st/ 路径访问
curl -I http://119.8.118.149:7092/123/st/

# 应该返回 404 Not Found
```

---

## 🔄 更新现有实例

如果你有运行中的实例，需要重启它们以获取新的 UUID：

```bash
#!/bin/bash

# 获取所有运行中的实例
pm2 list | grep "st-" | awk '{print $2}' | while read instance; do
    # 提取用户名
    username=${instance#st-}
    
    echo "重启实例: $username"
    
    # 重启实例（会自动生成新 UUID）
    pm2 restart $instance
    
    # 等待几秒钟
    sleep 2
    
    # 查看新 UUID
    echo "新 UUID 已生成，查看数据库："
    sqlite3 /root/ST-server/database.sqlite \
      "SELECT username, path_uuid FROM users WHERE username='$username'"
done

# 重新生成 Nginx 配置
echo "重新生成 Nginx 配置..."
npm run generate-nginx

# 重载 Nginx
echo "重载 Nginx..."
sudo nginx -s reload

echo "✅ 所有实例已更新！"
```

或者使用管理平台 API：

```bash
#!/bin/bash

# 管理员登录
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_admin_password"}' | jq -r .token)

# 获取所有用户
USERS=$(curl -s http://127.0.0.1:3000/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[].username')

# 为每个用户重启实例
for username in $USERS; do
    echo "重启用户 $username 的实例..."
    
    # 用户登录（需要用户密码）
    USER_TOKEN=$(curl -s -X POST http://127.0.0.1:3000/api/auth/login \
      -H "Content-Type: application/json" \
      -d "{\"username\":\"$username\",\"password\":\"user_password\"}" | jq -r .token)
    
    # 重启实例
    curl -s -X POST http://127.0.0.1:3000/api/instance/restart \
      -H "Authorization: Bearer $USER_TOKEN"
    
    echo "用户 $username 重启完成"
done
```

---

## 📊 监控和日志

### 查看 UUID 生成日志
```bash
# 实时查看日志
pm2 logs st-manager --lines 0 | grep UUID

# 应该看到：
# [Security] Regenerated path UUID for 123: a3f5e9d1...
# [Start] New path UUID for 123: a3f5e9d1...
# [Restart] New path UUID for 222: b7c4e2a5...
```

### 查看 Nginx 重载日志
```bash
pm2 logs st-manager --lines 0 | grep Nginx

# 应该看到：
# [Start] Regenerating Nginx config for 123 (new UUID: ...)
# [Start] ✅ Nginx config reloaded (method: signal)
```

### 查看访问日志
```bash
# Nginx 访问日志
sudo tail -f /var/log/nginx/access.log

# 应该看到新的 UUID 路径：
# GET /123/a3f5e9d1-4b2c-4a8e-9f3d-7c1b5e8d4a2f/ HTTP/1.1" 200
```

---

## ⚠️ 注意事项

### 1. 通知用户
部署后，需要通知所有用户：
- ✅ 访问链接已更改
- ✅ 需要使用新的链接访问
- ✅ 旧链接已失效

### 2. 保存访问链接
建议用户：
- 在管理面板查看最新访问链接
- 保存到浏览器书签
- 每次重启后重新获取链接

### 3. 定期重启
为了安全，建议定期重启实例：
```bash
# 添加到 crontab
# 每天凌晨 3 点重启所有实例
0 3 * * * /root/ST-server/scripts/restart-all-instances.sh
```

---

## 🔧 回滚方案

如果出现问题需要回滚：

```bash
#!/bin/bash

cd /root/ST-server

# 1. 恢复旧代码
git checkout HEAD~1

# 2. 重启管理平台
pm2 restart st-manager

# 3. 重新生成 Nginx 配置（使用旧格式）
npm run generate-nginx

# 4. 重载 Nginx
sudo nginx -s reload

# 5. 验证
curl -I http://119.8.118.149:7092/123/st/
# 应该返回 200 OK
```

⚠️ **注意**：回滚后 path_uuid 字段仍然存在于数据库，但不会被使用。

---

## 📝 修改的文件清单

### 核心文件
- [x] `database.js` - 添加 path_uuid 字段和相关函数
- [x] `pm2-manager.js` - 启动/重启时生成新 UUID
- [x] `scripts/generate-nginx-config.js` - 使用 UUID 生成配置
- [x] `utils/url-helper.js` - 生成包含 UUID 的访问 URL
- [x] `routes/instance.js` - 返回新的访问 URL

### 新增文件
- [x] `utils/url-generator.js` - URL 生成工具（备选）
- [x] `RANDOM-PATH-UUID.md` - 功能说明文档
- [x] `DEPLOY-UUID-FEATURE.md` - 部署指南（本文件）

### 配置文件
- [x] `nginx/nginx.conf.template` - 更新模板（如需要）

---

## ✅ 部署完成检查表

- [ ] 代码已上传到服务器
- [ ] 管理平台已重启
- [ ] 数据库迁移成功（path_uuid 字段已添加）
- [ ] 所有用户都有 UUID
- [ ] Nginx 配置已重新生成
- [ ] Nginx 配置测试通过
- [ ] Nginx 已重载
- [ ] 测试新 URL 可访问
- [ ] 测试旧 /st/ 路径返回 404
- [ ] 测试重启功能更新 UUID
- [ ] 日志无错误
- [ ] 已通知用户更新链接

---

## 🎉 部署成功！

现在你的系统已经启用了随机路径 UUID 功能，安全性大大提升！

**后续步骤**：
1. 监控日志确保一切正常
2. 定期检查 UUID 是否正常更新
3. 收集用户反馈
4. 根据需要调整更新策略

**获取帮助**：
- 查看 `RANDOM-PATH-UUID.md` 了解功能详情
- 查看 `pm2 logs st-manager` 排查问题
- 检查 Nginx 日志：`sudo tail -f /var/log/nginx/error.log`
