# 🔐 配置文件自动创建管理员功能

## 功能概述

通过在 `config.json` 配置文件中设置管理员账号密码，实现服务器启动时自动创建管理员账号，无需手动运行 `npm run create-admin` 命令。

---

## ✨ 功能特性

### 1. 配置文件管理

- ✅ **配置驱动**：在 `config.json` 中配置管理员信息
- ✅ **自动创建**：服务器启动时自动检查并创建
- ✅ **安全清理**：创建成功后自动清除配置文件中的密码
- ✅ **防重复创建**：已存在的管理员不会重复创建

### 2. 配置项

```json
{
  "admin": {
    "username": "admin",           // 管理员用户名
    "password": "admin123",        // 管理员密码（创建后会自动清除）
    "email": "admin@example.com",  // 管理员邮箱
    "autoCreate": true             // 是否启用自动创建
  }
}
```

### 3. 安全机制

- ✅ **密码自动清除**：创建成功后自动从配置文件中删除密码
- ✅ **重复创建保护**：检测到已存在的管理员会跳过创建
- ✅ **密码加密存储**：数据库中存储的是加密后的密码

---

## 📋 使用方法

### 方法 1：首次部署（推荐）

#### 1. 复制配置示例

```bash
cd /root/ST-server

# 复制配置示例文件
cp config.json.example config.json
```

#### 2. 编辑配置文件

```bash
nano config.json
```

修改管理员配置：

```json
{
  "nginx": {
    "enabled": false,
    "domain": "localhost",
    "port": 80,
    "enableAccessControl": true
  },
  "system": {
    "port": 3000,
    "allowRegistration": true,
    "maxUsers": 100
  },
  "admin": {
    "username": "admin",
    "password": "your_secure_password_here",  // ← 修改为安全的密码
    "email": "your_email@example.com",        // ← 修改为你的邮箱
    "autoCreate": true                         // ← 启用自动创建
  }
}
```

#### 3. 启动服务器

```bash
# 首次启动或重启
pm2 restart st-manager

# 或
npm start
```

#### 4. 查看日志

```bash
pm2 logs st-manager --lines 20
```

**成功的日志输出**：
```
🔧 [Admin] 正在自动创建管理员账号...
✅ [Admin] 管理员账号创建成功！
   用户名: admin
   邮箱: your_email@example.com
   角色: admin
🔒 [Admin] 已从配置文件中清除管理员密码
```

#### 5. 验证配置文件

```bash
cat config.json
```

你会发现 `password` 字段已被清空：
```json
{
  "admin": {
    "username": "admin",
    "password": "",  // ← 已自动清空
    "email": "your_email@example.com",
    "autoCreate": true
  }
}
```

---

### 方法 2：已有系统添加新管理员

#### 1. 编辑配置文件

```bash
nano /root/ST-server/config.json
```

修改管理员配置为新的账号：

```json
{
  "admin": {
    "username": "newadmin",         // ← 新的用户名
    "password": "newpassword123",   // ← 新的密码
    "email": "newadmin@example.com",// ← 新的邮箱
    "autoCreate": true
  }
}
```

#### 2. 重启服务器

```bash
pm2 restart st-manager
```

#### 3. 查看日志确认

```bash
pm2 logs st-manager | grep Admin
```

---

### 方法 3：禁用自动创建

如果不想使用自动创建功能，只需将 `autoCreate` 设置为 `false`：

```json
{
  "admin": {
    "username": "",
    "password": "",
    "email": "",
    "autoCreate": false  // ← 禁用自动创建
  }
}
```

然后继续使用 `npm run create-admin` 手动创建管理员。

---

## 🔄 工作流程

```
服务器启动
    ↓
读取 config.json
    ↓
检查 admin.autoCreate
    ├─ false → 跳过自动创建
    └─ true → 继续检查
    ↓
检查配置完整性
    ├─ 不完整 → 提示并跳过
    └─ 完整 → 继续检查
    ↓
检查管理员是否存在
    ├─ 已存在 → 清除密码并跳过
    └─ 不存在 → 创建管理员
    ↓
创建管理员账号
    ├─ 加密密码
    ├─ 写入数据库
    └─ 清除配置文件中的密码
    ↓
完成
```

---

## 📊 配置文件示例

### config.json.example（配置示例）

```json
{
  "nginx": {
    "enabled": false,
    "domain": "localhost",
    "port": 80,
    "enableAccessControl": true
  },
  "system": {
    "port": 3000,
    "allowRegistration": true,
    "maxUsers": 100
  },
  "admin": {
    "username": "admin",
    "password": "admin123",
    "email": "admin@example.com",
    "autoCreate": true
  }
}
```

### config.json（实际使用，密码已清除）

```json
{
  "nginx": {
    "enabled": true,
    "domain": "yourdomain.com",
    "port": 80,
    "enableAccessControl": true
  },
  "system": {
    "port": 3000,
    "allowRegistration": false,
    "maxUsers": 50
  },
  "admin": {
    "username": "admin",
    "password": "",  // 已自动清除
    "email": "admin@yourdomain.com",
    "autoCreate": true
  }
}
```

---

## 🔒 安全注意事项

### 1. 密码强度

**❌ 弱密码示例**：
- `admin`
- `123456`
- `password`

**✅ 强密码示例**：
- `MySecureP@ssw0rd2025!`
- `Adm1n#Strong$Pass`
- `P@ssw0rd_Complex_2025`

**建议**：
- 至少 8 个字符
- 包含大小写字母、数字和特殊字符
- 不使用常见单词

### 2. 配置文件权限

```bash
# 限制配置文件权限（仅所有者可读写）
chmod 600 /root/ST-server/config.json

# 验证权限
ls -l /root/ST-server/config.json
# 应该显示: -rw------- (600)
```

### 3. 首次登录后修改密码

虽然配置文件中的密码会被清除，但建议首次登录后立即修改密码：

1. 登录管理员账号
2. 访问个人设置（如果有）
3. 修改为更安全的密码

### 4. 不要提交到版本控制

确保 `config.json` 在 `.gitignore` 中：

```bash
# 检查 .gitignore
grep config.json .gitignore

# 如果不存在，添加它
echo "config.json" >> .gitignore
```

---

## 🧪 测试场景

### 测试 1：首次创建管理员

```
前置条件：数据库中没有管理员
配置：autoCreate = true，提供完整信息
操作：启动服务器
预期结果：
✅ 创建管理员成功
✅ 日志显示创建信息
✅ 配置文件中密码被清空
✅ 可以使用配置的账号密码登录
```

### 测试 2：管理员已存在

```
前置条件：数据库中已有同名管理员
配置：autoCreate = true
操作：启动服务器
预期结果：
✅ 跳过创建
✅ 日志显示"已存在"
✅ 配置文件中密码被清空
✅ 原管理员账号不受影响
```

### 测试 3：配置不完整

```
前置条件：任意
配置：autoCreate = true，但 username 为空
操作：启动服务器
预期结果：
✅ 跳过创建
✅ 日志显示"配置不完整"
✅ 服务器正常启动
```

### 测试 4：禁用自动创建

```
前置条件：任意
配置：autoCreate = false
操作：启动服务器
预期结果：
✅ 完全跳过检查
✅ 无相关日志输出
✅ 服务器正常启动
```

---

## 🆚 对比：手动 vs 自动创建

| 特性 | 手动创建 | 自动创建 |
|------|---------|---------|
| 命令 | `npm run create-admin` | 配置 + 启动 |
| 交互性 | 需要输入信息 | 无需交互 |
| 自动化 | 不适合 | 适合自动化部署 |
| 密码安全 | 输入时可见 | 配置后自动清除 |
| 重复创建 | 手动避免 | 自动检测避免 |
| 适用场景 | 手动部署 | 自动化/容器化部署 |

---

## 🐳 容器化部署示例

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# 创建配置文件（使用环境变量）
RUN echo '{ \
  "admin": { \
    "username": "'${ADMIN_USERNAME}'", \
    "password": "'${ADMIN_PASSWORD}'", \
    "email": "'${ADMIN_EMAIL}'", \
    "autoCreate": true \
  } \
}' > config.json

EXPOSE 3000

CMD ["npm", "start"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  st-manager:
    build: .
    ports:
      - "3000:3000"
    environment:
      - ADMIN_USERNAME=admin
      - ADMIN_PASSWORD=secure_password_here
      - ADMIN_EMAIL=admin@example.com
      - JWT_SECRET=your_jwt_secret
    volumes:
      - ./data:/app/data
      - ./database.sqlite:/app/database.sqlite
```

---

## 🔧 故障排查

### 问题 1：管理员未创建

**症状**：启动服务器后没有看到创建日志

**检查**：
```bash
# 1. 查看配置
cat /root/ST-server/config.json | grep -A 5 admin

# 2. 检查 autoCreate
# 应该为 true

# 3. 查看日志
pm2 logs st-manager | grep Admin
```

**解决**：
- 确保 `autoCreate: true`
- 确保 `username`、`password`、`email` 不为空
- 重启服务器

### 问题 2：密码未清除

**症状**：创建后配置文件中仍有密码

**检查**：
```bash
cat /root/ST-server/config.json | grep password
```

**解决**：
- 手动清空：编辑 `config.json`，将 `password` 设为 `""`
- 或删除配置重新创建

### 问题 3：无法登录

**症状**：使用配置的账号密码无法登录

**检查**：
```bash
# 查看数据库
sqlite3 /root/ST-server/database.sqlite "SELECT username, email, role FROM users WHERE role='admin';"
```

**解决**：
- 确认用户名拼写正确
- 确认密码拼写正确（区分大小写）
- 查看创建日志确认是否成功

---

## 📝 最佳实践

### 1. 生产环境部署

```bash
# 1. 准备配置文件
cp config.json.example config.json

# 2. 编辑配置（使用强密码）
nano config.json

# 3. 设置文件权限
chmod 600 config.json

# 4. 启动服务
pm2 start server.js --name st-manager

# 5. 验证创建
pm2 logs st-manager | grep Admin

# 6. 确认密码已清除
grep password config.json
```

### 2. 开发环境

```json
{
  "admin": {
    "username": "dev-admin",
    "password": "dev123",
    "email": "dev@localhost",
    "autoCreate": true
  }
}
```

### 3. CI/CD 集成

```yaml
# .github/workflows/deploy.yml
- name: Create config
  run: |
    cat > config.json << EOF
    {
      "admin": {
        "username": "${{ secrets.ADMIN_USERNAME }}",
        "password": "${{ secrets.ADMIN_PASSWORD }}",
        "email": "${{ secrets.ADMIN_EMAIL }}",
        "autoCreate": true
      }
    }
    EOF

- name: Deploy
  run: |
    pm2 restart st-manager
```

---

## ✅ 功能验证清单

部署后请验证：

- [ ] `config.json.example` 包含 `admin` 配置示例
- [ ] `config.json` 中配置了管理员信息
- [ ] `autoCreate` 设置为 `true`
- [ ] 服务器启动时显示创建日志
- [ ] 管理员账号创建成功
- [ ] 配置文件中的密码已被清空
- [ ] 可以使用配置的账号密码登录
- [ ] 登录后能访问管理员面板
- [ ] 配置文件权限为 600
- [ ] `config.json` 在 `.gitignore` 中

---

## 🎉 总结

**已完成功能**：
✅ 配置文件驱动的管理员创建
✅ 自动密码清除（安全性）
✅ 重复创建检测
✅ 完整的错误处理
✅ 详细的日志输出
✅ 配置示例文件

**优势**：
- 🚀 **自动化**：无需手动运行命令
- 🔒 **安全**：创建后自动清除密码
- 🎯 **便捷**：适合自动化部署
- 📦 **容器化友好**：支持环境变量配置
- 🔍 **可追踪**：详细的日志输出

现在你可以通过配置文件轻松创建管理员账号了！🎊
