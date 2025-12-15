# 🔐 随机路径 UUID - 安全增强功能

## 📋 功能说明

为了增强安全性，每个用户的访问路径现在使用**32位随机 UUID**（无连字符）而不是固定的 `/st/`。

### 之前的路径格式
```
http://domain.com/username/st/
```

### 现在的路径格式
```
http://domain.com/username/<32位随机UUID>/
```

**UUID 格式**：32个十六进制字符（a-f, 0-9），无连字符

### 示例
```
用户 123:
  旧路径: http://119.8.118.149:7092/123/st/
  新路径: http://119.8.118.149:7092/123/a3f5e9d14b2c4a8e9f3d7c1b5e8d4a2f/
  
用户 222:
  旧路径: http://119.8.118.149:7092/222/st/
  新路径: http://119.8.118.149:7092/222/b7c4e2a56d3f4c9e8b1a5e4d2f9c7b8a/
```

---

## 🔒 安全特性

### 1. **路径不可预测**
- 使用 UUID v4（128位随机数，32字符十六进制）
- 攻击者无法通过用户名猜测访问路径
- 防止未授权访问尝试
- 短小精悍的32字符格式（移除了连字符）

### 2. **每次重启自动更新**
UUID 会在以下情况下重新生成：
- ✅ 实例启动时
- ✅ 实例重启时

这意味着：
- 旧的访问链接会失效
- 需要获取新的访问 URL
- 增加了路径泄露后的安全性

### 3. **独立 UUID**
每个用户都有自己独立的 UUID，互不相关

---

## 🚀 使用方法

### 1. 启动实例
```bash
# API 请求
POST /api/instance/start

# 响应示例
{
  "message": "Instance started successfully",
  "accessUrl": "http://119.8.118.149:7092/123/a3f5e9d14b2c4a8e9f3d7c1b5e8d4a2f/",
  "newPathUuid": "a3f5e9d14b2c4a8e9f3d7c1b5e8d4a2f",
  "info": "Access URL has been updated with a new security path. Please use the new URL."
}
```

### 2. 重启实例
```bash
# API 请求
POST /api/instance/restart

# 响应示例
{
  "message": "Instance restarted successfully",
  "accessUrl": "http://119.8.118.149:7092/123/b9e7f2d48c1a4f6e9d3b5a8c7e2f4b1a/",
  "newPathUuid": "b9e7f2d48c1a4f6e9d3b5a8c7e2f4b1a",
  "info": "Access URL has been updated with a new security path. Please use the new URL."
}
```

⚠️ **注意**：重启后 UUID 会更新，旧的 URL 将无法访问！

### 3. 获取当前访问 URL
```bash
# API 请求
GET /api/instance/info

# 响应示例
{
  "username": "123",
  "email": "user@example.com",
  "port": 3001,
  "status": "running",
  "accessUrl": "http://119.8.118.149:7092/123/a3f5e9d1-4b2c-4a8e-9f3d-7c1b5e8d4a2f/",
  ...
}
```

---

## 🔧 实现细节

### 数据库字段
在 `users` 表中添加了 `path_uuid` 字段：

```sql
ALTER TABLE users ADD COLUMN path_uuid TEXT;
```

### UUID 生成时机

1. **新用户注册时**
   - 自动生成初始 UUID
   - 保存到数据库

2. **实例启动时**
   ```javascript
   const newUuid = regeneratePathUuid(username);
   // 生成新的 UUID 并更新数据库
   ```

3. **实例重启时**
   ```javascript
   const newUuid = regeneratePathUuid(username);
   // 生成新的 UUID 并更新数据库
   ```

### Nginx 配置自动更新

每次 UUID 更新后：
1. ✅ 自动重新生成 Nginx 配置文件
2. ✅ 自动重载 Nginx（热更新）
3. ✅ 新路径立即生效

---

## 📊 工作流程

### 启动实例完整流程

```mermaid
用户点击"启动"
    ↓
生成新的随机 UUID
    ↓
保存到数据库 (path_uuid 字段)
    ↓
启动 PM2 实例
    ↓
重新生成 Nginx 配置
  (使用新的 UUID 路径)
    ↓
重载 Nginx 配置
  (热更新，无需重启)
    ↓
返回新的访问 URL
  (包含新的 UUID)
    ↓
用户使用新 URL 访问
```

### Nginx 配置生成

```nginx
# 用户 123 的配置示例
location /123/a3f5e9d1-4b2c-4a8e-9f3d-7c1b5e8d4a2f/ {
    rewrite ^/123/a3f5e9d1-4b2c-4a8e-9f3d-7c1b5e8d4a2f/(.*)$ /$1 break;
    proxy_pass http://st_123;
    
    # Cookie 标记
    add_header Set-Cookie "st_context=123; Path=/; Max-Age=86400";
    
    # ... 其他配置
}

# Cookie 救援模式也会使用新路径
if ($cookie_st_context = "123") {
    rewrite ^(.*)$ /123/a3f5e9d1-4b2c-4a8e-9f3d-7c1b5e8d4a2f$1 last;
}
```

---

## 🧪 测试验证

### 1. 检查 UUID 是否生成

```bash
# 查看数据库
sqlite3 database.sqlite
SELECT username, path_uuid FROM users WHERE role != 'admin';

# 输出示例：
# 123|a3f5e9d14b2c4a8e9f3d7c1b5e8d4a2f
# 222|b7c4e2a56d3f4c9e8b1a5e4d2f9c7b8a
```

### 2. 检查 Nginx 配置

```bash
# 查看生成的配置
cat /root/ST-server/nginx/nginx.conf | grep "location /123"

# 应该看到类似：
# location /123/a3f5e9d14b2c4a8e9f3d7c1b5e8d4a2f/ {
```

### 3. 测试访问

```bash
# 使用新 URL 访问
curl -I http://119.8.118.149:7092/123/a3f5e9d14b2c4a8e9f3d7c1b5e8d4a2f/

# 应该返回 200 OK

# 使用旧的 /st/ 路径访问
curl -I http://119.8.118.149:7092/123/st/

# 应该返回 404 Not Found
```

### 4. 测试重启后 UUID 更新

```bash
# 重启实例
curl -X POST http://127.0.0.1:3000/api/instance/restart \
  -H "Authorization: Bearer $TOKEN"

# 查看日志
pm2 logs st-manager | grep "new UUID"

# 应该看到：
# [Restart] New path UUID for 123: c8d5e1f92a4b4d7e9c3f6b8a5e2d1c4f
```

---

## 📝 数据库迁移

系统启动时会自动执行迁移：

```javascript
// 检查 path_uuid 字段是否存在
if (!hasPathUuid) {
    // 添加字段
    db.exec(`ALTER TABLE users ADD COLUMN path_uuid TEXT`);
    
    // 为现有用户生成 UUID
    users.forEach(user => {
        const uuid = randomUUID().replace(/-/g, ''); // 32位UUID
        updateStmt.run(uuid, user.id);
        console.log(`Generated UUID for user ${user.username}: ${uuid}`);
    });
}
```

---

## ⚙️ 配置选项

### 禁用 UUID（不推荐）

如果你想使用固定的 `/st/` 路径，可以修改代码：

```javascript
// 在 scripts/generate-nginx-config.js
const pathSegment = 'st'; // 固定使用 'st' 而不是 user.path_uuid
```

⚠️ **警告**：这会降低安全性！

### 自定义 UUID 更新策略

修改 `pm2-manager.js`：

```javascript
// 选项 1：只在首次启动时生成 UUID
export const startInstance = async (username, port, stDir, dataDir) => {
    const existingUuid = getUserPathUuid(username);
    if (!existingUuid) {
        regeneratePathUuid(username);
    }
    // ...
};

// 选项 2：每天更新一次（需要定时任务）
// 选项 3：手动触发更新（添加新 API）
```

---

## 🔍 故障排查

### 问题 1：UUID 未生成

**检查**：
```bash
sqlite3 database.sqlite
SELECT path_uuid FROM users WHERE username = '123';
```

**解决**：
```bash
# 重启管理平台以触发迁移
pm2 restart st-manager
```

### 问题 2：旧 URL 仍然可访问

**原因**：Nginx 配置未更新

**解决**：
```bash
# 手动重新生成配置
npm run generate-nginx

# 重载 Nginx
sudo nginx -s reload
```

### 问题 3：重启后 URL 未更新

**检查日志**：
```bash
pm2 logs st-manager | grep "new UUID"
```

**可能原因**：
1. Nginx 配置重载失败
2. 数据库写入失败

**解决**：
```bash
# 查看错误日志
pm2 logs st-manager --err

# 手动触发配置生成
curl -X POST http://127.0.0.1:3000/api/config/nginx/generate \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 📚 API 参考

### 获取用户路径 UUID

```javascript
import { getUserPathUuid } from './database.js';

const uuid = getUserPathUuid('123');
console.log(uuid); // a3f5e9d14b2c4a8e9f3d7c1b5e8d4a2f
```

### 重新生成路径 UUID

```javascript
import { regeneratePathUuid } from './database.js';

const newUuid = regeneratePathUuid('123');
console.log(newUuid); // b9e7f2d48c1a4f6e9d3b5a8c7e2f4b1a
```

### 生成访问 URL

```javascript
import { generateAccessUrl } from './utils/url-helper.js';

const url = generateAccessUrl('123', 3001);
console.log(url); 
// http://119.8.118.149:7092/123/a3f5e9d14b2c4a8e9f3d7c1b5e8d4a2f/
```

---

## 🎯 最佳实践

### 1. 保存访问链接
由于每次重启 UUID 都会变化，建议：
- 在管理面板保存当前访问链接
- 使用浏览器书签保存链接
- 或每次从管理面板获取最新链接

### 2. 通知用户
重启实例后，通知用户使用新的访问链接：
```javascript
res.json({
    message: 'Instance restarted successfully',
    accessUrl: newUrl,
    info: '⚠️ 访问链接已更新！请使用新的链接访问。'
});
```

### 3. 定期重启
建议定期重启实例以更新 UUID，增强安全性：
- 每天一次
- 或每周一次
- 根据安全需求决定

---

## 🎉 优势总结

### ✅ 安全性增强
- 路径不可预测
- 防止暴力扫描
- 限制未授权访问

### ✅ 灵活性
- 自动更新机制
- 无需手动干预
- 与现有系统无缝集成

### ✅ 兼容性
- 保留所有现有功能
- Cookie 救援模式正常工作
- sub_filter 路径重写正常工作

---

## 📞 获取帮助

如果遇到问题：
1. 查看本文档的故障排查部分
2. 检查日志：`pm2 logs st-manager`
3. 检查 Nginx 日志：`sudo tail -f /var/log/nginx/error.log`
4. 验证数据库：`sqlite3 database.sqlite`

---

**更新时间**: 2024-12-15  
**版本**: 1.0.0
