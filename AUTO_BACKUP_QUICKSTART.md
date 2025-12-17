# 自动备份功能 - 快速开始

## 🚀 安装步骤

### 1. 安装依赖

```bash
cd ST-server
npm install node-cron
```

### 2. 重启服务

```bash
pm2 restart ST-server
```

服务器启动后会自动：
- 创建 `auto_backup_config` 数据库表
- 添加 `users.auto_backup_enabled` 字段
- 初始化自动备份调度器（如果已启用）

## 👑 管理员配置

### 1. 登录管理员面板

访问 `/admin.html` 并使用管理员账号登录

### 2. 配置自动备份

在页面底部找到 **"⏰ 自动备份配置"** 区域：

#### 启用自动备份
- ☑️ 勾选 "启用自动备份"

#### 设置备份间隔
- 输入小时数（1-168 小时）
- 示例：24 表示每天备份一次

#### 选择备份类型
- **所有用户** - 备份所有符合条件的用户
- **当日登录过的用户** - 只备份今天登录过的用户
- **运行中的实例** - 只备份 ST 实例正在运行的用户

#### 保存配置
- 点击 "💾 保存配置" 按钮
- 系统会自动启动/重启定时任务

### 3. 查看备份用户

点击 "👥 查看备份用户" 可以看到：
- 符合当前备份类型的用户列表
- 每个用户的状态、HF 配置情况、自动备份偏好

### 4. 手动触发备份（测试）

- 点击 "⚡ 立即执行" 可以手动触发一次备份
- 备份会在后台执行，可以查看服务器日志了解进度

## 👤 用户设置

### 1. 配置 Hugging Face

用户需要先配置 HF 信息才能参与自动备份：

1. 登录用户控制台 `/dashboard.html`
2. 找到 **"💾 数据备份"** 区域
3. 填写：
   - Hugging Face 仓库名（例如：`username/sillytavern-backup`）
   - Hugging Face Token（需要 Write 权限）
   - Git 邮箱（用于 commit）
4. 点击 "💾 保存配置"

### 2. 启用自动备份

配置 HF 后，用户可以选择是否参与自动备份：

1. 在备份配置下方找到 **"⏰ 参与自动备份"**
2. ☑️ 勾选复选框启用
3. 系统会立即保存偏好

**注意：**
- 必须先保存 HF 配置才能启用自动备份
- 用户可以随时开启/关闭自动备份

## 📊 备份执行逻辑

### 筛选条件

只有同时满足以下条件的用户才会被备份：
1. ✅ 角色为普通用户（非管理员）
2. ✅ 已启用自动备份偏好
3. ✅ 已配置 HF Token 和仓库
4. ✅ 符合管理员设定的备份类型

### 备份类型说明

#### 所有用户 (all)
备份所有满足条件的用户

```sql
WHERE role = 'user' 
AND auto_backup_enabled = 1
AND hf_token IS NOT NULL 
AND hf_repo IS NOT NULL
```

#### 当日登录过的用户 (logged_in_today)
只备份今天登录过的用户

```sql
WHERE role = 'user' 
AND auto_backup_enabled = 1
AND hf_token IS NOT NULL 
AND hf_repo IS NOT NULL
AND DATE(last_login_at) = DATE('now')
```

#### 运行中的实例 (running)
只备份 ST 实例正在运行的用户

```sql
WHERE role = 'user' 
AND auto_backup_enabled = 1
AND hf_token IS NOT NULL 
AND hf_repo IS NOT NULL
AND status = 'running'
```

### 执行流程

1. 定时任务触发（按照管理员设定的间隔）
2. 查询符合条件的用户列表
3. 逐个执行备份：
   - 压缩 st-data 目录
   - 上传到用户的 HF 仓库
   - 记录备份结果
4. 每个用户之间间隔 2 秒（避免服务器过载）
5. 更新最后运行时间

## 📝 服务器日志示例

```
[自动备份] 🕐 启动定时任务: 每 24 小时执行一次
[自动备份] 📝 Cron 表达式: 0 */24 * * *
[自动备份] 📋 备份类型: all
[自动备份] ✅ 定时任务已启动

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

========== [自动备份] 执行完成 ==========
✅ 成功: 2 个用户
❌ 失败: 0 个用户
==========================================
```

## ⚙️ 高级配置

### 修改 Cron 时区

默认使用 `Asia/Shanghai`，如需修改请编辑 `services/auto-backup.js`：

```javascript
cronJob = cron.schedule(cronExpression, () => {
    executeAutoBackup();
}, {
    timezone: "Asia/Shanghai"  // 修改这里
});
```

### 修改备份间隔

用户可以设置的间隔范围是 1-168 小时（7天）。

如需修改范围，编辑 `routes/admin.js`：

```javascript
if (interval_hours !== undefined && (interval_hours < 1 || interval_hours > 168)) {
    return res.status(400).json({ error: '间隔时间必须在 1-168 小时之间' });
}
```

### 修改备份间隔时间

默认每个用户备份后间隔 2 秒，如需修改请编辑 `services/auto-backup.js`：

```javascript
// 每个用户之间间隔2秒，避免过载
await new Promise(resolve => setTimeout(resolve, 2000));  // 修改这里
```

## 🔧 故障排查

### 自动备份未执行

1. **检查配置是否启用**
   - 管理员面板查看 "启用自动备份" 是否勾选
   - 查看备份状态：调度器是否运行中

2. **检查用户列表**
   - 点击 "查看备份用户" 确认有符合条件的用户
   - 确认用户已配置 HF 且启用了自动备份

3. **查看服务器日志**
   ```bash
   pm2 logs ST-server
   ```

### 用户无法启用自动备份

1. **检查 HF 配置**
   - 确认已填写 Token、仓库名、邮箱
   - 点击 "保存配置" 保存

2. **检查 HF 连接**
   - 点击 "测试连接" 验证配置正确性

### 备份失败

1. **检查 HF Token 权限**
   - 确保 Token 有 Write 权限
   - Token 未过期

2. **检查网络连接**
   - 服务器能访问 huggingface.co
   - Git 命令可用

3. **检查磁盘空间**
   - 确保有足够空间创建压缩包

## 📚 相关文档

- [AUTO_BACKUP_FEATURE.md](./AUTO_BACKUP_FEATURE.md) - 详细功能文档
- [README.md](./README.md) - 项目总体说明
