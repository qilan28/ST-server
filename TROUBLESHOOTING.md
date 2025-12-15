# 🔧 问题诊断和修复指南

## 快速诊断工具

```bash
cd /root/ST-server

# 1. 检查配置文件
npm run check-config

# 2. 检查数据库状态
npm run check-database

# 3. 查看服务器日志
pm2 logs st-manager --lines 50
```

---

## 问题 1：在线状态显示"离线"，但用户已登录

### 症状
- 用户已经登录并启动实例
- 管理员面板显示"⚫ 离线"和"从未登录"

### 原因
1. 数据库字段未迁移（服务器未重启）
2. 登录时未更新状态

### 诊断步骤

#### 步骤 1：检查数据库字段

```bash
npm run check-database
```

查看输出，确认：
- ✅ `last_login_at` 字段存在
- ✅ `is_online` 字段存在

如果字段不存在，说明数据库未迁移。

#### 步骤 2：检查服务器日志

```bash
pm2 logs st-manager --lines 100 | grep -E "Database|Admin|Auth"
```

查找以下日志：
```
[Database] 添加 last_login_at 字段...
[Database] ✅ last_login_at 字段添加成功
[Database] 添加 is_online 字段...
[Database] ✅ is_online 字段添加成功
```

#### 步骤 3：测试登录更新

登录后查看日志：
```bash
pm2 logs st-manager --lines 20
```

应该看到：
```
[Auth] ✅ 用户 xxx 登录状态已更新（在线 + 登录时间）
```

### 修复方法

#### 方法 1：重启服务器（推荐）

```bash
# 重启服务器以执行数据库迁移
pm2 restart st-manager

# 等待几秒后查看日志
pm2 logs st-manager --lines 50
```

应该看到：
```
[Database] 添加 last_login_at 字段...
[Database] ✅ last_login_at 字段添加成功
[Database] 添加 is_online 字段...
[Database] ✅ is_online 字段添加成功
[Database] ℹ️  已将所有用户设置为离线状态 (X 个用户)
```

#### 方法 2：手动添加字段（不推荐）

```bash
sqlite3 /root/ST-server/database.sqlite
```

```sql
-- 添加字段
ALTER TABLE users ADD COLUMN last_login_at DATETIME;
ALTER TABLE users ADD COLUMN is_online INTEGER DEFAULT 0;

-- 检查
PRAGMA table_info(users);

-- 退出
.exit
```

#### 方法 3：重新登录测试

1. 退出登录
2. 重新登录
3. 检查管理员面板
4. 查看日志确认状态更新

### 验证修复

```bash
# 1. 检查数据库
npm run check-database

# 应该显示用户的在线状态和登录时间

# 2. 访问管理员面板
# 应该看到 🟢 在线 和具体的登录时间
```

---

## 问题 2：自动创建管理员不工作

### 症状
- 修改了 `config.json`
- 重启服务器后管理员未创建
- 无法使用配置的账号密码登录

### 原因
1. `config.json` 不存在（只修改了 `.example` 文件）
2. 配置格式错误（JSON 语法错误）
3. `autoCreate` 设置为 `false`
4. 配置项不完整

### 诊断步骤

#### 步骤 1：检查配置文件是否存在

```bash
ls -la /root/ST-server/config.json
```

如果不存在：
```bash
cp /root/ST-server/config.json.example /root/ST-server/config.json
```

#### 步骤 2：检查配置内容

```bash
npm run check-config
```

查看输出，确认：
- ✅ `config.json` 存在
- ✅ `autoCreate: true`
- ✅ `username` 已配置
- ✅ `password` 已配置
- ✅ `email` 已配置

#### 步骤 3：查看创建日志

```bash
pm2 logs st-manager --lines 100 | grep Admin
```

查找以下日志：

**成功的日志：**
```
[Admin] 开始检查自动创建管理员配置...
[Admin] 读取到的配置: { username: 'admin', email: 'admin@example.com', autoCreate: true, hasPassword: true }
🔧 [Admin] 正在自动创建管理员账号...
   用户名: admin
   邮箱: admin@example.com
✅ [Admin] 管理员账号创建成功！
🔒 [Admin] 已从配置文件中清除管理员密码
```

**跳过创建的日志：**
```
ℹ️  [Admin] 管理员账号 "xxx" 已存在，跳过创建
```

**配置不完整：**
```
⚠️  [Admin] 管理员配置不完整，跳过自动创建
   请确保在 config.json 中配置了完整的管理员信息：
   - username: 管理员用户名
   - password: 管理员密码
   - email: 管理员邮箱
```

### 修复方法

#### 方法 1：正确配置 config.json

```bash
cd /root/ST-server

# 1. 确保 config.json 存在
if [ ! -f config.json ]; then
    cp config.json.example config.json
fi

# 2. 编辑配置
nano config.json
```

确保配置如下：

```json
{
  "admin": {
    "username": "admin",
    "password": "你的密码",
    "email": "你的邮箱",
    "autoCreate": true
  }
}
```

**注意：**
- ✅ `autoCreate` 必须是 `true`
- ✅ `password` 不能为空
- ✅ 确保 JSON 格式正确（逗号、引号等）

#### 方法 2：检查 JSON 格式

```bash
# 使用 Python 检查 JSON 格式
python3 -m json.tool config.json

# 如果有错误会显示具体位置
```

#### 方法 3：删除已存在的管理员

如果管理员已存在但想重新创建：

```bash
sqlite3 /root/ST-server/database.sqlite
```

```sql
-- 查看管理员
SELECT username, email FROM users WHERE role='admin';

-- 删除指定管理员
DELETE FROM users WHERE username='旧管理员名';

-- 退出
.exit
```

然后重启服务器。

#### 方法 4：查看完整日志

```bash
# 重启服务器
pm2 restart st-manager

# 实时查看日志（按 Ctrl+C 退出）
pm2 logs st-manager --lines 0
```

### 验证修复

```bash
# 1. 检查配置
npm run check-config

# 应该显示配置完整

# 2. 检查数据库
npm run check-database

# 应该在管理员列表中看到新创建的管理员

# 3. 尝试登录
# 使用配置的账号密码登录管理员面板
```

---

## 问题 3：密码未自动清除

### 症状
- 管理员创建成功
- 但 `config.json` 中仍有密码

### 原因
- 文件权限问题
- 清除函数失败

### 修复方法

```bash
# 1. 检查文件权限
ls -l /root/ST-server/config.json

# 2. 设置正确权限
chmod 600 /root/ST-server/config.json

# 3. 手动清除密码
nano /root/ST-server/config.json
```

将 `password` 改为空：
```json
{
  "admin": {
    "password": ""
  }
}
```

---

## 问题 4：登录后仍显示"从未登录"

### 症状
- 用户登录成功
- 但管理员面板显示"从未登录"

### 原因
- 登录状态更新函数未被调用
- 数据库写入失败

### 诊断

```bash
# 登录后立即查看日志
pm2 logs st-manager --lines 20
```

应该看到：
```
[Auth] ✅ 用户 xxx 登录状态已更新（在线 + 登录时间）
```

如果没有这条日志，说明更新函数未执行。

### 修复方法

```bash
# 1. 检查代码是否已更新
grep -A 5 "updateUserLogin" /root/ST-server/routes/auth.js

# 应该看到更新日志的代码

# 2. 重启服务器
pm2 restart st-manager

# 3. 重新登录测试
```

---

## 常用诊断命令汇总

```bash
# 检查配置文件
npm run check-config

# 检查数据库
npm run check-database

# 查看所有日志
pm2 logs st-manager

# 查看最近日志
pm2 logs st-manager --lines 50

# 实时查看日志
pm2 logs st-manager --lines 0

# 过滤特定日志
pm2 logs st-manager | grep -E "Admin|Auth|Database"

# 重启服务器
pm2 restart st-manager

# 查看服务器状态
pm2 status

# 清空日志
pm2 flush st-manager

# 查看数据库
sqlite3 /root/ST-server/database.sqlite "SELECT * FROM users;"
```

---

## 完整修复流程

### 步骤 1：上传所有修改文件

```bash
cd /root/ST-server

# 上传以下文件：
# - database.js
# - routes/auth.js
# - routes/admin.js
# - server.js
# - utils/config-manager.js
# - public/admin.html
# - public/js/admin.js
# - public/css/style.css
# - scripts/check-database.js
# - scripts/check-config.js
# - package.json
```

### 步骤 2：配置 config.json

```bash
# 如果不存在，复制示例
if [ ! -f config.json ]; then
    cp config.json.example config.json
fi

# 编辑配置
nano config.json
```

完整配置示例：
```json
{
  "nginx": {
    "enabled": true,
    "domain": "119.8.118.149",
    "port": 7091,
    "enableAccessControl": true
  },
  "system": {
    "port": 3000,
    "allowRegistration": true,
    "maxUsers": 100
  },
  "admin": {
    "username": "111",
    "password": "123456",
    "email": "admin@example.com",
    "autoCreate": true
  }
}
```

### 步骤 3：重启服务器

```bash
pm2 restart st-manager
```

### 步骤 4：查看启动日志

```bash
pm2 logs st-manager --lines 100
```

**预期日志：**
```
============================================================
[Admin] 开始检查自动创建管理员配置...
[Admin] 读取到的配置: { username: '111', email: 'admin@example.com', autoCreate: true, hasPassword: true }
🔧 [Admin] 正在自动创建管理员账号...
   用户名: 111
   邮箱: admin@example.com
✅ [Admin] 管理员账号创建成功！
   ID: 1
   用户名: 111
   邮箱: admin@example.com
   角色: admin
🔒 [Admin] 已从配置文件中清除管理员密码
============================================================
[Database] ℹ️  last_login_at 字段已存在
[Database] ℹ️  is_online 字段已存在
[Database] ℹ️  已将所有用户设置为离线状态 (X 个用户)
Database initialized successfully
============================================================
Server running on http://localhost:3000
============================================================
```

### 步骤 5：验证功能

```bash
# 1. 检查配置
npm run check-config

# 2. 检查数据库
npm run check-database

# 3. 登录测试
# 使用账号 111，密码 123456 登录

# 4. 查看管理员面板
# 应该看到在线状态和登录时间
```

---

## 如果问题仍未解决

### 收集诊断信息

```bash
# 1. 配置信息
npm run check-config > debug-config.txt

# 2. 数据库信息
npm run check-database > debug-database.txt

# 3. 服务器日志
pm2 logs st-manager --lines 200 > debug-logs.txt

# 4. 系统信息
echo "Node版本: $(node -v)" > debug-system.txt
echo "PM2版本: $(pm2 -v)" >> debug-system.txt
echo "系统: $(uname -a)" >> debug-system.txt

# 打包发送
tar -czf debug-info.tar.gz debug-*.txt
```

### 提供以下信息

1. `debug-config.txt` - 配置信息
2. `debug-database.txt` - 数据库状态
3. `debug-logs.txt` - 服务器日志
4. `debug-system.txt` - 系统信息
5. 问题的具体描述和复现步骤

---

## 联系支持

如果以上方法都无法解决问题，请提供：

1. 完整的错误日志
2. 配置文件内容（删除敏感信息）
3. 数据库检查结果
4. 问题复现步骤

---

**最后更新**: 2025-12-15
