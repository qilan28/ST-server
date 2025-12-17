# 定时自动备份功能实现文档

## ✨ 功能概述

实现了完整的定时自动备份系统，允许超级管理员配置自动备份策略，用户可以选择是否参与自动备份。

## 📋 功能特性

### 1. 管理员配置
- ✅ 设置备份间隔（1-168 小时）
- ✅ 选择备份类型：
  - `all` - 所有用户
  - `logged_in_today` - 当日登录过的用户
  - `running` - 运行中的 SillyTavern 实例
- ✅ 启用/停用自动备份
- ✅ 查看符合条件的用户列表
- ✅ 手动触发备份

### 2. 用户偏好
- ✅ 用户可选择是否参与自动备份
- ✅ 自动检查用户是否配置 Hugging Face
- ✅ 只有配置了 HF 的用户才能启用自动备份

### 3. 备份执行
- ✅ 基于 node-cron 的定时任务
- ✅ 自动筛选符合条件的用户
- ✅ 逐个用户备份，避免服务器过载
- ✅ 详细的日志记录
- ✅ 防止并发执行

## 🗄️ 数据库结构

### 新增表：auto_backup_config
```sql
CREATE TABLE auto_backup_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),  -- 单例模式
    enabled INTEGER DEFAULT 0,              -- 是否启用
    interval_hours INTEGER DEFAULT 24,      -- 间隔小时数
    backup_type TEXT DEFAULT 'all',         -- 备份类型
    last_run_at DATETIME,                   -- 最后运行时间
    created_at DATETIME,
    updated_at DATETIME
);
```

### 新增字段：users.auto_backup_enabled
```sql
ALTER TABLE users ADD COLUMN auto_backup_enabled INTEGER DEFAULT 1;
```

## 📡 API 接口

### 管理员接口（需要管理员权限）

#### 获取自动备份配置
```http
GET /api/admin/auto-backup/config
```

响应：
```json
{
    "success": true,
    "config": {
        "enabled": 1,
        "interval_hours": 24,
        "backup_type": "all",
        "last_run_at": "2025-01-01 00:00:00"
    },
    "status": {
        "enabled": true,
        "isRunning": false,
        "hasScheduler": true
    }
}
```

#### 更新自动备份配置
```http
PUT /api/admin/auto-backup/config
Content-Type: application/json

{
    "enabled": true,
    "interval_hours": 12,
    "backup_type": "logged_in_today"
}
```

#### 获取符合备份条件的用户列表
```http
GET /api/admin/auto-backup/users
```

响应：
```json
{
    "success": true,
    "backup_type": "all",
    "total": 5,
    "users": [
        {
            "username": "user1",
            "email": "user1@example.com",
            "status": "running",
            "last_login_at": "2025-01-01 12:00:00",
            "hasHFConfig": true,
            "auto_backup_enabled": true
        }
    ]
}
```

#### 手动触发自动备份
```http
POST /api/admin/auto-backup/trigger
```

### 用户接口（需要用户认证）

#### 获取用户自动备份偏好
```http
GET /api/backup/auto-backup-preference
```

响应：
```json
{
    "success": true,
    "enabled": true
}
```

#### 更新用户自动备份偏好
```http
PUT /api/backup/auto-backup-preference
Content-Type: application/json

{
    "enabled": false
}
```

## 🔧 服务模块

### services/auto-backup.js

主要函数：
- `startAutoBackupScheduler()` - 启动定时任务
- `stopAutoBackupScheduler()` - 停止定时任务
- `reloadAutoBackupScheduler()` - 重新加载配置
- `triggerManualBackup()` - 手动触发备份
- `getAutoBackupStatus()` - 获取当前状态

## 🚀 使用流程

### 管理员配置流程

1. **打开管理员面板**
   - 导航到"系统设置" -> "自动备份配置"

2. **配置备份策略**
   ```javascript
   {
       enabled: true,              // 启用自动备份
       interval_hours: 24,         // 每24小时执行一次
       backup_type: 'all'          // 备份所有符合条件的用户
   }
   ```

3. **查看符合条件的用户**
   - 点击"查看备份用户列表"
   - 系统显示所有满足条件的用户

4. **测试备份**
   - 点击"立即执行备份"
   - 系统后台开始备份所有符合条件的用户

### 用户设置流程

1. **配置 Hugging Face**
   - 在控制台 -> 数据备份 -> 配置
   - 填写 Token、仓库名、邮箱

2. **启用自动备份**
   - 在备份设置中开启"参与自动备份"
   - 系统会在管理员设定的时间自动备份

## ⏰ 定时任务

### Cron 表达式
```javascript
// 每 N 小时执行一次
const cronExpression = `0 */${interval_hours} * * *`;

// 示例：
// 每 24 小时：'0 */24 * * *'  （每天的第0分钟执行）
// 每 12 小时：'0 */12 * * *'  （0点和12点的第0分钟执行）
// 每 6 小时： '0 */6 * * *'   （0,6,12,18点的第0分钟执行）
```

### 时区
- 使用 Asia/Shanghai (UTC+8)
- 确保与服务器时区一致

## 📊 备份条件筛选

### 1. all - 所有用户
```sql
WHERE role = 'user' 
AND auto_backup_enabled = 1
AND hf_token IS NOT NULL 
AND hf_repo IS NOT NULL
```

### 2. logged_in_today - 当日登录用户
```sql
WHERE role = 'user' 
AND auto_backup_enabled = 1
AND hf_token IS NOT NULL 
AND hf_repo IS NOT NULL
AND DATE(last_login_at) = DATE('now')
```

### 3. running - 运行中的实例
```sql
WHERE role = 'user' 
AND auto_backup_enabled = 1
AND hf_token IS NOT NULL 
AND hf_repo IS NOT NULL
AND status = 'running'
```

## 📝 日志示例

```
========== [自动备份] 开始执行 ==========
[自动备份] 📋 备份类型: all
[自动备份] 👥 找到 3 个符合条件的用户

[自动备份] 🔄 正在备份用户: user1
  📦 创建压缩包...
  ☁️ 上传到 Hugging Face...
[自动备份] ✅ user1 备份成功

[自动备份] 🔄 正在备份用户: user2
  📦 创建压缩包...
  ☁️ 上传到 Hugging Face...
[自动备份] ✅ user2 备份成功

[自动备份] 🔄 正在备份用户: user3
  ❌ 备份失败: Network error
[自动备份] ❌ user3 备份失败: Network error

========== [自动备份] 执行完成 ==========
✅ 成功: 2 个用户
❌ 失败: 1 个用户
==========================================
```

## 🔒 安全机制

1. **防并发执行**
   - 使用 `isBackupRunning` 标志
   - 上一次备份未完成时跳过新任务

2. **速率限制**
   - 每个用户备份后间隔 2 秒
   - 避免服务器过载

3. **权限检查**
   - 只有管理员可以配置自动备份
   - 用户只能设置自己的偏好

4. **配置验证**
   - 自动检查用户是否配置 HF
   - 未配置则无法启用自动备份

## 🚨 注意事项

### 1. 安装依赖
首次使用需要安装 node-cron：
```bash
npm install node-cron
```

### 2. 服务器重启
- 服务器启动时自动加载配置
- 如果启用了自动备份，会自动启动定时任务

### 3. 配置修改
- 修改配置后会立即重启定时任务
- 无需手动重启服务器

### 4. 备份时长
- 单个用户备份通常需要 1-3 分钟
- 大量用户可能需要较长时间
- 建议合理设置备份类型和间隔

### 5. 存储空间
- Hugging Face 免费版有存储限制
- 提醒用户定期清理旧备份

## 🔄 待完成

- [ ] 管理员面板 UI（自动备份配置界面）
- [ ] 用户控制台 UI（备份偏好设置）
- [ ] 备份统计和历史记录
- [ ] 邮件通知功能
- [ ] 备份失败重试机制
- [ ] 备份队列管理

## 📚 相关文件

### 后端
- `/database.js` - 数据库扩展
- `/services/auto-backup.js` - 定时备份服务
- `/routes/admin.js` - 管理员 API
- `/routes/backup.js` - 用户备份偏好 API
- `/server.js` - 服务初始化

### 前端（待实现）
- `/public/admin.html` - 管理员面板
- `/public/js/admin.js` - 管理员JS
- `/public/dashboard.html` - 用户控制台
- `/public/js/dashboard.js` - 用户JS
