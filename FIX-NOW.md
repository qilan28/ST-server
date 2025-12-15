# 🔧 立即修复 - 在线状态不显示问题

## 问题症状
✅ 用户已经登录  
✅ 实例正在运行  
❌ 管理员面板显示"⚫ 离线"  
❌ 显示"从未登录"

---

## 🚀 一键修复（推荐）

```bash
cd /root/ST-server

# 步骤 1：上传所有修改文件
# - database.js
# - routes/auth.js
# - server.js
# - scripts/fix-online-status.js
# - scripts/check-database.js
# - package.json

# 步骤 2：运行修复脚本
npm run fix-online-status

# 步骤 3：重启服务器
pm2 restart st-manager

# 步骤 4：查看启动日志
pm2 logs st-manager --lines 50
```

---

## 📋 完整修复步骤

### 1️⃣ 运行修复脚本

```bash
cd /root/ST-server
npm run fix-online-status
```

**预期输出：**
```
============================================================
修复在线状态工具
============================================================

1. 检查数据库字段...
   last_login_at: ✅ 存在
   is_online: ✅ 存在

2. 当前用户状态:
┌─────────┬──────────┬────────────┬──────────────────────┐
│ 用户名  │ 在线状态 │ 最后登录   │ 注册时间             │
├─────────┼──────────┼────────────┼──────────────────────┤
│ 123     │ ⚫ 离线   │ 从未登录   │ 2025-12-15 15:17:02  │
│ 111     │ ⚫ 离线   │ 从未登录   │ 2025-12-15 15:14:36  │
└─────────┴──────────┴────────────┴──────────────────────┘

3. 修复选项:
执行默认操作：将所有用户设置为离线...
✅ 已更新 2 个用户为离线状态

4. 修复后状态:
所有用户已设置为离线

✅ 修复完成！

💡 下一步：
   1. 重启服务器: pm2 restart st-manager
   2. 用户重新登录
   3. 查看管理员面板确认状态
```

### 2️⃣ 重启服务器

```bash
pm2 restart st-manager
```

### 3️⃣ 查看启动日志

```bash
pm2 logs st-manager --lines 100
```

**查找关键日志：**

✅ **数据库迁移成功：**
```
[Database] ℹ️  last_login_at 字段已存在
[Database] ℹ️  is_online 字段已存在
[Database] ℹ️  已将所有用户设置为离线状态 (2 个用户)
```

✅ **管理员自动创建（如果配置了）：**
```
[Admin] 开始检查自动创建管理员配置...
✅ [Admin] 管理员账号创建成功！
```

### 4️⃣ 用户重新登录

让所有用户重新登录（或自己测试登录）。

**查看登录日志：**
```bash
pm2 logs st-manager --lines 20
```

**应该看到：**
```
[Auth] ✅ 用户 123 登录状态已更新（在线 + 登录时间）
[Database] ✅ 更新用户 123 登录状态: 1 行受影响
[Database] 验证: is_online=1, last_login_at=2025-12-15 23:30:45
```

### 5️⃣ 检查管理员面板

访问管理员面板，应该看到：
- ✅ 🟢 在线
- ✅ 具体的登录时间（例如：2025/12/15 23:30）

---

## 🔍 验证修复

```bash
# 检查数据库状态
npm run check-database

# 应该显示：
# - 字段存在
# - 用户状态已更新
```

---

## ❌ 如果还是不行

### 检查点 1：数据库字段

```bash
sqlite3 /root/ST-server/database.sqlite
```

```sql
-- 查看表结构
PRAGMA table_info(users);

-- 应该包含：
-- last_login_at | DATETIME
-- is_online     | INTEGER

-- 查看用户数据
SELECT username, is_online, last_login_at FROM users;

.exit
```

### 检查点 2：登录时是否更新

登录后立即运行：

```bash
pm2 logs st-manager --lines 10 | grep -E "Auth|Database"
```

**必须看到这些日志：**
```
[Auth] ✅ 用户 xxx 登录状态已更新（在线 + 登录时间）
[Database] ✅ 更新用户 xxx 登录状态: 1 行受影响
[Database] 验证: is_online=1, last_login_at=...
```

**如果没有这些日志，说明：**
1. 代码文件未正确上传
2. 服务器未重启
3. 有代码错误

### 检查点 3：API 返回数据

```bash
# 登录后，检查 API 返回
curl -H "Cookie: st_token=你的token" http://localhost:3000/api/admin/users | jq .
```

应该包含：
```json
{
  "users": [
    {
      "username": "123",
      "isOnline": true,
      "lastLoginAt": "2025-12-15 23:30:45"
    }
  ]
}
```

### 检查点 4：手动测试更新

```bash
sqlite3 /root/ST-server/database.sqlite
```

```sql
-- 手动设置用户在线
UPDATE users SET is_online = 1, last_login_at = CURRENT_TIMESTAMP WHERE username = '123';

-- 验证
SELECT username, is_online, last_login_at FROM users WHERE username = '123';

.exit
```

然后刷新管理员面板，如果显示正常，说明是登录更新逻辑的问题。

---

## 🆘 紧急修复 - 手动添加字段

如果修复脚本失败，手动添加字段：

```bash
sqlite3 /root/ST-server/database.sqlite
```

```sql
-- 检查字段是否存在
PRAGMA table_info(users);

-- 如果 last_login_at 不存在，添加
ALTER TABLE users ADD COLUMN last_login_at DATETIME;

-- 如果 is_online 不存在，添加
ALTER TABLE users ADD COLUMN is_online INTEGER DEFAULT 0;

-- 验证
PRAGMA table_info(users);

-- 退出
.exit
```

重启服务器后重新登录。

---

## 📝 完整文件清单

确保上传了以下文件：

```
✅ database.js (增强日志 + 验证逻辑)
✅ routes/auth.js (登录更新日志)
✅ server.js (管理员创建日志)
✅ scripts/fix-online-status.js (修复脚本)
✅ scripts/check-database.js (检查脚本)
✅ scripts/check-config.js (配置检查)
✅ package.json (新增命令)
```

---

## 💡 最终验证清单

- [ ] 运行 `npm run fix-online-status`
- [ ] 看到"✅ 修复完成"
- [ ] 运行 `pm2 restart st-manager`
- [ ] 看到数据库迁移日志
- [ ] 用户重新登录
- [ ] 看到登录更新日志
- [ ] 管理员面板显示 🟢 在线
- [ ] 管理员面板显示登录时间

---

## 🎯 快捷命令

```bash
# 一键诊断
cd /root/ST-server && npm run fix-online-status && pm2 restart st-manager && pm2 logs st-manager --lines 50

# 查看日志（过滤关键信息）
pm2 logs st-manager | grep -E "Admin|Auth|Database"

# 测试登录更新
# 1. 登录
# 2. 立即运行：
pm2 logs st-manager --lines 5
```

---

**创建时间**: 2025-12-15  
**适用版本**: v1.0+
