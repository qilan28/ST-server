# 🔧 修复 UUID 数据损坏问题

## ❌ 问题描述

访问地址显示异常，UUID 中包含了时间戳等其他数据：

```
错误的URL: http://119.8.118.149:7092/222/25d4420e5/12/4.5.09:51:34ce533376ec6/
正确的URL: http://119.8.118.149:7092/222/25d44c447b2442d3909f2ee533376ec6/
```

**原因**：数据库中 `path_uuid` 字段存储了错误的数据

---

## 🚀 快速修复

在服务器上运行：

```bash
cd /root/ST-server

# 1. 修复数据库中的 UUID
npm run fix-uuid

# 应该看到类似输出：
# ✅ 修复用户 222:
#    旧UUID: 25d4420e5/12/4.5.09:51:34ce533376ec6
#    新UUID: a3f5e9d14b2c4a8e9f3d7c1b5e8d4a2f

# 2. 重新生成 Nginx 配置
npm run generate-nginx

# 3. 重载 Nginx
sudo nginx -s reload

# 4. 重启管理平台（可选，但推荐）
pm2 restart st-manager
```

完成！现在访问地址应该正常显示了。

---

## 📋 详细步骤

### 1. 检查当前问题

```bash
# 查看数据库中的 UUID
cd /root/ST-server
sqlite3 database.sqlite

sqlite> SELECT username, path_uuid FROM users WHERE role != 'admin';
# 如果看到 UUID 包含特殊字符或不是32位十六进制，说明有问题

sqlite> .quit
```

### 2. 运行修复脚本

```bash
npm run fix-uuid
```

**脚本功能**：
- 检查所有用户的 `path_uuid` 字段
- 验证是否为有效的32位十六进制UUID
- 如果无效，生成新的32位UUID并更新数据库
- 输出修复结果

**示例输出**：
```
====================================
  修复数据库中的 UUID
====================================

找到 2 个用户需要检查

✅ 修复用户 222:
   旧UUID: 25d4420e5/12/4.5.09:51:34ce533376ec6
   新UUID: b7c4e2a56d3f4c9e8b1a5e4d2f9c7b8a

✓ 用户 123 的 UUID 正常: a3f5e9d14b2c4a8e9f3d7c1b5e8d4a2f

====================================
  修复完成
====================================
✅ 修复: 1 个用户
✓ 跳过: 1 个用户（UUID正常）

请重新生成 Nginx 配置并重载：
  npm run generate-nginx
  sudo nginx -s reload
```

### 3. 重新生成 Nginx 配置

```bash
npm run generate-nginx
```

这会使用修复后的 UUID 重新生成所有 Nginx 配置。

### 4. 重载 Nginx

```bash
sudo nginx -s reload
```

### 5. 验证修复

```bash
# 方法 A: 查看数据库
sqlite3 database.sqlite
SELECT username, path_uuid FROM users WHERE role != 'admin';
# 应该看到所有UUID都是32位十六进制

# 方法 B: 查看 Nginx 配置
cat nginx/nginx.conf | grep "location /222"
# 应该看到正确的 UUID 路径

# 方法 C: 访问管理面板
# 登录后查看访问地址，应该显示正确的 URL
```

---

## 🔍 UUID 验证规则

**有效的32位UUID**：
- 长度恰好32个字符
- 只包含十六进制字符（0-9, a-f, A-F）
- 示例：`a3f5e9d14b2c4a8e9f3d7c1b5e8d4a2f`

**无效的UUID**：
- ❌ 包含连字符：`a3f5e9d1-4b2c-4a8e-9f3d-7c1b5e8d4a2f`
- ❌ 包含时间戳：`25d4420e5/12/4.5.09:51:34ce533376ec6`
- ❌ 长度不对：`abc123`
- ❌ 包含特殊字符：`abc@123!xyz`
- ❌ 空值：`null` 或 `undefined`

---

## 🧪 测试修复结果

### 测试 1：数据库验证

```bash
sqlite3 /root/ST-server/database.sqlite << EOF
.mode column
.headers on
SELECT 
    username,
    LENGTH(path_uuid) as uuid_length,
    path_uuid
FROM users 
WHERE role != 'admin';
EOF

# 预期输出：
# username  uuid_length  path_uuid
# --------  -----------  --------------------------------
# 222       32           b7c4e2a56d3f4c9e8b1a5e4d2f9c7b8a
# 123       32           a3f5e9d14b2c4a8e9f3d7c1b5e8d4a2f
```

### 测试 2：访问地址

登录管理面板，检查"实例信息"中的"访问地址"：

```
✅ 正确: http://119.8.118.149:7092/222/b7c4e2a56d3f4c9e8b1a5e4d2f9c7b8a/
❌ 错误: http://119.8.118.149:7092/222/25d4420e5/12/4.5.09:51:34ce533376ec6/
```

### 测试 3：实际访问

```bash
# 获取访问 URL（从管理面板复制）
curl -I http://119.8.118.149:7092/222/b7c4e2a56d3f4c9e8b1a5e4d2f9c7b8a/

# 应该返回 200 或 302，不应该是 404
```

---

## 📊 修复脚本详解

`scripts/fix-uuid-database.js` 的工作流程：

```javascript
1. 连接数据库
2. 查询所有非管理员用户
3. 对每个用户：
   - 读取当前的 path_uuid
   - 验证是否为有效的32位十六进制UUID
   - 如果无效：
     * 生成新的 UUID（使用 randomUUID().replace(/-/g, '')）
     * 更新数据库
     * 记录日志
   - 如果有效：
     * 跳过，记录为正常
4. 输出统计信息
```

**安全性**：
- ✅ 只读取和更新 `path_uuid` 字段
- ✅ 不影响其他数据
- ✅ 使用事务确保原子性
- ✅ 详细的日志输出

---

## ⚠️ 常见问题

### Q: 修复后旧的访问链接还能用吗？
**A**: 不能。UUID 已更新，需要使用新的访问链接。这是安全特性。

### Q: 会影响正在运行的实例吗？
**A**: 不会。但建议重启实例以获取新的 Nginx 配置。

### Q: 如果脚本报错怎么办？
**A**: 
1. 检查数据库文件是否存在：`ls -la /root/ST-server/database.sqlite`
2. 检查权限：`chmod 644 /root/ST-server/database.sqlite`
3. 查看详细错误信息并反馈

### Q: 可以手动修复吗？
**A**: 可以，但不推荐。使用脚本更安全：

```sql
-- 手动修复示例（不推荐）
sqlite3 /root/ST-server/database.sqlite

UPDATE users 
SET path_uuid = 'a3f5e9d14b2c4a8e9f3d7c1b5e8d4a2f' 
WHERE username = '222';
```

### Q: 修复后需要重启所有服务吗？
**A**: 建议：
- ✅ 必须：重新生成 Nginx 配置并重载
- ✅ 推荐：重启管理平台 (`pm2 restart st-manager`)
- ⚠️ 可选：重启用户实例（会自动获取新UUID）

---

## 🔄 预防措施

为避免将来再次出现此问题：

### 1. 定期验证 UUID

添加到 crontab：
```bash
# 每天检查 UUID 有效性
0 3 * * * cd /root/ST-server && npm run fix-uuid >> /var/log/uuid-check.log 2>&1
```

### 2. 数据库约束

在数据库中添加检查约束（未来版本）：
```sql
ALTER TABLE users 
ADD CONSTRAINT check_path_uuid 
CHECK (path_uuid IS NULL OR (length(path_uuid) = 32 AND path_uuid GLOB '[0-9a-fA-F]*'));
```

### 3. 代码层面验证

在 `database.js` 中添加验证：
```javascript
export const regeneratePathUuid = (username) => {
    const newUuid = randomUUID().replace(/-/g, '');
    
    // 验证 UUID 格式
    if (!/^[a-f0-9]{32}$/i.test(newUuid)) {
        throw new Error('Generated invalid UUID');
    }
    
    // ... 保存到数据库
};
```

---

## 📞 获取帮助

如果修复脚本无法解决问题：

1. **查看日志**：
```bash
npm run fix-uuid 2>&1 | tee fix-uuid.log
```

2. **检查数据库**：
```bash
sqlite3 /root/ST-server/database.sqlite .dump > database-dump.sql
# 查看 database-dump.sql 中的 path_uuid 值
```

3. **手动验证**：
```bash
sqlite3 /root/ST-server/database.sqlite << EOF
SELECT 
    username,
    path_uuid,
    CASE 
        WHEN path_uuid IS NULL THEN 'NULL'
        WHEN LENGTH(path_uuid) != 32 THEN 'WRONG_LENGTH'
        WHEN path_uuid GLOB '*[^0-9a-fA-F]*' THEN 'INVALID_CHARS'
        ELSE 'OK'
    END as status
FROM users 
WHERE role != 'admin';
EOF
```

---

## ✅ 完成检查清单

修复后确认：

- [ ] 运行 `npm run fix-uuid` 成功
- [ ] 所有用户的 UUID 都是32位十六进制
- [ ] 重新生成 Nginx 配置成功
- [ ] Nginx 重载成功
- [ ] 访问地址显示正确（无时间戳）
- [ ] 点击访问地址可以正常访问
- [ ] 旧的错误URL返回404

---

**更新时间**: 2024-12-15  
**版本**: 1.0.0  
**维护者**: SillyTavern 管理平台开发组
