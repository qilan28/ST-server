# 📊 用户在线状态和登录时间功能

## 功能概述

在超级管理员面板中添加了用户在线状态判断和最后登录时间显示功能，方便管理员实时了解用户的活跃情况。

---

## ✨ 功能特性

### 1. 用户在线状态追踪

- ✅ **实时在线状态**：显示用户当前是否在线
- ✅ **自动更新**：用户登录时自动设置为在线，退出登录时设置为离线
- ✅ **服务器重启处理**：服务器启动时将所有用户设置为离线状态
- ✅ **可视化显示**：使用绿色/灰色标签区分在线/离线状态

### 2. 最后登录时间记录

- ✅ **登录时间记录**：每次用户登录时自动记录时间
- ✅ **友好显示**：未登录过的用户显示"从未登录"
- ✅ **时间格式化**：使用标准日期时间格式显示

### 3. 统计信息增强

- ✅ **在线用户统计**：系统统计卡片中新增"在线用户"数量
- ✅ **实时更新**：每5秒自动刷新统计数据

---

## 🎨 界面展示

### 管理员面板 - 系统统计

```
┌───────────────────────────────────────────────┐
│ 📊 系统统计                                    │
├───────────────────────────────────────────────┤
│  总用户数      管理员      普通用户      在线用户 │
│     10          2           8            3    │
│                                                │
│  运行中实例   已停止实例   总CPU使用  总内存使用│
│      5          3        12.5%      512 MB   │
└───────────────────────────────────────────────┘
```

### 用户管理列表

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 用户名  邮箱         角色   端口   在线状态   最后登录            实例状态 │
├──────────────────────────────────────────────────────────────────────────┤
│ user1  u1@test.com  用户   3001   🟢 在线   2025-12-15 22:30:15  运行中  │
│ user2  u2@test.com  用户   3002   ⚫ 离线   2025-12-15 18:20:10  已停止  │
│ user3  u3@test.com  用户   3003   🟢 在线   2025-12-15 22:15:30  运行中  │
│ user4  u4@test.com  用户   3004   ⚫ 离线   从未登录              已停止  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 技术实现

### 1. 数据库改动

#### 新增字段

在 `users` 表中添加了两个新字段：

```sql
-- 最后登录时间
last_login_at DATETIME

-- 在线状态 (0=离线, 1=在线)
is_online INTEGER DEFAULT 0
```

#### 数据库迁移函数（`database.js`）

```javascript
// 迁移：添加登录状态字段
const migrateAddLoginFields = () => {
    // 检查并添加 last_login_at 字段
    // 检查并添加 is_online 字段
};
```

#### 新增数据库操作函数

```javascript
// 更新用户登录状态（登录时调用）
export const updateUserLogin = (username) => {
    // 设置 last_login_at = CURRENT_TIMESTAMP
    // 设置 is_online = 1
};

// 更新用户在线状态（退出登录时调用）
export const updateUserOnlineStatus = (username, isOnline) => {
    // 设置 is_online = 0 或 1
};

// 设置所有用户为离线（服务器启动时调用）
export const setAllUsersOffline = () => {
    // 将所有用户的 is_online 设置为 0
};
```

### 2. 后端 API 改动

#### 登录接口（`routes/auth.js`）

```javascript
router.post('/login', async (req, res) => {
    // ... 验证密码 ...
    
    // 更新登录时间和在线状态
    updateUserLogin(user.username);
    
    // ... 返回 token ...
});
```

#### 退出登录接口（新增）

```javascript
router.post('/logout', authenticateToken, async (req, res) => {
    const username = req.user.username;
    
    // 将用户设置为离线状态
    updateUserOnlineStatus(username, false);
    
    // 清除 Cookie
    res.clearCookie('st_token');
    
    res.json({ message: 'Logout successful' });
});
```

#### 管理员 - 用户列表接口（`routes/admin.js`）

```javascript
router.get('/users', async (req, res) => {
    const safeUsers = users.map(user => ({
        // ... 其他字段 ...
        isOnline: user.is_online === 1,        // 新增
        lastLoginAt: user.last_login_at,       // 新增
        // ... 其他字段 ...
    }));
});
```

#### 管理员 - 统计信息接口（`routes/admin.js`）

```javascript
router.get('/stats', async (req, res) => {
    const onlineUsers = users.filter(u => u.is_online === 1).length;  // 新增
    
    res.json({
        stats: {
            // ... 其他统计 ...
            onlineUsers,  // 新增
            // ... 其他统计 ...
        }
    });
});
```

### 3. 前端改动

#### 管理员面板 HTML（`public/admin.html`）

**系统统计卡片：**
```html
<div class="stat-item">
    <div class="stat-label">在线用户</div>
    <div class="stat-value" id="onlineUsers">0</div>
</div>
```

**用户列表表头：**
```html
<thead>
    <tr>
        <!-- ... 其他列 ... -->
        <th>在线状态</th>     <!-- 新增 -->
        <th>最后登录</th>     <!-- 新增 -->
        <!-- ... 其他列 ... -->
    </tr>
</thead>
```

#### 管理员面板 JS（`public/js/admin.js`）

**加载统计信息：**
```javascript
async function loadStats() {
    // ... 其他统计 ...
    document.getElementById('onlineUsers').textContent = stats.onlineUsers || 0;
    // ... 其他统计 ...
}
```

**加载用户列表：**
```javascript
async function loadUsers() {
    tbody.innerHTML = users.map(user => `
        <tr>
            <!-- ... 其他列 ... -->
            <td>
                <span class="status-badge ${user.isOnline ? 'status-online' : 'status-offline'}">
                    ${user.isOnline ? '🟢 在线' : '⚫ 离线'}
                </span>
            </td>
            <td>${user.lastLoginAt ? formatDate(user.lastLoginAt) : '从未登录'}</td>
            <!-- ... 其他列 ... -->
        </tr>
    `).join('');
}
```

#### CSS 样式（`public/css/style.css`）

```css
/* 在线/离线状态标签 */
.status-online {
    background: #c6f6d5;
    color: #22543d;
}

.status-offline {
    background: #e2e8f0;
    color: #4a5568;
}
```

---

## 🔄 工作流程

### 用户登录流程

```
用户输入账号密码
    ↓
验证成功
    ↓
调用 updateUserLogin(username)
    ├─ 设置 last_login_at = 当前时间
    └─ 设置 is_online = 1
    ↓
生成并返回 token
    ↓
用户面板显示 🟢 在线
```

### 用户退出登录流程

```
用户点击"退出登录"
    ↓
调用 POST /api/auth/logout
    ↓
调用 updateUserOnlineStatus(username, false)
    └─ 设置 is_online = 0
    ↓
清除 st_token Cookie
    ↓
跳转到登录页
    ↓
管理员面板显示 ⚫ 离线
```

### 服务器启动流程

```
服务器启动
    ↓
初始化数据库 initDatabase()
    ├─ createUsersTable()
    ├─ migrateAddRoleField()
    ├─ migrateAddLoginFields()  ← 新增迁移
    ├─ fixAdminUserPorts()
    └─ setAllUsersOffline()     ← 重置所有用户为离线
    ↓
所有用户 is_online = 0
```

---

## 🎯 使用场景

### 场景 1：查看当前在线用户

**操作**：
1. 访问管理员面板
2. 查看"系统统计"卡片中的"在线用户"数量

**结果**：
- 实时显示当前登录的用户数量
- 每 5 秒自动刷新

### 场景 2：查看用户最后登录时间

**操作**：
1. 在"用户管理"列表中查看"最后登录"列

**结果**：
- 显示每个用户的最后登录时间
- 未登录过的用户显示"从未登录"

### 场景 3：识别活跃用户

**操作**：
1. 查看用户列表中的"在线状态"列
2. 绿色标签表示用户在线

**结果**：
- 快速识别当前活跃用户
- 方便管理员进行用户管理决策

### 场景 4：服务器维护前检查

**操作**：
1. 准备重启服务器
2. 先查看在线用户数量
3. 如果有在线用户，通知他们保存数据

**结果**：
- 避免在用户使用时重启服务器
- 减少数据丢失风险

---

## 🔍 数据流向

### 登录时数据流

```
用户浏览器
    ↓
POST /api/auth/login
    ↓
routes/auth.js
    ├─ 验证密码
    ├─ updateUserLogin(username)
    │   ↓
    │   database.js
    │   └─ UPDATE users SET last_login_at=NOW(), is_online=1
    └─ 返回 token
```

### 查看在线状态数据流

```
管理员浏览器
    ↓
GET /api/admin/users
    ↓
routes/admin.js
    ├─ getAllUsersAdmin()
    │   ↓
    │   database.js
    │   └─ SELECT * FROM users (包括 is_online, last_login_at)
    └─ 返回用户列表 (包含在线状态)
    ↓
前端渲染
    └─ 显示 🟢 在线 或 ⚫ 离线
```

---

## 📊 数据库示例

### 用户表数据示例

```
id | username | last_login_at       | is_online | created_at
---|----------|---------------------|-----------|--------------------
1  | admin    | 2025-12-15 22:30:00 | 1         | 2025-12-01 10:00:00
2  | user1    | 2025-12-15 22:15:30 | 1         | 2025-12-02 11:20:00
3  | user2    | 2025-12-15 18:20:10 | 0         | 2025-12-03 14:30:00
4  | user3    | NULL                | 0         | 2025-12-05 16:45:00
```

**说明**：
- `admin`: 在线，最后登录于 22:30
- `user1`: 在线，最后登录于 22:15
- `user2`: 离线，最后登录于 18:20
- `user3`: 离线，从未登录过

---

## ⚠️ 注意事项

### 1. 在线状态的准确性

**情况**：用户直接关闭浏览器而不点击"退出登录"

**影响**：
- 用户的 `is_online` 状态仍然为 1
- 会显示为"在线"，但实际已离线

**解决方案**：
- 服务器重启时会重置所有用户为离线
- 未来可以添加 Token 过期检测或心跳机制

### 2. 时区问题

**情况**：服务器和客户端时区不同

**影响**：
- 显示的登录时间可能与用户本地时间不符

**解决方案**：
- 数据库使用 CURRENT_TIMESTAMP（服务器时间）
- 前端可以考虑转换为本地时区（未实现）

### 3. 性能考虑

**情况**：用户数量很大时

**影响**：
- 每 5 秒刷新会频繁查询数据库

**优化建议**：
- 添加缓存机制
- 使用 WebSocket 推送更新
- 增加刷新间隔（如 10 秒或 30 秒）

---

## 🚀 部署步骤

### 1. 上传修改文件

```bash
cd /root/ST-server

# 上传以下文件：
# - database.js (添加了迁移和操作函数)
# - routes/auth.js (添加了logout端点和登录状态更新)
# - routes/admin.js (添加了在线状态和登录时间返回)
# - public/admin.html (添加了新列和统计)
# - public/js/admin.js (更新了渲染逻辑)
# - public/css/style.css (添加了在线/离线样式)
```

### 2. 重启管理平台

```bash
# 重启服务（会自动运行数据库迁移）
pm2 restart st-manager

# 查看日志，确认迁移成功
pm2 logs st-manager --lines 50
```

**预期日志输出**：
```
Adding last_login_at column to users table...
last_login_at column added successfully
Adding is_online column to users table...
is_online column added successfully
Database initialized successfully
```

### 3. 验证功能

1. **登录测试**
   ```bash
   # 登录一个用户
   # 查看数据库确认 is_online 和 last_login_at 更新
   sqlite3 database.sqlite "SELECT username, last_login_at, is_online FROM users;"
   ```

2. **管理员面板测试**
   - 访问 `http://服务器IP:7092/admin.html`
   - 查看"系统统计"中是否显示"在线用户"
   - 查看"用户管理"列表是否显示"在线状态"和"最后登录"列

3. **退出登录测试**
   - 用户退出登录
   - 管理员面板应该显示该用户为"离线"

---

## 🧪 测试用例

### 测试 1：用户首次登录

```
前置条件：新注册的用户从未登录
操作：用户登录
预期结果：
✅ last_login_at 记录当前时间
✅ is_online 设置为 1
✅ 管理员面板显示 🟢 在线
✅ 显示具体的登录时间
```

### 测试 2：用户退出登录

```
前置条件：用户已登录
操作：用户点击"退出登录"
预期结果：
✅ is_online 设置为 0
✅ last_login_at 保持不变
✅ 管理员面板显示 ⚫ 离线
✅ Cookie 被清除
```

### 测试 3：用户重新登录

```
前置条件：用户之前登录过现在已离线
操作：用户再次登录
预期结果：
✅ last_login_at 更新为新的登录时间
✅ is_online 设置为 1
✅ 管理员面板显示新的登录时间
```

### 测试 4：服务器重启

```
前置条件：有多个在线用户
操作：重启管理平台 (pm2 restart st-manager)
预期结果：
✅ 所有用户的 is_online 设置为 0
✅ last_login_at 保持不变
✅ 管理员面板显示所有用户离线
```

### 测试 5：在线用户统计

```
前置条件：3个用户在线，2个用户离线
操作：访问管理员面板
预期结果：
✅ "在线用户"统计显示 3
✅ 用户列表中3个用户显示 🟢 在线
✅ 用户列表中2个用户显示 ⚫ 离线
```

---

## 📈 未来优化建议

### 1. Token 过期自动离线

```javascript
// 定期检查 token 有效期
setInterval(() => {
    const expiredUsers = findUsersWithExpiredTokens();
    expiredUsers.forEach(user => {
        updateUserOnlineStatus(user.username, false);
    });
}, 60000); // 每分钟检查一次
```

### 2. 心跳机制

```javascript
// 前端定期发送心跳
setInterval(() => {
    fetch('/api/auth/heartbeat', { method: 'POST' });
}, 30000); // 每30秒发送一次

// 后端更新最后活跃时间
router.post('/heartbeat', authenticateToken, (req, res) => {
    updateUserLastActivity(req.user.username);
    res.json({ ok: true });
});
```

### 3. 在线时长统计

```javascript
// 记录每次登录和退出时间
export const recordLoginSession = (username, action) => {
    // action: 'login' or 'logout'
    // 存储到 login_sessions 表
};

// 查询用户总在线时长
export const getUserOnlineDuration = (username) => {
    // 计算历史在线时长
};
```

### 4. WebSocket 实时推送

```javascript
// 用户状态变化时推送给管理员
wss.broadcast({
    type: 'user_status_change',
    username: 'user1',
    isOnline: true,
    lastLoginAt: '2025-12-15 22:30:00'
});
```

---

## ✅ 功能验证清单

部署后请验证：

- [ ] 数据库迁移成功（新字段已添加）
- [ ] 服务器启动时所有用户被设置为离线
- [ ] 用户登录后在线状态变为在线
- [ ] 用户登录后记录了最后登录时间
- [ ] 用户退出登录后在线状态变为离线
- [ ] 管理员面板"在线用户"统计正确
- [ ] 用户列表显示在线状态（绿色/灰色标签）
- [ ] 用户列表显示最后登录时间
- [ ] 从未登录的用户显示"从未登录"
- [ ] 页面每5秒自动刷新统计数据

---

## 🎉 总结

**已完成功能**：
✅ 数据库字段添加（`last_login_at`, `is_online`）
✅ 登录时更新在线状态和登录时间
✅ 退出登录时更新离线状态
✅ 服务器启动时重置所有用户为离线
✅ 管理员面板显示在线状态和登录时间
✅ 系统统计显示在线用户数量
✅ 友好的UI显示（绿色/灰色标签）

**特点**：
- 🔍 实时监控：管理员可以实时了解用户活跃情况
- 📊 统计分析：在线用户数量统计帮助评估系统负载
- 🎨 可视化：直观的颜色标签区分在线/离线状态
- ⏱️ 历史记录：保留最后登录时间用于分析

管理员现在可以方便地查看用户的在线状态和登录情况了！🎊
